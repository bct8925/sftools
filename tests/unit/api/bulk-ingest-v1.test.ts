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
    createV1Job,
    addV1Batch,
    closeV1Job,
    abortV1Job,
    getV1BatchList,
    getV1BatchResult,
    executeV1Ingest,
} from '../../../src/api/bulk-ingest-v1.js';
import { salesforceRequest } from '../../../src/api/salesforce-request.js';
import { smartFetch } from '../../../src/api/fetch.js';
import type { BulkIngestConfig } from '../../../src/types/salesforce.js';

const BASE_CONFIG: BulkIngestConfig = {
    object: 'Account',
    operation: 'insert',
    apiVersion: 'v1',
    batchSize: 10_000,
    concurrencyMode: 'Parallel',
};

describe('createV1Job', () => {
    beforeEach(() => vi.clearAllMocks());

    it('POSTs to async job endpoint with concurrencyMode', async () => {
        const mockJob = {
            id: 'v1-job-001',
            object: 'Account',
            operation: 'insert',
            state: 'Open',
            concurrencyMode: 'Parallel',
            contentType: 'CSV',
        };
        vi.mocked(salesforceRequest).mockResolvedValue({ json: mockJob });

        const result = await createV1Job(BASE_CONFIG);

        expect(result).toEqual(mockJob);
        expect(salesforceRequest).toHaveBeenCalledWith(
            expect.stringContaining('/services/async/'),
            expect.objectContaining({ method: 'POST' })
        );
        const body = JSON.parse(vi.mocked(salesforceRequest).mock.calls[0][1]?.body ?? '{}');
        expect(body.concurrencyMode).toBe('Parallel');
        expect(body.contentType).toBe('CSV');
        expect(body.operation).toBe('insert');
    });

    it('includes externalIdFieldName for upsert', async () => {
        vi.mocked(salesforceRequest).mockResolvedValue({
            json: { id: 'j1', state: 'Open', concurrencyMode: 'Parallel', contentType: 'CSV' },
        });
        const config = {
            ...BASE_CONFIG,
            operation: 'upsert' as const,
            externalIdFieldName: 'MyId__c',
        };
        await createV1Job(config);

        const body = JSON.parse(vi.mocked(salesforceRequest).mock.calls[0][1]?.body ?? '{}');
        expect(body.externalIdFieldName).toBe('MyId__c');
    });

    it('throws when no json returned', async () => {
        vi.mocked(salesforceRequest).mockResolvedValue({ json: null });
        await expect(createV1Job(BASE_CONFIG)).rejects.toThrow();
    });
});

describe('addV1Batch', () => {
    beforeEach(() => vi.clearAllMocks());

    it('POSTs CSV data with text/csv content-type override', async () => {
        const mockBatch = { id: 'batch-001', jobId: 'job-001', state: 'Queued' };
        vi.mocked(salesforceRequest).mockResolvedValue({ json: mockBatch });

        const result = await addV1Batch('job-001', 'Id,Name\n001,Test');

        expect(result).toEqual(mockBatch);
        expect(salesforceRequest).toHaveBeenCalledWith(
            expect.stringContaining('/job/job-001/batch'),
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({ 'Content-Type': 'text/csv; charset=UTF-8' }),
                body: 'Id,Name\n001,Test',
            })
        );
    });

    it('throws when no batch info returned', async () => {
        vi.mocked(salesforceRequest).mockResolvedValue({ json: null });
        await expect(addV1Batch('job-001', 'data')).rejects.toThrow();
    });
});

describe('closeV1Job', () => {
    beforeEach(() => vi.clearAllMocks());

    it('POSTs Closed state to job endpoint', async () => {
        vi.mocked(salesforceRequest).mockResolvedValue({ json: null });

        await closeV1Job('job-001');

        expect(salesforceRequest).toHaveBeenCalledWith(
            expect.stringContaining('/job/job-001'),
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('Closed'),
            })
        );
    });
});

describe('abortV1Job', () => {
    beforeEach(() => vi.clearAllMocks());

    it('POSTs Aborted state to job endpoint', async () => {
        vi.mocked(salesforceRequest).mockResolvedValue({ json: null });

        await abortV1Job('job-001');

        expect(salesforceRequest).toHaveBeenCalledWith(
            expect.stringContaining('/job/job-001'),
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('Aborted'),
            })
        );
    });
});

