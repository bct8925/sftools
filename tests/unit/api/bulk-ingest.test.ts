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

vi.mock('../../../src/api/bulk-ingest-v1.js', () => ({
    executeV1Ingest: vi.fn(),
    abortV1Job: vi.fn(),
}));

import {
    createBulkIngestJob,
    uploadBulkIngestData,
    closeBulkIngestJob,
    getBulkIngestJobStatus,
    getBulkIngestSuccessResults,
    getBulkIngestFailedResults,
    getBulkIngestUnprocessedResults,
    abortBulkIngestJob,
    executeBulkIngest,
    abortBulkIngest,
} from '../../../src/api/bulk-ingest.js';
import { salesforceRequest } from '../../../src/api/salesforce-request.js';
import { smartFetch } from '../../../src/api/fetch.js';
import { executeV1Ingest, abortV1Job } from '../../../src/api/bulk-ingest-v1.js';

const V2_CONFIG = {
    object: 'Account',
    operation: 'insert' as const,
    apiVersion: 'v2' as const,
    batchSize: 10_000,
    concurrencyMode: 'Parallel' as const,
};

describe('createBulkIngestJob', () => {
    beforeEach(() => vi.clearAllMocks());

    it('creates job and returns data', async () => {
        const mockJob = {
            id: 'job-001',
            operation: 'insert',
            object: 'Account',
            state: 'Open',
            contentUrl: 'services/data/v62.0/jobs/ingest/job-001/batches',
        };
        vi.mocked(salesforceRequest).mockResolvedValue({ json: mockJob });

        const result = await createBulkIngestJob({ object: 'Account', operation: 'insert' });
        expect(result).toEqual(mockJob);
        expect(salesforceRequest).toHaveBeenCalledWith(
            expect.stringContaining('/jobs/ingest'),
            expect.objectContaining({ method: 'POST' })
        );
    });

    it('includes externalIdFieldName for upsert', async () => {
        vi.mocked(salesforceRequest).mockResolvedValue({
            json: { id: 'j1', operation: 'upsert', object: 'Contact', state: 'Open' },
        });
        await createBulkIngestJob({
            object: 'Contact',
            operation: 'upsert',
            externalIdFieldName: 'ExternalId__c',
        });

        const callBody = JSON.parse(vi.mocked(salesforceRequest).mock.calls[0][1]?.body ?? '{}');
        expect(callBody.externalIdFieldName).toBe('ExternalId__c');
    });

    it('throws when no json returned', async () => {
        vi.mocked(salesforceRequest).mockResolvedValue({ json: null });
        await expect(
            createBulkIngestJob({ object: 'Account', operation: 'insert' })
        ).rejects.toThrow();
    });
});

describe('uploadBulkIngestData', () => {
    beforeEach(() => vi.clearAllMocks());

    it('PUTs CSV data with text/csv content type', async () => {
        vi.mocked(smartFetch).mockResolvedValue({ success: true, status: 201 });

        await uploadBulkIngestData(
            'services/data/v62.0/jobs/ingest/job-001/batches',
            'Id,Name\n001,Test'
        );

        expect(smartFetch).toHaveBeenCalledWith(
            'https://test.salesforce.com/services/data/v62.0/jobs/ingest/job-001/batches',
            expect.objectContaining({
                method: 'PUT',
                headers: expect.objectContaining({ 'Content-Type': 'text/csv' }),
            })
        );
    });

    it('throws when upload fails', async () => {
        vi.mocked(smartFetch).mockResolvedValue({
            success: false,
            status: 400,
            error: 'Upload failed',
        });
        await expect(uploadBulkIngestData('content', 'data')).rejects.toThrow('Upload failed');
    });
});

describe('closeBulkIngestJob', () => {
    beforeEach(() => vi.clearAllMocks());

    it('PATCHes job with UploadComplete state', async () => {
        vi.mocked(salesforceRequest).mockResolvedValue({
            json: { id: 'job-001', state: 'UploadComplete' },
        });

        const result = await closeBulkIngestJob('job-001');
        expect(result.state).toBe('UploadComplete');
        expect(salesforceRequest).toHaveBeenCalledWith(
            expect.stringContaining('job-001'),
            expect.objectContaining({
                method: 'PATCH',
                body: expect.stringContaining('UploadComplete'),
            })
        );
    });
});

describe('getBulkIngestJobStatus', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns job status', async () => {
        vi.mocked(salesforceRequest).mockResolvedValue({
            json: { id: 'job-001', state: 'InProgress', numberRecordsProcessed: 50 },
        });

        const result = await getBulkIngestJobStatus('job-001');
        expect(result.state).toBe('InProgress');
        expect(result.numberRecordsProcessed).toBe(50);
    });
});

