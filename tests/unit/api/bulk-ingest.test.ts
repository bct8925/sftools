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
    createBulkIngestJob,
    uploadBulkIngestData,
    closeBulkIngestJob,
    getBulkIngestJobStatus,
    getBulkIngestSuccessResults,
    getBulkIngestFailedResults,
    getBulkIngestUnprocessedResults,
    abortBulkIngestJob,
    executeBulkIngest,
} from '../../../src/api/bulk-ingest.js';
import { salesforceRequest } from '../../../src/api/salesforce-request.js';
import { smartFetch } from '../../../src/api/fetch.js';

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

    it('runs single job for single chunk', async () => {
        const mockJob = {
            id: 'job-001',
            operation: 'insert',
            object: 'Account',
            state: 'Open',
            contentUrl: 'services/data/v62.0/jobs/ingest/job-001/batches',
        };
        const mockJobComplete = { ...mockJob, state: 'JobComplete', numberRecordsProcessed: 2 };

        // create job
        vi.mocked(salesforceRequest)
            .mockResolvedValueOnce({ json: mockJob }) // createBulkIngestJob
            .mockResolvedValueOnce({ json: { ...mockJob, state: 'UploadComplete' } }) // closeBulkIngestJob
            .mockResolvedValueOnce({ json: mockJobComplete }); // getBulkIngestJobStatus

        vi.mocked(smartFetch)
            .mockResolvedValueOnce({ success: true, status: 201 }) // uploadBulkIngestData
            .mockResolvedValueOnce({ success: true, status: 200, data: 'Id,sf__Id\n001,001' }) // success results
            .mockResolvedValueOnce({ success: true, status: 200, data: 'sf__Id,sf__Error\n' }) // failure results
            .mockResolvedValueOnce({ success: true, status: 200, data: '' }); // unprocessed

        const result = await executeBulkIngest({ object: 'Account', operation: 'insert' }, [
            'Id,Name\n001,Test\n002,Test2',
        ]);

        expect(result.successCount).toBe(1);
        expect(result.failureCount).toBe(0);
    });

    it('throws "Import cancelled" when cancelledRef is true before first job', async () => {
        const cancelledRef = { current: true };

        await expect(
            executeBulkIngest(
                { object: 'Account', operation: 'insert' },
                ['Id,Name\n001,Test'],
                undefined,
                cancelledRef
            )
        ).rejects.toThrow('cancelled');
    });

    it('aggregates results across multiple chunks', async () => {
        const makeJobMock = (id: string) => ({
            id,
            operation: 'insert',
            object: 'Account',
            state: 'Open',
            contentUrl: `services/data/v62.0/jobs/ingest/${id}/batches`,
        });
        const makeCompleteMock = (id: string) => ({
            ...makeJobMock(id),
            state: 'JobComplete',
            numberRecordsProcessed: 2,
        });

        // Two jobs
        vi.mocked(salesforceRequest)
            .mockResolvedValueOnce({ json: makeJobMock('j1') })
            .mockResolvedValueOnce({ json: { ...makeJobMock('j1'), state: 'UploadComplete' } })
            .mockResolvedValueOnce({ json: makeCompleteMock('j1') })
            .mockResolvedValueOnce({ json: makeJobMock('j2') })
            .mockResolvedValueOnce({ json: { ...makeJobMock('j2'), state: 'UploadComplete' } })
            .mockResolvedValueOnce({ json: makeCompleteMock('j2') });

        vi.mocked(smartFetch)
            // job 1 upload, success, failure, unprocessed
            .mockResolvedValueOnce({ success: true, status: 201 })
            .mockResolvedValueOnce({
                success: true,
                status: 200,
                data: 'Id,sf__Id\n001,001\n002,002',
            })
            .mockResolvedValueOnce({
                success: true,
                status: 200,
                data: 'sf__Id,sf__Error\n003,err',
            })
            .mockResolvedValueOnce({ success: true, status: 200, data: '' })
            // job 2 upload, success, failure, unprocessed
            .mockResolvedValueOnce({ success: true, status: 201 })
            .mockResolvedValueOnce({ success: true, status: 200, data: 'Id,sf__Id\n004,004' })
            .mockResolvedValueOnce({ success: true, status: 200, data: 'sf__Id,sf__Error\n' })
            .mockResolvedValueOnce({ success: true, status: 200, data: '' });

        const result = await executeBulkIngest({ object: 'Account', operation: 'insert' }, [
            'Id,Name\n001,T\n002,T',
            'Id,Name\n004,T',
        ]);

        expect(result.successCount).toBe(3); // 2 + 1
        expect(result.failureCount).toBe(1); // 1 + 0

        // Second job's CSV should not repeat the header in the concatenated output
        const successLines = result.successCsv.split('\n').filter(l => l.trim());
        const headerCount = successLines.filter(l => l.startsWith('Id,')).length;
        expect(headerCount).toBe(1); // only one header row
    });
});
