/**
 * Integration tests for Bulk Query API v2
 *
 * Test IDs: BQ-I-001 through BQ-I-007
 *
 * These tests verify Salesforce Bulk API v2 behavior for large data exports.
 * Tests use real API calls against a test org.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { salesforce, waitFor } from './setup.js';

const API_VERSION = '62.0';

interface BulkQueryJob {
    id: string;
    operation: string;
    object: string;
    createdById: string;
    createdDate: string;
    systemModstamp: string;
    state: string;
    concurrencyMode: string;
    contentType: string;
    apiVersion: number;
    lineEnding: string;
    columnDelimiter: string;
    numberRecordsProcessed?: number;
    retries?: number;
    totalProcessingTime?: number;
    errorMessage?: string;
}

/**
 * Create a Bulk API v2 query job
 */
async function createBulkQueryJob(soql: string): Promise<BulkQueryJob> {
    const url = `${salesforce.instanceUrl}/services/data/v${API_VERSION}/jobs/query`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${salesforce.accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            operation: 'query',
            query: soql,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(
            `Failed to create bulk query job: ${Array.isArray(error) ? error[0]?.message : error.message || JSON.stringify(error)}`
        );
    }

    return response.json();
}

/**
 * Get the status of a Bulk API v2 query job
 */
async function getBulkQueryJobStatus(jobId: string): Promise<BulkQueryJob> {
    const url = `${salesforce.instanceUrl}/services/data/v${API_VERSION}/jobs/query/${jobId}`;

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${salesforce.accessToken}`,
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to get job status: ${error.message || JSON.stringify(error)}`);
    }

    return response.json();
}

/**
 * Get the CSV results of a completed Bulk API v2 query job
 */
async function getBulkQueryResults(jobId: string): Promise<string> {
    const url = `${salesforce.instanceUrl}/services/data/v${API_VERSION}/jobs/query/${jobId}/results`;

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${salesforce.accessToken}`,
            Accept: 'text/csv',
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get results: ${error}`);
    }

    return response.text();
}

/**
 * Abort a Bulk API v2 query job
 */
