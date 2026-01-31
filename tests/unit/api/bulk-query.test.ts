import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../src/api/salesforce-request.js', () => ({
    salesforceRequest: vi.fn(),
}));

vi.mock('../../../src/api/fetch.js', () => ({
    smartFetch: vi.fn(),
}));

vi.mock('../../../src/auth/auth.js', () => ({
    getAccessToken: vi.fn().mockReturnValue('test-token'),
    getInstanceUrl: vi.fn().mockReturnValue('https://test.salesforce.com'),
}));

import {
    createBulkQueryJob,
    getBulkQueryJobStatus,
    abortBulkQueryJob,
    executeBulkQueryExport,
} from '../../../src/api/bulk-query.js';
import { salesforceRequest } from '../../../src/api/salesforce-request.js';
import { smartFetch } from '../../../src/api/fetch.js';

describe('bulk-query', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createBulkQueryJob', () => {
        it('creates job and returns data', async () => {
            const mockJob = { id: 'job-123', state: 'UploadComplete' };
            vi.mocked(salesforceRequest).mockResolvedValue({ json: mockJob });

            const result = await createBulkQueryJob('SELECT Id FROM Account');

            expect(result).toEqual(mockJob);
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/jobs/query'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('SELECT Id FROM Account'),
                })
            );
        });

        it('throws when no json returned', async () => {
            vi.mocked(salesforceRequest).mockResolvedValue({ json: undefined });
            await expect(createBulkQueryJob('SELECT Id FROM Account')).rejects.toThrow();
        });
    });

    describe('getBulkQueryJobStatus', () => {
        it('returns job status', async () => {
            const mockStatus = { id: 'job-123', state: 'JobComplete', numberRecordsProcessed: 100 };
            vi.mocked(salesforceRequest).mockResolvedValue({ json: mockStatus });

            const result = await getBulkQueryJobStatus('job-123');
            expect(result).toEqual(mockStatus);
        });

        it('throws when no json returned', async () => {
            vi.mocked(salesforceRequest).mockResolvedValue({ json: undefined });
            await expect(getBulkQueryJobStatus('job-123')).rejects.toThrow();
        });
    });

    describe('abortBulkQueryJob', () => {
        it('sends PATCH with Aborted state', async () => {
            vi.mocked(salesforceRequest).mockResolvedValue({});

            await abortBulkQueryJob('job-123');

            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/jobs/query/job-123'),
                expect.objectContaining({
                    method: 'PATCH',
                    body: JSON.stringify({ state: 'Aborted' }),
                })
            );
        });
    });

    describe('executeBulkQueryExport', () => {
        it('polls and returns CSV on success', async () => {
            vi.useFakeTimers();

            vi.mocked(salesforceRequest)
                .mockResolvedValueOnce({ json: { id: 'job-123', state: 'UploadComplete' } })
                .mockResolvedValueOnce({
                    json: { id: 'job-123', state: 'InProgress', numberRecordsProcessed: 0 },
                })
                .mockResolvedValueOnce({
                    json: { id: 'job-123', state: 'JobComplete', numberRecordsProcessed: 50 },
                });

            vi.mocked(smartFetch).mockResolvedValue({
                success: true,
                data: 'Id\n001xx',
                status: 200,
            });

            const promise = executeBulkQueryExport('SELECT Id FROM Account');

            // Advance past first poll interval
            await vi.advanceTimersByTimeAsync(2000);
            // Advance past second poll interval
            await vi.advanceTimersByTimeAsync(2000);

            const result = await promise;
            expect(result).toBe('Id\n001xx');

            vi.useRealTimers();
        });

        it('throws on failed job', async () => {
            vi.mocked(salesforceRequest)
                .mockResolvedValueOnce({ json: { id: 'job-123', state: 'UploadComplete' } })
                .mockResolvedValueOnce({
                    json: { id: 'job-123', state: 'Failed', errorMessage: 'Bad query' },
                });

            await expect(executeBulkQueryExport('SELECT Bad FROM Account')).rejects.toThrow(
                'failed'
            );
        });

        it('throws on aborted job', async () => {
            vi.mocked(salesforceRequest)
                .mockResolvedValueOnce({ json: { id: 'job-123', state: 'UploadComplete' } })
                .mockResolvedValueOnce({ json: { id: 'job-123', state: 'Aborted' } });

            await expect(executeBulkQueryExport('SELECT Id FROM Account')).rejects.toThrow(
                'aborted'
            );
        });

        it('calls onProgress callback', async () => {
            vi.useFakeTimers();

            vi.mocked(salesforceRequest)
                .mockResolvedValueOnce({ json: { id: 'job-123', state: 'UploadComplete' } })
                .mockResolvedValueOnce({
                    json: { id: 'job-123', state: 'JobComplete', numberRecordsProcessed: 10 },
                });

            vi.mocked(smartFetch).mockResolvedValue({ success: true, data: 'csv', status: 200 });

            const onProgress = vi.fn();
            const promise = executeBulkQueryExport('SELECT Id FROM Account', onProgress);
            await vi.advanceTimersByTimeAsync(2000);
            await promise;

            expect(onProgress).toHaveBeenCalledWith('Creating job...');
            expect(onProgress).toHaveBeenCalledWith('JobComplete', 10);
            expect(onProgress).toHaveBeenCalledWith('Downloading...');

            vi.useRealTimers();
        });
    });
});
