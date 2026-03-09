// Bulk Ingest API v1 — Functions for CSV data import via Bulk API 1.0

import { getInstanceUrl, getAccessToken } from '../auth/auth';
import type {
    BulkIngestConfig,
    BulkIngestResults,
    BulkV1BatchInfo,
    BulkV1Job,
} from '../types/salesforce';
import { splitCsvIntoChunks } from '../lib/csv-parse';
import { API_VERSION } from './constants';
import { smartFetch } from './fetch';
import { salesforceRequest } from './salesforce-request';

// ============================================================
// Individual V1 Job Operations
// ============================================================

const V1_BASE = `/services/async/${API_VERSION}/job`;

export async function createV1Job(config: BulkIngestConfig): Promise<BulkV1Job> {
    const body: Record<string, string> = {
        operation: config.operation,
        object: config.object,
        contentType: 'CSV',
        concurrencyMode: config.concurrencyMode,
    };
    if (config.externalIdFieldName) {
        body.externalIdFieldName = config.externalIdFieldName;
    }

    const response = await salesforceRequest<BulkV1Job>(V1_BASE, {
        method: 'POST',
        body: JSON.stringify(body),
    });
    if (!response.json) {
        throw new Error('No job data returned from Bulk API v1');
    }
    return response.json;
}

/**
 * Upload a CSV batch to a v1 job.
 * Must set Content-Type to text/csv; salesforceRequest applies Accept: application/json.
 */
