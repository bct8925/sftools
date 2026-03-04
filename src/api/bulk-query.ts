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

interface ResultChunk {
    resultLink: string;
}

interface ResultPagesResponse {
    resultChunks: ResultChunk[];
    nextRecordsUrl?: string;
    done: boolean;
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
 * Collect all result page URLs for a completed Bulk API v2 query job.
 * Sequentially paginates through the /resultPages endpoint, which returns
 * locators in the JSON response body (works through CORS unlike Sforce-Locator header).
 */
async function getAllResultPageUrls(jobId: string): Promise<string[]> {
    const instanceUrl = getInstanceUrl();
    const urls: string[] = [];
    let nextUrl: string | undefined =
        `/services/data/v${API_VERSION}/jobs/query/${jobId}/resultPages`;

    while (nextUrl) {
        const response: { json: ResultPagesResponse | null } =
            await salesforceRequest<ResultPagesResponse>(nextUrl);
        if (!response.json || !Array.isArray(response.json.resultChunks)) {
            throw new Error(`Unexpected response from resultPages endpoint for job ${jobId}`);
        }

        for (const chunk of response.json.resultChunks) {
            urls.push(`${instanceUrl}/services/data/v${API_VERSION}${chunk.resultLink}`);
        }

        // nextRecordsUrl omits the /services/data/vXX.X prefix
        nextUrl = response.json.done
            ? undefined
            : `/services/data/v${API_VERSION}${response.json.nextRecordsUrl}`;
    }

    return urls;
}

/**
 * Get the CSV results of a completed Bulk API v2 query job.
 * Uses the /resultPages endpoint to discover all result URLs, then fetches
 * all CSV pages in parallel for faster downloads.
 */
export async function getBulkQueryResults(
    jobId: string,
    onChunkProgress?: (totalRows: number) => void
): Promise<string> {
    const resultUrls = await getAllResultPageUrls(jobId);

    if (resultUrls.length === 0) {
        return '';
    }

    const headers = {
        Authorization: `Bearer ${getAccessToken()}`,
        Accept: 'text/csv',
    };

    // Fetch all CSV pages in parallel, reporting progress as each completes in order.
    // Each slot resolves independently; we await them in index order so progress
    // is reported incrementally as the next sequential chunk becomes available.
    const fetchPromises = resultUrls.map(async url => {
        const response = await smartFetch(url, { headers });
        if (!response.success) {
            throw new Error(response.error ?? 'Failed to fetch results');
        }
        return response.data ?? '';
    });

    const chunks: string[] = [];
    let totalRows = 0;

    for (let i = 0; i < fetchPromises.length; i++) {
        const chunk = await fetchPromises[i];

        if (i === 0) {
            chunks.push(chunk);
            const lines = chunk.split('\n').filter(l => l.length > 0).length;
            totalRows += Math.max(0, lines - 1);
        } else {
            const newlineIndex = chunk.indexOf('\n');
            const strippedChunk = newlineIndex >= 0 ? chunk.slice(newlineIndex + 1) : chunk;
            chunks.push(strippedChunk);
            totalRows += strippedChunk.split('\n').filter(l => l.length > 0).length;
        }

        onChunkProgress?.(totalRows);
    }

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
    onProgress?: (state: string, recordCount?: number, totalRecords?: number) => void,
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
            const totalRecords = status.numberRecordsProcessed || 0;
            return getBulkQueryResults(jobId, rowsDownloaded => {
                onProgress?.('Downloading', rowsDownloaded, totalRecords);
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
