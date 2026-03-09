// Bulk Ingest API v2 — Functions for CSV data import operations

import { getInstanceUrl, getAccessToken } from '../auth/auth';
import type {
    BulkApiVersion,
    BulkIngestConfig,
    BulkIngestJob,
    BulkIngestOperation,
    BulkIngestResults,
} from '../types/salesforce';
import { API_VERSION } from './constants';
import { smartFetch } from './fetch';
import { salesforceRequest } from './salesforce-request';
import { executeV1Ingest, abortV1Job } from './bulk-ingest-v1';

// ============================================================
// Individual V2 Job Operations
// ============================================================

/**
 * Create a Bulk API v2 ingest job
 */
export async function createBulkIngestJob(config: {
    object: string;
    operation: BulkIngestOperation;
    externalIdFieldName?: string;
}): Promise<BulkIngestJob> {
    const body: Record<string, string> = {
        object: config.object,
        operation: config.operation,
        contentType: 'CSV',
        lineEnding: 'LF',
    };
    if (config.externalIdFieldName) {
        body.externalIdFieldName = config.externalIdFieldName;
    }

    const response = await salesforceRequest<BulkIngestJob>(
        `/services/data/v${API_VERSION}/jobs/ingest`,
        {
            method: 'POST',
            body: JSON.stringify(body),
        }
    );
    if (!response.json) {
        throw new Error('No job data returned from bulk ingest API');
    }
    return response.json;
}

/**
 * Upload CSV data to a Bulk API v2 ingest job.
 * Must use smartFetch directly — salesforceRequest forces JSON content-type.
 */
