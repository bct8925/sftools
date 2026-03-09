// Bulk Ingest API v2 — Functions for CSV data import operations

import { getInstanceUrl, getAccessToken } from '../auth/auth';
import type { BulkIngestJob, BulkIngestOperation, BulkIngestResults } from '../types/salesforce';
import { API_VERSION } from './constants';
import { smartFetch } from './fetch';
import { salesforceRequest } from './salesforce-request';

// ============================================================
// Individual Job Operations
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
 * Must use smartFetch directly — result is CSV, not JSON.
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
// Result CSV Aggregation
// ============================================================

/**
 * Strip the header row from a CSV (jobs 2+ in multi-job aggregation)
 */
function stripCsvHeader(csv: string): string {
    const newlineIndex = csv.indexOf('\n');
    if (newlineIndex < 0) return '';
    return csv.slice(newlineIndex + 1);
}

/**
 * Count data rows in a CSV (header row excluded, blank trailing lines excluded)
 */
function countCsvRows(csv: string): number {
    if (!csv.trim()) return 0;
    const lines = csv.split('\n').filter(l => l.trim().length > 0);
    // Subtract 1 for the header row
    return Math.max(0, lines.length - 1);
}

// ============================================================
// Single-Job Lifecycle
// ============================================================

interface ProgressArgs {
    stage: string;
    message: string;
}

/**
 * Run the full lifecycle for a single CSV chunk:
 * create → upload → close → poll → fetch results
 */
async function runSingleJob(
    config: { object: string; operation: BulkIngestOperation; externalIdFieldName?: string },
    csvChunk: string,
    jobIndex: number,
    totalJobs: number,
    onProgress?: (args: ProgressArgs) => void,
    cancelledRef?: { current: boolean },
    activeJobIdRef?: { current: string | null }
): Promise<{ successCsv: string; failureCsv: string; unprocessedCsv: string; job: BulkIngestJob }> {
    const jobLabel = totalJobs > 1 ? ` (job ${jobIndex + 1}/${totalJobs})` : '';

    onProgress?.({ stage: 'creating', message: `Creating import job${jobLabel}...` });
    const job = await createBulkIngestJob(config);
    if (activeJobIdRef) activeJobIdRef.current = job.id;

    onProgress?.({ stage: 'uploading', message: `Uploading CSV${jobLabel}...` });
    if (!job.contentUrl) throw new Error(`Job ${job.id} has no contentUrl`);
    await uploadBulkIngestData(job.contentUrl, csvChunk);

    onProgress?.({ stage: 'closing', message: `Processing${jobLabel}...` });
    await closeBulkIngestJob(job.id);

    // Poll until terminal state
    const pollInterval = 2000;
    const maxAttempts = 150;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const status = await getBulkIngestJobStatus(job.id);

        if (status.numberRecordsProcessed !== undefined) {
            onProgress?.({
                stage: 'processing',
                message: `Processing${jobLabel}: ${status.numberRecordsProcessed} records...`,
            });
        }

        if (status.state === 'JobComplete') {
            onProgress?.({ stage: 'fetching-results', message: `Fetching results${jobLabel}...` });

            const [successCsv, failureCsv, unprocessedCsv] = await Promise.all([
                getBulkIngestSuccessResults(job.id),
                getBulkIngestFailedResults(job.id),
                getBulkIngestUnprocessedResults(job.id),
            ]);
            return { successCsv, failureCsv, unprocessedCsv, job: status };
        }

        if (status.state === 'Failed' || status.state === 'Aborted') {
            throw new Error(
                `Bulk ingest ${status.state.toLowerCase()}${jobLabel}: ${status.errorMessage ?? 'Unknown error'}`
            );
        }

        await new Promise<void>(resolve => setTimeout(resolve, pollInterval));
    }

    // Timed out — abort and throw
    await abortBulkIngestJob(job.id).catch(() => {
        /* ignore */
    });
    throw new Error(`Bulk ingest timed out${jobLabel}`);
}

// ============================================================
// Orchestrator
// ============================================================

/**
 * Execute a full bulk ingest: splits CSV into chunks, runs each job sequentially,
 * aggregates results, and reports progress. Supports cancellation via cancelledRef.
 */
export async function executeBulkIngest(
    config: { object: string; operation: BulkIngestOperation; externalIdFieldName?: string },
    csvChunks: string[],
    onProgress?: (stage: string, message: string) => void,
    cancelledRef?: { current: boolean },
    activeJobIdRef?: { current: string | null }
): Promise<BulkIngestResults> {
    const progressCallback = onProgress
        ? (args: ProgressArgs) => onProgress(args.stage, args.message)
        : undefined;

    const totalJobs = csvChunks.length;

    const allSuccess: string[] = [];
    const allFailure: string[] = [];
    const allUnprocessed: string[] = [];
    let totalSuccess = 0;
    let totalFailure = 0;
    let totalUnprocessed = 0;

    for (let i = 0; i < csvChunks.length; i++) {
        if (cancelledRef?.current) {
            throw new Error('Import cancelled by user');
        }

        const { successCsv, failureCsv, unprocessedCsv } = await runSingleJob(
            config,
            csvChunks[i],
            i,
            totalJobs,
            progressCallback,
            cancelledRef,
            activeJobIdRef
        );

        // First job keeps the header; subsequent jobs strip it
        if (i === 0) {
            allSuccess.push(successCsv);
            allFailure.push(failureCsv);
            allUnprocessed.push(unprocessedCsv);
        } else {
            allSuccess.push(stripCsvHeader(successCsv));
            allFailure.push(stripCsvHeader(failureCsv));
            allUnprocessed.push(stripCsvHeader(unprocessedCsv));
        }

        // Count rows from the original (with header) for accuracy
        totalSuccess += countCsvRows(successCsv);
        totalFailure += countCsvRows(failureCsv);
        totalUnprocessed += countCsvRows(unprocessedCsv);
    }

    onProgress?.(
        'complete',
        `Import complete: ${totalSuccess} succeeded, ${totalFailure} failed, ${totalUnprocessed} unprocessed`
    );

    return {
        successCsv: allSuccess.join(''),
        failureCsv: allFailure.join(''),
        unprocessedCsv: allUnprocessed.join(''),
        successCount: totalSuccess,
        failureCount: totalFailure,
        unprocessedCount: totalUnprocessed,
    };
}
