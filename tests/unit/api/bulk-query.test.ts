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
    getBulkQueryResults,
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

        it('uses queryAll operation when includeDeleted is true', async () => {
            const mockJob = { id: 'job-456', state: 'UploadComplete' };
            vi.mocked(salesforceRequest).mockResolvedValue({ json: mockJob });

            await createBulkQueryJob('SELECT Id FROM Account', true);

            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/jobs/query'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('"operation":"queryAll"'),
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

    describe('getBulkQueryResults', () => {
        it('returns CSV for single chunk (no locator)', async () => {
            vi.mocked(smartFetch).mockResolvedValue({
                success: true,
                status: 200,
                data: 'Id,Name\n001abc,Test',
                headers: { 'sforce-locator': 'null' },
            });

            const result = await getBulkQueryResults('job-123');

            expect(result).toBe('Id,Name\n001abc,Test');
            expect(smartFetch).toHaveBeenCalledTimes(1);
            expect(smartFetch).toHaveBeenCalledWith(
                expect.stringContaining('/results?maxRecords=2000'),
                expect.objectContaining({
                    headers: expect.objectContaining({ Accept: 'text/csv' }),
                })
            );
        });

        it('concatenates multiple chunks stripping subsequent headers', async () => {
            vi.mocked(smartFetch)
                .mockResolvedValueOnce({
                    success: true,
                    status: 200,
                    data: 'Id,Name\n001abc,First\n',
                    headers: { 'sforce-locator': 'abc123' },
                })
                .mockResolvedValueOnce({
                    success: true,
                    status: 200,
                    data: 'Id,Name\n001def,Second',
                    headers: { 'sforce-locator': 'null' },
                });

            const result = await getBulkQueryResults('job-123');

            expect(result).toBe('Id,Name\n001abc,First\n001def,Second');
            expect(smartFetch).toHaveBeenCalledTimes(2);
            expect(smartFetch).toHaveBeenNthCalledWith(
                2,
                expect.stringContaining('locator=abc123'),
                expect.anything()
            );
        });

        it('handles three chunks (two locators)', async () => {
            vi.mocked(smartFetch)
                .mockResolvedValueOnce({
                    success: true,
                    status: 200,
                    data: 'Id\n001a\n',
                    headers: { 'sforce-locator': 'loc1' },
                })
                .mockResolvedValueOnce({
                    success: true,
                    status: 200,
                    data: 'Id\n001b\n',
                    headers: { 'sforce-locator': 'loc2' },
                })
                .mockResolvedValueOnce({
                    success: true,
                    status: 200,
                    data: 'Id\n001c',
                    headers: { 'sforce-locator': 'null' },
                });

            const result = await getBulkQueryResults('job-123');

            expect(result).toBe('Id\n001a\n001b\n001c');
            expect(smartFetch).toHaveBeenCalledTimes(3);
        });

        it('returns empty string for empty result set', async () => {
            vi.mocked(smartFetch).mockResolvedValue({
                success: true,
                status: 200,
                data: '',
                headers: { 'sforce-locator': 'null' },
            });

            const result = await getBulkQueryResults('job-123');

            expect(result).toBe('');
        });

        it('throws on fetch failure mid-pagination', async () => {
            vi.mocked(smartFetch)
                .mockResolvedValueOnce({
                    success: true,
                    status: 200,
                    data: 'Id\n001a',
                    headers: { 'sforce-locator': 'loc1' },
                })
                .mockResolvedValueOnce({
                    success: false,
                    status: 500,
                    error: 'Server error',
                    headers: {},
                });

            await expect(getBulkQueryResults('job-123')).rejects.toThrow('Server error');
        });

        it('calls onChunkProgress with running row total for each chunk', async () => {
            vi.mocked(smartFetch)
                .mockResolvedValueOnce({
                    success: true,
                    status: 200,
                    data: 'Id\n001a',
                    headers: { 'sforce-locator': 'loc1' },
                })
                .mockResolvedValueOnce({
                    success: true,
                    status: 200,
                    data: 'Id\n001b',
                    headers: { 'sforce-locator': 'null' },
                });

            const onChunkProgress = vi.fn();
            await getBulkQueryResults('job-123', onChunkProgress);

            // Each chunk has 1 data row; running totals are 1 then 2
            expect(onChunkProgress).toHaveBeenCalledTimes(2);
            expect(onChunkProgress).toHaveBeenNthCalledWith(1, 1);
            expect(onChunkProgress).toHaveBeenNthCalledWith(2, 2);
        });

        it('works without headers field in response (backward compat)', async () => {
            vi.mocked(smartFetch).mockResolvedValue({
                success: true,
                status: 200,
                data: 'Id\n001abc',
            });

            const result = await getBulkQueryResults('job-123');

            expect(result).toBe('Id\n001abc');
            expect(smartFetch).toHaveBeenCalledTimes(1);
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
                headers: {},
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

            vi.mocked(smartFetch).mockResolvedValue({
                success: true,
                data: 'csv',
                status: 200,
                headers: {},
            });

            const onProgress = vi.fn();
            const promise = executeBulkQueryExport('SELECT Id FROM Account', onProgress);
            await vi.advanceTimersByTimeAsync(2000);
            await promise;

            expect(onProgress).toHaveBeenCalledWith('Creating job...');
            expect(onProgress).toHaveBeenCalledWith('JobComplete', 10);
            expect(onProgress).toHaveBeenCalledWith('InProgress', 0);

            vi.useRealTimers();
        });
    });
});