describe('result CSV fetchers', () => {
    beforeEach(() => vi.clearAllMocks());

    it('getBulkIngestSuccessResults fetches correct endpoint', async () => {
        vi.mocked(smartFetch).mockResolvedValue({
            success: true,
            status: 200,
            data: 'Id,Name\n001,T',
        });

        const result = await getBulkIngestSuccessResults('job-001');
        expect(result).toBe('Id,Name\n001,T');
        expect(smartFetch).toHaveBeenCalledWith(
            expect.stringContaining('successfulResults'),
            expect.objectContaining({ headers: expect.objectContaining({ Accept: 'text/csv' }) })
        );
    });

    it('getBulkIngestFailedResults fetches correct endpoint', async () => {
        vi.mocked(smartFetch).mockResolvedValue({
            success: true,
            status: 200,
            data: 'sf__Id,sf__Error\n001,err',
        });

        await getBulkIngestFailedResults('job-001');
        expect(smartFetch).toHaveBeenCalledWith(
            expect.stringContaining('failedResults'),
            expect.any(Object)
        );
    });

    it('getBulkIngestUnprocessedResults fetches correct endpoint', async () => {
        vi.mocked(smartFetch).mockResolvedValue({ success: true, status: 200, data: '' });

        await getBulkIngestUnprocessedResults('job-001');
        expect(smartFetch).toHaveBeenCalledWith(
            expect.stringContaining('unprocessedrecords'),
            expect.any(Object)
        );
    });
});

describe('abortBulkIngestJob', () => {
    beforeEach(() => vi.clearAllMocks());

    it('PATCHes job with Aborted state', async () => {
        vi.mocked(salesforceRequest).mockResolvedValue({ json: null });

        await abortBulkIngestJob('job-001');
        expect(salesforceRequest).toHaveBeenCalledWith(
            expect.stringContaining('job-001'),
            expect.objectContaining({
                method: 'PATCH',
                body: expect.stringContaining('Aborted'),
            })
        );
    });
});

describe('executeBulkIngest', () => {
    beforeEach(() => vi.clearAllMocks());

    it('dispatches to v2 for apiVersion v2 — single job lifecycle', async () => {
        const mockJob = {
            id: 'job-001',
            operation: 'insert',
            object: 'Account',
            state: 'Open',
            contentUrl: 'services/data/v62.0/jobs/ingest/job-001/batches',
        };
        const mockJobComplete = { ...mockJob, state: 'JobComplete', numberRecordsProcessed: 2 };

        vi.mocked(salesforceRequest)
            .mockResolvedValueOnce({ json: mockJob }) // createBulkIngestJob
            .mockResolvedValueOnce({ json: { ...mockJob, state: 'UploadComplete' } }) // closeBulkIngestJob
            .mockResolvedValueOnce({ json: mockJobComplete }); // getBulkIngestJobStatus

        vi.mocked(smartFetch)
            .mockResolvedValueOnce({ success: true, status: 201 }) // uploadBulkIngestData
            .mockResolvedValueOnce({
                success: true,
                status: 200,
                data: 'sf__Id,sf__Created\n001,true',
            }) // success
            .mockResolvedValueOnce({ success: true, status: 200, data: 'sf__Id,sf__Error\n' }) // failure
            .mockResolvedValueOnce({ success: true, status: 200, data: '' }); // unprocessed

        const result = await executeBulkIngest(V2_CONFIG, 'Id,Name\n001,Test\n002,Test2');

        expect(result.successCount).toBe(1);
        expect(result.failureCount).toBe(0);
        // v1 module should NOT have been called
        expect(executeV1Ingest).not.toHaveBeenCalled();
    });

    it('dispatches to v1 for apiVersion v1', async () => {
        const mockResult = {
            successCsv: 'sf__Id,sf__Created\n001,true\n',
            failureCsv: 'sf__Id,sf__Error\n',
            unprocessedCsv: '',
            successCount: 1,
            failureCount: 0,
            unprocessedCount: 0,
        };
        vi.mocked(executeV1Ingest).mockResolvedValue(mockResult);

        const v1Config = { ...V2_CONFIG, apiVersion: 'v1' as const };
        const result = await executeBulkIngest(v1Config, 'Id,Name\n001,Test');

        expect(result).toEqual(mockResult);
        expect(executeV1Ingest).toHaveBeenCalledWith(
            v1Config,
            'Id,Name\n001,Test',
            undefined,
            undefined,
            undefined
        );
        expect(salesforceRequest).not.toHaveBeenCalled();
    });

    it('throws "Import cancelled" when cancelledRef is true before job', async () => {
        const cancelledRef = { current: true };

        await expect(
            executeBulkIngest(V2_CONFIG, 'Id,Name\n001,Test', undefined, cancelledRef)
        ).rejects.toThrow('cancelled');
    });
});

describe('abortBulkIngest', () => {
    beforeEach(() => vi.clearAllMocks());

    it('calls abortBulkIngestJob for v2', async () => {
        vi.mocked(salesforceRequest).mockResolvedValue({ json: null });

        await abortBulkIngest('v2', 'job-001');

        expect(salesforceRequest).toHaveBeenCalledWith(
            expect.stringContaining('job-001'),
            expect.objectContaining({ body: expect.stringContaining('Aborted') })
        );
        expect(abortV1Job).not.toHaveBeenCalled();
    });

    it('calls abortV1Job for v1', async () => {
        vi.mocked(abortV1Job).mockResolvedValue(undefined);

        await abortBulkIngest('v1', 'job-001');

        expect(abortV1Job).toHaveBeenCalledWith('job-001');
        expect(salesforceRequest).not.toHaveBeenCalled();
    });
});