describe('getV1BatchList', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns batchInfo array', async () => {
        const batchInfo = [
            { id: 'b1', jobId: 'j1', state: 'Completed' },
            { id: 'b2', jobId: 'j1', state: 'Queued' },
        ];
        vi.mocked(salesforceRequest).mockResolvedValue({ json: { batchInfo } });

        const result = await getV1BatchList('j1');
        expect(result).toEqual(batchInfo);
    });

    it('returns empty array when json is null', async () => {
        vi.mocked(salesforceRequest).mockResolvedValue({ json: null });
        const result = await getV1BatchList('j1');
        expect(result).toEqual([]);
    });
});

describe('getV1BatchResult', () => {
    beforeEach(() => vi.clearAllMocks());

    it('fetches with Accept: text/csv and returns CSV string', async () => {
        vi.mocked(smartFetch).mockResolvedValue({
            success: true,
            status: 200,
            data: 'Id,Success,Created,Error\n001,true,true,',
        });

        const result = await getV1BatchResult('job-001', 'batch-001');
        expect(result).toBe('Id,Success,Created,Error\n001,true,true,');
        expect(smartFetch).toHaveBeenCalledWith(
            expect.stringContaining('/job/job-001/batch/batch-001/result'),
            expect.objectContaining({ headers: expect.objectContaining({ Accept: 'text/csv' }) })
        );
    });

    it('throws on fetch failure', async () => {
        vi.mocked(smartFetch).mockResolvedValue({
            success: false,
            status: 500,
            error: 'Server error',
        });
        await expect(getV1BatchResult('job-001', 'batch-001')).rejects.toThrow('Server error');
    });
});

describe('executeV1Ingest — full lifecycle', () => {
    beforeEach(() => vi.clearAllMocks());

    function makeJob() {
        return {
            id: 'j1',
            object: 'Account',
            operation: 'insert',
            state: 'Open',
            concurrencyMode: 'Parallel',
            contentType: 'CSV',
        };
    }

    function makeBatchCompleted(id: string): object {
        return { id, jobId: 'j1', state: 'Completed' };
    }

    it('runs create → upload → close → poll → results lifecycle', async () => {
        vi.mocked(salesforceRequest)
            .mockResolvedValueOnce({ json: makeJob() }) // createV1Job
            .mockResolvedValueOnce({ json: { id: 'b1', jobId: 'j1', state: 'Queued' } }) // addV1Batch
            .mockResolvedValueOnce({ json: null }) // closeV1Job
            .mockResolvedValueOnce({ json: { batchInfo: [makeBatchCompleted('b1')] } }); // getV1BatchList

        vi.mocked(smartFetch).mockResolvedValueOnce({
            success: true,
            status: 200,
            data: 'Id,Success,Created,Error\n001,true,true,\n002,false,false,Some error',
        }); // getV1BatchResult

        const result = await executeV1Ingest(BASE_CONFIG, 'Id,Name\n001,A\n002,B');

        expect(result.successCount).toBe(1);
        expect(result.failureCount).toBe(1);
        expect(result.successCsv).toContain('sf__Id');
        expect(result.failureCsv).toContain('sf__Error');
    });

    it('reports progress messages', async () => {
        vi.mocked(salesforceRequest)
            .mockResolvedValueOnce({ json: makeJob() })
            .mockResolvedValueOnce({ json: { id: 'b1', jobId: 'j1', state: 'Queued' } })
            .mockResolvedValueOnce({ json: null })
            .mockResolvedValueOnce({ json: { batchInfo: [makeBatchCompleted('b1')] } });

        vi.mocked(smartFetch).mockResolvedValueOnce({
            success: true,
            status: 200,
            data: 'Id,Success,Created,Error\n001,true,true,',
        });

        const stages: string[] = [];
        await executeV1Ingest(BASE_CONFIG, 'Id,Name\n001,A', stage => stages.push(stage));

        expect(stages).toContain('creating');
        expect(stages).toContain('uploading');
        expect(stages).toContain('processing');
        expect(stages).toContain('fetching-results');
    });

    it('throws on cancellation between batch uploads', async () => {
        vi.mocked(salesforceRequest).mockResolvedValueOnce({ json: makeJob() }); // createV1Job

        const cancelledRef = { current: false };
        // Cancel after job creation but before upload
        vi.mocked(salesforceRequest).mockImplementationOnce(async () => {
            cancelledRef.current = true;
            return { json: { id: 'b1', jobId: 'j1', state: 'Queued' } };
        });

        // Config with small batchSize to produce 2 chunks
        const smallBatchConfig = { ...BASE_CONFIG, batchSize: 1 };
        const csv = 'Id,Name\n001,A\n002,B'; // 2 data rows → 2 batches with batchSize=1

        await expect(
            executeV1Ingest(smallBatchConfig, csv, undefined, cancelledRef)
        ).rejects.toThrow('cancelled');
    });

    it('handles NotProcessed batches as unprocessed CSV', async () => {
        vi.mocked(salesforceRequest)
            .mockResolvedValueOnce({ json: makeJob() })
            .mockResolvedValueOnce({ json: { id: 'b1', jobId: 'j1', state: 'Queued' } })
            .mockResolvedValueOnce({ json: null })
            .mockResolvedValueOnce({
                json: { batchInfo: [{ id: 'b1', jobId: 'j1', state: 'NotProcessed' }] },
            });

        const result = await executeV1Ingest(BASE_CONFIG, 'Id,Name\n001,A');

        // NotProcessed → original chunk goes into unprocessed
        expect(result.successCount).toBe(0);
        expect(result.unprocessedCsv).toContain('Id,Name');
    });

    it('aborts and throws on polling timeout', async () => {
        vi.mocked(salesforceRequest)
            .mockResolvedValueOnce({ json: makeJob() }) // createV1Job
            .mockResolvedValueOnce({ json: { id: 'b1', jobId: 'j1', state: 'Queued' } }) // addV1Batch
            .mockResolvedValueOnce({ json: null }); // closeV1Job

        // All poll attempts return a non-terminal state
        vi.mocked(salesforceRequest).mockResolvedValue({
            json: { batchInfo: [{ id: 'b1', jobId: 'j1', state: 'InProgress' }] },
        });

        vi.useFakeTimers();
        // Attach .catch immediately to prevent unhandled rejection warning
        let caughtError: Error | null = null;
        const ingestPromise = executeV1Ingest(BASE_CONFIG, 'Id,Name\n001,A').catch(e => {
            caughtError = e as Error;
        });

        // Advance through all 150 poll intervals
        for (let i = 0; i < 150; i++) {
            await vi.advanceTimersByTimeAsync(2000);
        }

        await ingestPromise;
        expect(caughtError?.message).toContain('timed out');
        vi.useRealTimers();
    });
});

