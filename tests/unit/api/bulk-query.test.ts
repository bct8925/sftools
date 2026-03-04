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
        /** Helper to mock a /resultPages response with actual API field names */
        function mockResultPages(resultLinks: string[], done: boolean, nextRecordsUrl?: string) {
            return {
                json: {
                    resultChunks: resultLinks.map(link => ({ resultLink: link })),
                    done,
                    ...(nextRecordsUrl ? { nextRecordsUrl } : {}),
                },
            };
        }

        it('returns CSV for single page with single result URL', async () => {
            vi.mocked(salesforceRequest).mockResolvedValueOnce(
                mockResultPages(['/jobs/query/job-123/results?locator=abc'], true)
            );

            vi.mocked(smartFetch).mockResolvedValueOnce({
                success: true,
                status: 200,
                data: 'Id,Name\n001abc,Test',
            });

            const result = await getBulkQueryResults('job-123');

            expect(result).toBe('Id,Name\n001abc,Test');
            expect(salesforceRequest).toHaveBeenCalledTimes(1);
            expect(salesforceRequest).toHaveBeenCalledWith(expect.stringContaining('/resultPages'));
            expect(smartFetch).toHaveBeenCalledTimes(1);
            expect(smartFetch).toHaveBeenCalledWith(
                expect.stringContaining('/results?locator=abc'),
                expect.objectContaining({
                    headers: expect.objectContaining({ Accept: 'text/csv' }),
                })
            );
        });

        it('paginates through multiple resultPages and concatenates CSV', async () => {
            // First /resultPages call returns 2 chunks, not done
            vi.mocked(salesforceRequest)
                .mockResolvedValueOnce(
                    mockResultPages(
                        [
                            '/jobs/query/job-123/results?locator=abc',
                            '/jobs/query/job-123/results?locator=def',
                        ],
                        false,
                        '/jobs/query/job-123/resultPages?locator=next1'
                    )
                )
                // Second /resultPages call returns 1 chunk, done
                .mockResolvedValueOnce(
                    mockResultPages(['/jobs/query/job-123/results?locator=ghi'], true)
                );

            vi.mocked(smartFetch)
                .mockResolvedValueOnce({ success: true, status: 200, data: 'Id\n001a\n' })
                .mockResolvedValueOnce({ success: true, status: 200, data: 'Id\n001b\n' })
                .mockResolvedValueOnce({ success: true, status: 200, data: 'Id\n001c' });

            const result = await getBulkQueryResults('job-123');

            expect(result).toBe('Id\n001a\n001b\n001c');
            expect(salesforceRequest).toHaveBeenCalledTimes(2);
            // nextRecordsUrl gets prefixed with /services/data/v62.0
            expect(salesforceRequest).toHaveBeenNthCalledWith(
                2,
                expect.stringContaining(
                    '/services/data/v62.0/jobs/query/job-123/resultPages?locator=next1'
                )
            );
            expect(smartFetch).toHaveBeenCalledTimes(3);
        });

        it('returns empty string when resultChunks is empty', async () => {
            vi.mocked(salesforceRequest).mockResolvedValueOnce(mockResultPages([], true));

            const result = await getBulkQueryResults('job-123');

            expect(result).toBe('');
            expect(smartFetch).not.toHaveBeenCalled();
        });

        it('throws when response has unexpected shape (e.g. 404)', async () => {
            // salesforceRequest passes through 404 responses without throwing,
            // so the JSON body may be an error object without resultChunks
            vi.mocked(salesforceRequest).mockResolvedValueOnce({
                json: [{ errorCode: 'NOT_FOUND', message: 'Resource does not exist' }],
            });

            await expect(getBulkQueryResults('job-123')).rejects.toThrow(
                'Unexpected response from resultPages endpoint'
            );
        });

        it('throws when a CSV fetch fails', async () => {
            vi.mocked(salesforceRequest).mockResolvedValueOnce(
                mockResultPages(
                    [
                        '/jobs/query/job-123/results?locator=abc',
                        '/jobs/query/job-123/results?locator=def',
                    ],
                    true
                )
            );

            vi.mocked(smartFetch)
                .mockResolvedValueOnce({ success: true, status: 200, data: 'Id\n001a' })
                .mockResolvedValueOnce({
                    success: false,
                    status: 500,
                    error: 'Server error',
                });

            await expect(getBulkQueryResults('job-123')).rejects.toThrow('Server error');
        });

        it('calls onChunkProgress with running row totals', async () => {
            vi.mocked(salesforceRequest).mockResolvedValueOnce(
                mockResultPages(
                    [
                        '/jobs/query/job-123/results?locator=abc',
                        '/jobs/query/job-123/results?locator=def',
                    ],
                    true
                )
            );

            vi.mocked(smartFetch)
                .mockResolvedValueOnce({ success: true, status: 200, data: 'Id\n001a' })
                .mockResolvedValueOnce({ success: true, status: 200, data: 'Id\n001b' });

            const onChunkProgress = vi.fn();
            await getBulkQueryResults('job-123', onChunkProgress);

            expect(onChunkProgress).toHaveBeenCalledTimes(2);
            expect(onChunkProgress).toHaveBeenNthCalledWith(1, 1);
            expect(onChunkProgress).toHaveBeenNthCalledWith(2, 2);
        });

        it('preserves result order regardless of fetch completion order', async () => {
            vi.mocked(salesforceRequest).mockResolvedValueOnce(
                mockResultPages(
                    [
                        '/jobs/query/job-123/results?locator=first',
                        '/jobs/query/job-123/results?locator=second',
                        '/jobs/query/job-123/results?locator=third',
                    ],
                    true
                )
            );

            // Simulate out-of-order completion using delays
            vi.mocked(smartFetch)
                .mockImplementationOnce(
                    () =>
                        new Promise(resolve =>
                            setTimeout(
                                () => resolve({ success: true, status: 200, data: 'Id\n001a\n' }),
                                30
                            )
                        )
                )
                .mockImplementationOnce(
                    () =>
                        new Promise(resolve =>
                            setTimeout(
                                () => resolve({ success: true, status: 200, data: 'Id\n001b\n' }),
                                10
                            )
                        )
                )
                .mockImplementationOnce(
                    () =>
                        new Promise(resolve =>
                            setTimeout(
                                () => resolve({ success: true, status: 200, data: 'Id\n001c' }),
                                20
                            )
                        )
                );

            const result = await getBulkQueryResults('job-123');

            // Despite second completing first, order is preserved
            expect(result).toBe('Id\n001a\n001b\n001c');
        });
    });

    describe('executeBulkQueryExport', () => {
        it('polls and returns CSV on success', async () => {
            vi.useFakeTimers();

            vi.mocked(salesforceRequest)
                // createBulkQueryJob
                .mockResolvedValueOnce({ json: { id: 'job-123', state: 'UploadComplete' } })
                // getBulkQueryJobStatus (InProgress)
                .mockResolvedValueOnce({
                    json: { id: 'job-123', state: 'InProgress', numberRecordsProcessed: 0 },
                })
                // getBulkQueryJobStatus (JobComplete)
                .mockResolvedValueOnce({
                    json: { id: 'job-123', state: 'JobComplete', numberRecordsProcessed: 50 },
                })
                // getAllResultPageUrls (/resultPages)
                .mockResolvedValueOnce({
                    json: {
                        resultChunks: [
                            {
                                resultLink: '/jobs/query/job-123/results?locator=abc',
                            },
                        ],
                        done: true,
                    },
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
                // createBulkQueryJob
                .mockResolvedValueOnce({ json: { id: 'job-123', state: 'UploadComplete' } })
                // getBulkQueryJobStatus (JobComplete)
                .mockResolvedValueOnce({
                    json: { id: 'job-123', state: 'JobComplete', numberRecordsProcessed: 10 },
                })
                // getAllResultPageUrls (/resultPages)
                .mockResolvedValueOnce({
                    json: {
                        resultChunks: [
                            {
                                resultLink: '/jobs/query/job-123/results?locator=abc',
                            },
                        ],
                        done: true,
                    },
                });

            vi.mocked(smartFetch).mockResolvedValue({
                success: true,
                data: 'csv',
                status: 200,
            });

            const onProgress = vi.fn();
            const promise = executeBulkQueryExport('SELECT Id FROM Account', onProgress);
            await vi.advanceTimersByTimeAsync(2000);
            await promise;

            expect(onProgress).toHaveBeenCalledWith('Creating job...');
            expect(onProgress).toHaveBeenCalledWith('JobComplete', 10);
            expect(onProgress).toHaveBeenCalledWith('Downloading', 0, 10);

            vi.useRealTimers();
        });
    });
});