async function abortBulkQueryJob(jobId: string): Promise<void> {
    const url = `${salesforce.instanceUrl}/services/data/v${API_VERSION}/jobs/query/${jobId}`;

    const response = await fetch(url, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${salesforce.accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state: 'Aborted' }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to abort job: ${error.message || JSON.stringify(error)}`);
    }
}

/**
 * Wait for a bulk query job to complete
 */
async function waitForJobCompletion(
    jobId: string,
    options: { timeout?: number; interval?: number } = {}
): Promise<BulkQueryJob> {
    const { timeout = 60000, interval = 2000 } = options;
    let finalStatus: BulkQueryJob | null = null;

    await waitFor(
        async () => {
            finalStatus = await getBulkQueryJobStatus(jobId);
            return ['JobComplete', 'Failed', 'Aborted'].includes(finalStatus.state);
        },
        { timeout, interval, message: `Job ${jobId} did not complete` }
    );

    return finalStatus!;
}

describe('Bulk Query API v2 Integration', () => {
    // Track jobs for cleanup
    const createdJobIds: string[] = [];

    // Cleanup any created jobs after each test
    afterEach(async () => {
        for (const jobId of createdJobIds) {
            try {
                const status = await getBulkQueryJobStatus(jobId);
                if (!['JobComplete', 'Failed', 'Aborted'].includes(status.state)) {
                    await abortBulkQueryJob(jobId);
                }
            } catch {
                // Ignore cleanup errors
            }
        }
        createdJobIds.length = 0;
    });

    describe('BQ-I-001: Create bulk query job for valid SOQL', () => {
        it('creates a job and returns job metadata', async () => {
            const job = await createBulkQueryJob('SELECT Id, Name FROM Account LIMIT 10');
            createdJobIds.push(job.id);

            expect(job).toHaveProperty('id');
            expect(job.id).toBeTruthy();
            expect(job.operation).toBe('query');
            expect(job.state).toMatch(/UploadComplete|InProgress|JobComplete/);
            expect(job.contentType).toBe('CSV');
            expect(job.columnDelimiter).toBe('COMMA');
        });
    });

    describe('BQ-I-002: Poll job status until completion', () => {
        it('job transitions to JobComplete state', async () => {
            const job = await createBulkQueryJob('SELECT Id FROM Account LIMIT 5');
            createdJobIds.push(job.id);

            const finalStatus = await waitForJobCompletion(job.id);

            expect(finalStatus.state).toBe('JobComplete');
            expect(finalStatus.numberRecordsProcessed).toBeGreaterThanOrEqual(0);
        });

        it('reports progress during processing', async () => {
            const job = await createBulkQueryJob('SELECT Id, Name FROM Account LIMIT 100');
            createdJobIds.push(job.id);

            // Poll and collect states
            const states: string[] = [];
            let status = await getBulkQueryJobStatus(job.id);
            states.push(status.state);

            while (!['JobComplete', 'Failed', 'Aborted'].includes(status.state)) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                status = await getBulkQueryJobStatus(job.id);
                if (!states.includes(status.state)) {
                    states.push(status.state);
                }
            }

            // Should see progression through states
            expect(states).toContain('JobComplete');
            expect(status.numberRecordsProcessed).toBeDefined();
        });
    });

    describe('BQ-I-003: Retrieve CSV results for completed job', () => {
        it('returns CSV data with headers and records', async () => {
            const job = await createBulkQueryJob('SELECT Id, Name FROM Account LIMIT 5');
            createdJobIds.push(job.id);

            await waitForJobCompletion(job.id);
            const csv = await getBulkQueryResults(job.id);

            // CSV should have headers
            expect(csv).toContain('Id');
            expect(csv).toContain('Name');

            // Parse CSV
            const lines = csv.trim().split('\n');
            expect(lines.length).toBeGreaterThanOrEqual(1); // At least header row

            // Verify header format
            const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
            expect(headers).toContain('Id');
            expect(headers).toContain('Name');
        });

        it('returns correct number of records', async () => {
            // Query for specific count
            const job = await createBulkQueryJob('SELECT Id FROM Account LIMIT 3');
            createdJobIds.push(job.id);

            const finalStatus = await waitForJobCompletion(job.id);
            const csv = await getBulkQueryResults(job.id);

            const lines = csv.trim().split('\n');
            const dataRowCount = lines.length - 1; // Subtract header row

            expect(dataRowCount).toBe(finalStatus.numberRecordsProcessed);
        });
    });

    describe('BQ-I-004: Abort in-progress job', () => {
        it('transitions job to Aborted state', async () => {
            // Create a job with a larger query to have time to abort
            const job = await createBulkQueryJob('SELECT Id, Name, CreatedDate FROM Account');
            createdJobIds.push(job.id);

            // Immediately try to abort
            try {
                await abortBulkQueryJob(job.id);
            } catch {
                // Job may have already completed - that's fine
            }

            const status = await getBulkQueryJobStatus(job.id);

            // Job should be either Aborted or already completed
            expect(['Aborted', 'JobComplete']).toContain(status.state);
        });
    });

    describe('BQ-I-005: Handle invalid SOQL error', () => {
        it('throws error for invalid field name', async () => {
            await expect(async () => {
                await createBulkQueryJob('SELECT InvalidField__xyz FROM Account');
            }).rejects.toThrow(/No such column|InvalidField/i);
        });

        it('throws error for invalid object name', async () => {
            await expect(async () => {
                await createBulkQueryJob('SELECT Id FROM NonExistentObject__xyz');
            }).rejects.toThrow(/sObject type.*is not supported|doesn't exist/i);
        });

        it('throws error for malformed SOQL syntax', async () => {
            await expect(async () => {
                await createBulkQueryJob('SELEC Id FROM Account');
            }).rejects.toThrow();
        });
    });

    describe('BQ-I-006: End-to-end bulk export workflow', () => {
        it('creates job, polls, and retrieves results', async () => {
            // Create job
            const job = await createBulkQueryJob(
                'SELECT Id, Name, Industry, Type FROM Account LIMIT 10'
            );
            createdJobIds.push(job.id);

            expect(job.id).toBeTruthy();

            // Poll until complete
            const finalStatus = await waitForJobCompletion(job.id, { timeout: 60000 });
            expect(finalStatus.state).toBe('JobComplete');

            // Get results
            const csv = await getBulkQueryResults(job.id);

            // Verify CSV structure
            const lines = csv.trim().split('\n');
            expect(lines.length).toBeGreaterThanOrEqual(1);

            const headers = lines[0];
            expect(headers).toContain('Id');
            expect(headers).toContain('Name');
            expect(headers).toContain('Industry');
            expect(headers).toContain('Type');
        });
    });

    describe('BQ-I-007: Job metadata and progress tracking', () => {
        it('tracks record count during processing', async () => {
            const job = await createBulkQueryJob('SELECT Id FROM Account LIMIT 50');
            createdJobIds.push(job.id);

            const finalStatus = await waitForJobCompletion(job.id);

            // Job should report records processed
            expect(finalStatus.numberRecordsProcessed).toBeDefined();
            expect(typeof finalStatus.numberRecordsProcessed).toBe('number');
        });

        it('includes timing metadata', async () => {
            const job = await createBulkQueryJob('SELECT Id FROM Account LIMIT 10');
            createdJobIds.push(job.id);

            const finalStatus = await waitForJobCompletion(job.id);

            // Job should have timing info
            expect(finalStatus.createdDate).toBeTruthy();
            expect(finalStatus.systemModstamp).toBeTruthy();
        });

        it('returns consistent job properties', async () => {
            const job = await createBulkQueryJob('SELECT Id FROM Account LIMIT 5');
            createdJobIds.push(job.id);

            // Verify job properties
            expect(job.operation).toBe('query');
            expect(job.contentType).toBe('CSV');
            expect(job.lineEnding).toBe('LF');
            expect(job.columnDelimiter).toBe('COMMA');
            expect(job.apiVersion).toBeGreaterThanOrEqual(50);
        });
    });
});