export async function addV1Batch(jobId: string, csvData: string): Promise<BulkV1BatchInfo> {
    const response = await salesforceRequest<BulkV1BatchInfo>(`${V1_BASE}/${jobId}/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv; charset=UTF-8' },
        body: csvData,
    });
    if (!response.json) {
        throw new Error(`No batch info returned for job ${jobId}`);
    }
    return response.json;
}

export async function closeV1Job(jobId: string): Promise<void> {
    await salesforceRequest(`${V1_BASE}/${jobId}`, {
        method: 'POST',
        body: JSON.stringify({ state: 'Closed' }),
    });
}

export async function getV1BatchList(jobId: string): Promise<BulkV1BatchInfo[]> {
    const response = await salesforceRequest<{ batchInfo: BulkV1BatchInfo[] }>(
        `${V1_BASE}/${jobId}/batch`
    );
    return response.json?.batchInfo ?? [];
}

/**
 * Fetch the result CSV for a completed v1 batch.
 * Must use smartFetch — response is CSV, not JSON.
 */
export async function getV1BatchResult(jobId: string, batchId: string): Promise<string> {
    const url = `${getInstanceUrl()}${V1_BASE}/${jobId}/batch/${batchId}/result`;
    const response = await smartFetch(url, {
        headers: {
            Authorization: `Bearer ${getAccessToken()}`,
            Accept: 'text/csv',
        },
    });
    if (!response.success) {
        throw new Error(
            response.error ?? `Failed to fetch result for batch ${batchId} in job ${jobId}`
        );
    }
    return response.data ?? '';
}

export async function abortV1Job(jobId: string): Promise<void> {
    await salesforceRequest(`${V1_BASE}/${jobId}`, {
        method: 'POST',
        body: JSON.stringify({ state: 'Aborted' }),
    });
}

// ============================================================
// Result Normalization
// ============================================================

/**
 * Count data rows in a CSV (header excluded, blank lines excluded)
 */
function countCsvRows(csv: string): number {
    if (!csv.trim()) return 0;
    const lines = csv.split('\n').filter(l => l.trim().length > 0);
    return Math.max(0, lines.length - 1);
}

/**
 * Strip the header row from a CSV (for multi-batch aggregation)
 */
function stripCsvHeader(csv: string): string {
    const newlineIndex = csv.indexOf('\n');
    if (newlineIndex < 0) return '';
    return csv.slice(newlineIndex + 1);
}

/**
 * Convert a v1 batch result CSV (Id,Success,Created,Error) into v2-compatible
 * success (sf__Id,sf__Created) and failure (sf__Id,sf__Error) CSVs.
 */
function normalizeV1Results(resultCsv: string): { successCsv: string; failureCsv: string } {
    if (!resultCsv.trim()) {
        return { successCsv: 'sf__Id,sf__Created\n', failureCsv: 'sf__Id,sf__Error\n' };
    }

    const lines = resultCsv.split('\n').filter(l => l.trim());
    if (lines.length === 0) {
        return { successCsv: 'sf__Id,sf__Created\n', failureCsv: 'sf__Id,sf__Error\n' };
    }

    // Find column indices from header
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const idIdx = headers.findIndex(h => h === 'Id');
    const successIdx = headers.findIndex(h => h === 'Success');
    const createdIdx = headers.findIndex(h => h === 'Created');
    const errorIdx = headers.findIndex(h => h === 'Error');

    const successRows: string[] = ['sf__Id,sf__Created'];
    const failureRows: string[] = ['sf__Id,sf__Error'];

    for (const line of lines.slice(1)) {
        const cols = line.split(',');
        const id = cols[idIdx]?.trim().replace(/^"|"$/g, '') ?? '';
        const isSuccess = cols[successIdx]?.trim().toLowerCase() === 'true';
        const created = cols[createdIdx]?.trim().replace(/^"|"$/g, '') ?? '';
        const error = cols[errorIdx]?.trim().replace(/^"|"$/g, '') ?? '';

        if (isSuccess) {
            successRows.push(`${id},${created}`);
        } else {
            failureRows.push(`${id},${error}`);
        }
    }

    return {
        successCsv: successRows.join('\n') + '\n',
        failureCsv: failureRows.join('\n') + '\n',
    };
}

// ============================================================
// V1 Orchestrator
// ============================================================

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 150;

const TERMINAL_BATCH_STATES: BulkV1BatchInfo['state'][] = ['Completed', 'Failed', 'NotProcessed'];

export async function executeV1Ingest(
    config: BulkIngestConfig,
    csvData: string,
    onProgress?: (stage: string, message: string) => void,
    cancelledRef?: { current: boolean },
    activeJobIdRef?: { current: string | null }
): Promise<BulkIngestResults> {
    // 1. Create job
    onProgress?.('creating', 'Creating Bulk API v1 job...');
    const job = await createV1Job(config);
    if (activeJobIdRef) activeJobIdRef.current = job.id;

    // 2. Split CSV into batches and upload sequentially
    const chunks = splitCsvIntoChunks(csvData, config.batchSize);
    const totalBatches = chunks.length;

    // Map batchId → original chunk (for NotProcessed batches)
    const batchChunkMap = new Map<string, string>();

    for (let i = 0; i < chunks.length; i++) {
        if (cancelledRef?.current) throw new Error('Import cancelled by user');
        onProgress?.('uploading', `Uploading batch ${i + 1}/${totalBatches}...`);
        const batchInfo = await addV1Batch(job.id, chunks[i]);
        batchChunkMap.set(batchInfo.id, chunks[i]);
    }

    // 3. Close job (signals upload complete)
    await closeV1Job(job.id);

    // 4. Poll until all batches reach a terminal state
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        if (cancelledRef?.current) throw new Error('Import cancelled by user');

        const batches = await getV1BatchList(job.id);
        const completed = batches.filter(b => TERMINAL_BATCH_STATES.includes(b.state));
        onProgress?.(
            'processing',
            `Processing: ${completed.length}/${batches.length} batches complete...`
        );

        if (completed.length === batches.length) {
            // 5. Fetch results for each batch in parallel
            onProgress?.('fetching-results', 'Fetching results...');
            const results = await Promise.all(
                batches.map(async batch => {
                    if (batch.state === 'NotProcessed') {
                        const originalChunk = batchChunkMap.get(batch.id) ?? '';
                        return {
                            successCsv: 'sf__Id,sf__Created\n',
                            failureCsv: 'sf__Id,sf__Error\n',
                            unprocessedCsv: originalChunk,
                        };
                    }
                    const resultCsv = await getV1BatchResult(job.id, batch.id);
                    const { successCsv, failureCsv } = normalizeV1Results(resultCsv);
                    return { successCsv, failureCsv, unprocessedCsv: '' };
                })
            );

            // 6. Aggregate across all batches
            const allSuccess: string[] = [];
            const allFailure: string[] = [];
            const allUnprocessed: string[] = [];

            for (let i = 0; i < results.length; i++) {
                const { successCsv, failureCsv, unprocessedCsv } = results[i];
                if (i === 0) {
                    allSuccess.push(successCsv);
                    allFailure.push(failureCsv);
                    allUnprocessed.push(unprocessedCsv);
                } else {
                    allSuccess.push(stripCsvHeader(successCsv));
                    allFailure.push(stripCsvHeader(failureCsv));
                    if (unprocessedCsv) allUnprocessed.push(stripCsvHeader(unprocessedCsv));
                }
            }

            const successCsv = allSuccess.join('');
            const failureCsv = allFailure.join('');
            const unprocessedCsv = allUnprocessed.join('');

            onProgress?.(
                'complete',
                `Import complete: ${countCsvRows(successCsv)} succeeded, ${countCsvRows(failureCsv)} failed`
            );

            return {
                successCsv,
                failureCsv,
                unprocessedCsv,
                successCount: countCsvRows(successCsv),
                failureCount: countCsvRows(failureCsv),
                unprocessedCount: countCsvRows(unprocessedCsv),
            };
        }

        await new Promise<void>(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    // Timed out — abort and throw
    await abortV1Job(job.id).catch(() => {
        /* ignore */
    });
    throw new Error('Bulk ingest timed out');
}