describe('normalizeV1Results — result normalization', () => {
    beforeEach(() => vi.clearAllMocks());

    it('splits success and failure rows correctly', async () => {
        vi.mocked(salesforceRequest)
            .mockResolvedValueOnce({
                json: {
                    id: 'j1',
                    object: 'Account',
                    operation: 'insert',
                    state: 'Open',
                    concurrencyMode: 'Parallel',
                    contentType: 'CSV',
                },
            })
            .mockResolvedValueOnce({ json: { id: 'b1', jobId: 'j1', state: 'Queued' } })
            .mockResolvedValueOnce({ json: null })
            .mockResolvedValueOnce({
                json: { batchInfo: [{ id: 'b1', jobId: 'j1', state: 'Completed' }] },
            });

        vi.mocked(smartFetch).mockResolvedValueOnce({
            success: true,
            status: 200,
            data: 'Id,Success,Created,Error\n001,true,true,\n002,false,false,Duplicate value',
        });

        const result = await executeV1Ingest(BASE_CONFIG, 'Id,Name\n001,A\n002,B');

        expect(result.successCount).toBe(1);
        expect(result.failureCount).toBe(1);

        const successLines = result.successCsv.trim().split('\n');
        expect(successLines[0]).toBe('sf__Id,sf__Created');
        expect(successLines[1]).toContain('001');

        const failureLines = result.failureCsv.trim().split('\n');
        expect(failureLines[0]).toBe('sf__Id,sf__Error');
        expect(failureLines[1]).toContain('002');
        expect(failureLines[1]).toContain('Duplicate value');
    });

    it('produces empty success CSV when all rows fail', async () => {
        vi.mocked(salesforceRequest)
            .mockResolvedValueOnce({
                json: {
                    id: 'j1',
                    object: 'Account',
                    operation: 'insert',
                    state: 'Open',
                    concurrencyMode: 'Parallel',
                    contentType: 'CSV',
                },
            })
            .mockResolvedValueOnce({ json: { id: 'b1', jobId: 'j1', state: 'Queued' } })
            .mockResolvedValueOnce({ json: null })
            .mockResolvedValueOnce({
                json: { batchInfo: [{ id: 'b1', jobId: 'j1', state: 'Completed' }] },
            });

        vi.mocked(smartFetch).mockResolvedValueOnce({
            success: true,
            status: 200,
            data: 'Id,Success,Created,Error\n001,false,false,Field required',
        });

        const result = await executeV1Ingest(BASE_CONFIG, 'Id,Name\n001,A');

        expect(result.successCount).toBe(0);
        expect(result.failureCount).toBe(1);
    });
});