export async function uploadBulkIngestData(contentUrl: string, csvData: string): Promise<void> {
    const url = `${getInstanceUrl()}/${contentUrl}`;
    const response = await smartFetch(url, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${getAccessToken()}`,
            'Content-Type': 'text/csv',
            Accept: 'application/json',
        },
        body: csvData,
    });
    if (!response.success) {
        throw new Error(response.error ?? 'Failed to upload CSV data');
    }
}

/**
 * Close a Bulk API v2 ingest job (marks upload as complete, begins processing)
 */
export async function closeBulkIngestJob(jobId: string): Promise<BulkIngestJob> {
    const response = await salesforceRequest<BulkIngestJob>(
        `/services/data/v${API_VERSION}/jobs/ingest/${jobId}`,
        {
            method: 'PATCH',
            body: JSON.stringify({ state: 'UploadComplete' }),
        }
    );
    if (!response.json) {
        throw new Error(`No job data returned when closing job ${jobId}`);
    }
    return response.json;
}

/**
 * Get the status of a Bulk API v2 ingest job
 */
export async function getBulkIngestJobStatus(jobId: string): Promise<BulkIngestJob> {
    const response = await salesforceRequest<BulkIngestJob>(
        `/services/data/v${API_VERSION}/jobs/ingest/${jobId}`
    );
    if (!response.json) {
        throw new Error(`No job status returned for job ${jobId}`);
    }
    return response.json;
}

/**
 * Get the success result CSV for a completed Bulk API v2 ingest job.
 */
export async function getBulkIngestSuccessResults(jobId: string): Promise<string> {
    return fetchResultCsv(jobId, 'successfulResults');
}

/**
 * Get the failure result CSV for a completed Bulk API v2 ingest job
 */
export async function getBulkIngestFailedResults(jobId: string): Promise<string> {
    return fetchResultCsv(jobId, 'failedResults');
}

/**
 * Get the unprocessed record CSV for a completed Bulk API v2 ingest job
 */
export async function getBulkIngestUnprocessedResults(jobId: string): Promise<string> {
    return fetchResultCsv(jobId, 'unprocessedrecords');
}

async function fetchResultCsv(jobId: string, endpoint: string): Promise<string> {
    const url = `${getInstanceUrl()}/services/data/v${API_VERSION}/jobs/ingest/${jobId}/${endpoint}`;
    const response = await smartFetch(url, {
        headers: {
            Authorization: `Bearer ${getAccessToken()}`,
            Accept: 'text/csv',
        },
    });
    if (!response.success) {
        throw new Error(response.error ?? `Failed to fetch ${endpoint} for job ${jobId}`);
    }
    return response.data ?? '';
}

/**
 * Abort a Bulk API v2 ingest job
 */
export async function abortBulkIngestJob(jobId: string): Promise<void> {
    await salesforceRequest(`/services/data/v${API_VERSION}/jobs/ingest/${jobId}`, {
        method: 'PATCH',
        body: JSON.stringify({ state: 'Aborted' }),
    });
}

// ============================================================
// Utilities
// ============================================================

/**
 * Count data rows in a CSV (header row excluded, blank trailing lines excluded)
 */
function countCsvRows(csv: string): number {
    if (!csv.trim()) return 0;
    const lines = csv.split('\n').filter(l => l.trim().length > 0);
    return Math.max(0, lines.length - 1);
}

// ============================================================
// V2 Lifecycle
// ============================================================

/**
 * Run the full v2 lifecycle: create → upload full CSV → close → poll → fetch results.
 * V2 supports large uploads natively as a single job.
 */
async function executeV2Ingest(
    config: BulkIngestConfig,
    csvData: string,
    onProgress?: (stage: string, message: string) => void,
    cancelledRef?: { current: boolean },
    activeJobIdRef?: { current: string | null }
): Promise<BulkIngestResults> {
    onProgress?.('creating', 'Creating import job...');
    const job = await createBulkIngestJob({
        object: config.object,
        operation: config.operation,
        externalIdFieldName: config.externalIdFieldName,
    });
    if (activeJobIdRef) activeJobIdRef.current = job.id;

    onProgress?.('uploading', 'Uploading CSV...');
    if (!job.contentUrl) throw new Error(`Job ${job.id} has no contentUrl`);
    await uploadBulkIngestData(job.contentUrl, csvData);

    onProgress?.('closing', 'Processing...');
    await closeBulkIngestJob(job.id);

    const pollInterval = 2000;
    const maxAttempts = 150;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (cancelledRef?.current) throw new Error('Import cancelled by user');

        const status = await getBulkIngestJobStatus(job.id);

        if (status.numberRecordsProcessed !== undefined) {
            onProgress?.('processing', `Processing: ${status.numberRecordsProcessed} records...`);
        }

        if (status.state === 'JobComplete') {
            onProgress?.('fetching-results', 'Fetching results...');
            const [successCsv, failureCsv, unprocessedCsv] = await Promise.all([
                getBulkIngestSuccessResults(job.id),
                getBulkIngestFailedResults(job.id),
                getBulkIngestUnprocessedResults(job.id),
            ]);
            return {
                successCsv,
                failureCsv,
                unprocessedCsv,
                successCount: countCsvRows(successCsv),
                failureCount: countCsvRows(failureCsv),
                unprocessedCount: countCsvRows(unprocessedCsv),
            };
        }

        if (status.state === 'Failed' || status.state === 'Aborted') {
            throw new Error(
                `Bulk ingest ${status.state.toLowerCase()}: ${status.errorMessage ?? 'Unknown error'}`
            );
        }

        await new Promise<void>(resolve => setTimeout(resolve, pollInterval));
    }

    await abortBulkIngestJob(job.id).catch(() => {
        /* ignore */
    });
    throw new Error('Bulk ingest timed out');
}

// ============================================================
// Unified Entry Points
// ============================================================

/**
 * Execute a bulk ingest job. Dispatches to v1 or v2 based on config.apiVersion.
 * V2: uploads the full CSV as a single job (no chunking).
 * V1: splits CSV into batches of config.batchSize rows per batch.
 */
export async function executeBulkIngest(
    config: BulkIngestConfig,
    csvData: string,
    onProgress?: (stage: string, message: string) => void,
    cancelledRef?: { current: boolean },
    activeJobIdRef?: { current: string | null }
): Promise<BulkIngestResults> {
    if (cancelledRef?.current) throw new Error('Import cancelled by user');

    if (config.apiVersion === 'v1') {
        return executeV1Ingest(config, csvData, onProgress, cancelledRef, activeJobIdRef);
    }
    return executeV2Ingest(config, csvData, onProgress, cancelledRef, activeJobIdRef);
}

/**
 * Abort the active ingest job. Dispatches to the correct API version.
 */
export async function abortBulkIngest(apiVersion: BulkApiVersion, jobId: string): Promise<void> {
    if (apiVersion === 'v1') return abortV1Job(jobId);
    return abortBulkIngestJob(jobId);
}
