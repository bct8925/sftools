// Bulk Query API v2 - Functions for large data exports

import { getInstanceUrl, getAccessToken } from '../auth/auth';
import { API_VERSION } from './constants';
import { smartFetch } from './fetch';
import { salesforceRequest } from './salesforce-request';

export interface BulkQueryJob {
    id: string;
    state: string;
    numberRecordsProcessed?: number;
    errorMessage?: string;
}

/**
 * Create a Bulk API v2 query job
 */
export async function createBulkQueryJob(
    soql: string,
    includeDeleted = false
): Promise<BulkQueryJob> {
    const response = await salesforceRequest<BulkQueryJob>(
        `/services/data/v${API_VERSION}/jobs/query`,
        {
            method: 'POST',
            body: JSON.stringify({
                operation: includeDeleted ? 'queryAll' : 'query',
                query: soql,
            }),
        }
    );
    if (!response.json) {
        throw new Error('No job data returned from bulk query API');
    }
    return response.json;
}

/**
 * Get the status of a Bulk API v2 query job
 */
export async function getBulkQueryJobStatus(jobId: string): Promise<BulkQueryJob> {
    const response = await salesforceRequest<BulkQueryJob>(
        `/services/data/v${API_VERSION}/jobs/query/${jobId}`
    );
    if (!response.json) {
        throw new Error(`No job status returned for job ${jobId}`);
    }
    return response.json;
}

/**
 * Get the CSV results of a completed Bulk API v2 query job.
 * Handles multi-chunk pagination via the Sforce-Locator response header.
 */
export async function getBulkQueryResults(
    jobId: string,
    onChunkProgress?: (chunksDownloaded: number) => void
): Promise<string> {
    const baseUrl = `${getInstanceUrl()}/services/data/v${API_VERSION}/jobs/query/${jobId}/results`;
    const headers = {
        Authorization: `Bearer ${getAccessToken()}`,
        Accept: 'text/csv',
    };

    const chunks: string[] = [];
    let locator: string | undefined;

    do {
        const url = locator
            ? `${baseUrl}?locator=${locator}&maxRecords=2000`
            : `${baseUrl}?maxRecords=2000`;

        const response = await smartFetch(url, { headers });

        if (!response.success) {
            throw new Error(response.error ?? 'Failed to fetch results');
        }

        const chunk = response.data ?? '';

        if (chunks.length === 0) {
            chunks.push(chunk);
        } else {
            // Strip the CSV header row from subsequent chunks
            const newlineIndex = chunk.indexOf('\n');
            chunks.push(newlineIndex >= 0 ? chunk.slice(newlineIndex + 1) : chunk);
        }

        onChunkProgress?.(chunks.length);

        const nextLocator = response.headers?.['sforce-locator'];
        locator = nextLocator && nextLocator !== 'null' ? nextLocator : undefined;
    } while (locator);

    return chunks.join('');
}

/**
 * Abort a Bulk API v2 query job
 */
export async function abortBulkQueryJob(jobId: string): Promise<void> {
    await salesforceRequest(`/services/data/v${API_VERSION}/jobs/query/${jobId}`, {
        method: 'PATCH',
        body: JSON.stringify({ state: 'Aborted' }),
    });
}

/**
 * Execute a bulk query export with polling
 * Handles job creation, polling, and result retrieval
 */
export async function executeBulkQueryExport(
    soql: string,
    onProgress?: (state: string, recordCount?: number, chunksDownloaded?: number) => void,
    includeDeleted = false
): Promise<string> {
    onProgress?.('Creating job...');
    const job = await createBulkQueryJob(soql, includeDeleted);
    const jobId = job.id;

    const pollInterval = 2000;
    const maxAttempts = 150;
    let attempts = 0;

    while (attempts < maxAttempts) {
        const status = await getBulkQueryJobStatus(jobId);
        onProgress?.(status.state, status.numberRecordsProcessed || 0);

        if (status.state === 'JobComplete') {
            onProgress?.('Downloading...');
            return getBulkQueryResults(jobId, chunksDownloaded => {
                onProgress?.('Downloading...', undefined, chunksDownloaded);
            });
        }

        if (status.state === 'Failed' || status.state === 'Aborted') {
            throw new Error(
                `Bulk query ${status.state.toLowerCase()}: ${status.errorMessage || 'Unknown error'}`
            );
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
        attempts++;
    }

    await abortBulkQueryJob(jobId).catch(() => {
        /* ignore */
    });
    throw new Error('Bulk query timed out');
}
