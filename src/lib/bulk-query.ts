// Bulk Query API v2 - Functions for large data exports

import { API_VERSION } from './utils.js';
import { getInstanceUrl, getAccessToken } from './auth.js';
import { smartFetch } from './fetch.js';
import { salesforceRequest } from './salesforce-request.js';

export interface BulkQueryJob {
    id: string;
    state: string;
    numberRecordsProcessed?: number;
    errorMessage?: string;
}

/**
 * Create a Bulk API v2 query job
 */
export async function createBulkQueryJob(soql: string): Promise<BulkQueryJob> {
    const response = await salesforceRequest<BulkQueryJob>(
        `/services/data/v${API_VERSION}/jobs/query`,
        {
            method: 'POST',
            body: JSON.stringify({
                operation: 'query',
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
 * Get the CSV results of a completed Bulk API v2 query job
 */
export async function getBulkQueryResults(jobId: string): Promise<string> {
    const response = await smartFetch(
        `${getInstanceUrl()}/services/data/v${API_VERSION}/jobs/query/${jobId}/results`,
        {
            headers: {
                Authorization: `Bearer ${getAccessToken()}`,
                Accept: 'text/csv',
            },
        }
    );

    if (!response.success) {
        throw new Error(response.error ?? 'Failed to fetch results');
    }

    return response.data ?? '';
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
    onProgress?: (state: string, recordCount?: number) => void
): Promise<string> {
    onProgress?.('Creating job...');
    const job = await createBulkQueryJob(soql);
    const jobId = job.id;

    const pollInterval = 2000;
    const maxAttempts = 150;
    let attempts = 0;

    while (attempts < maxAttempts) {
        const status = await getBulkQueryJobStatus(jobId);
        onProgress?.(status.state, status.numberRecordsProcessed || 0);

        if (status.state === 'JobComplete') {
            onProgress?.('Downloading...');
            return getBulkQueryResults(jobId);
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
