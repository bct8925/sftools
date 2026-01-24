/**
 * Integration Test Setup
 *
 * Provides Salesforce API client for integration tests that make real API calls.
 * Uses credentials from .env.test file.
 */

import { config } from 'dotenv';

// Load environment variables from .env.test
config({ path: '.env.test' });

const API_VERSION = '62.0';

// Validate required environment variables
const accessToken = process.env.SF_ACCESS_TOKEN;
const instanceUrl = process.env.SF_INSTANCE_URL?.replace(/\/$/, '');

if (!accessToken || !instanceUrl) {
    throw new Error(
        'Missing required environment variables: SF_ACCESS_TOKEN and SF_INSTANCE_URL\n' +
            'Create a .env.test file with your Salesforce credentials.'
    );
}

interface RestResponse {
    status: number;
    statusText: string;
    ok: boolean;
    headers: Record<string, string>;
    body: unknown;
}

interface CreatedRecord {
    objectType: string;
    recordId: string;
}

/**
 * Salesforce API client for integration tests
 */
export const salesforce = {
    accessToken,
    instanceUrl,

    /**
     * Make a REST API request
     */
    async request<T = unknown>(
        method: string,
        path: string,
        body: unknown = null
    ): Promise<T | null> {
        const url = `${instanceUrl}/services/data/v${API_VERSION}${path}`;

        const options: RequestInit = {
            method,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            let errorMessage: string;
            try {
                const errors = await response.json();
                errorMessage = Array.isArray(errors)
                    ? errors.map((e: { message: string }) => e.message).join(', ')
                    : errors.message || JSON.stringify(errors);
            } catch {
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(`Salesforce API error: ${errorMessage}`);
        }

        if (response.status === 204) {
            return null;
        }

        return response.json();
    },

    /**
     * Make a Tooling API request
     */
    async toolingRequest<T = unknown>(
        method: string,
        path: string,
        body: unknown = null
    ): Promise<T | null> {
        const url = `${instanceUrl}/services/data/v${API_VERSION}/tooling${path}`;

        const options: RequestInit = {
            method,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            let errorMessage: string;
            try {
                const errors = await response.json();
                errorMessage = Array.isArray(errors)
                    ? errors.map((e: { message: string }) => e.message).join(', ')
                    : errors.message || JSON.stringify(errors);
            } catch {
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(`Salesforce Tooling API error: ${errorMessage}`);
        }

        if (response.status === 204) {
            return null;
        }

        return response.json();
    },

    /**
     * Execute a SOQL query
     */
    async query<T = unknown>(soql: string): Promise<T[]> {
        const response = await this.request<{ records?: T[] }>(
            'GET',
            `/query?q=${encodeURIComponent(soql)}`
        );
        return response?.records || [];
    },

    /**
     * Execute a Tooling API query
     */
    async toolingQuery<T = unknown>(soql: string): Promise<T[]> {
        const response = await this.toolingRequest<{ records?: T[] }>(
            'GET',
            `/query?q=${encodeURIComponent(soql)}`
        );
        return response?.records || [];
    },

    /**
     * Create a record
     */
    async createRecord(objectType: string, fields: Record<string, unknown>): Promise<string> {
        const response = await this.request<{ id: string }>(
            'POST',
            `/sobjects/${objectType}`,
            fields
        );
        return response!.id;
    },

    /**
     * Get a record by ID
     */
    async getRecord<T = unknown>(
        objectType: string,
        recordId: string,
        fields: string[] | null = null
    ): Promise<T> {
        let path = `/sobjects/${objectType}/${recordId}`;
        if (fields && fields.length > 0) {
            path += `?fields=${fields.join(',')}`;
        }
        return this.request<T>('GET', path) as Promise<T>;
    },

    /**
     * Update a record
     */
    async updateRecord(
        objectType: string,
        recordId: string,
        fields: Record<string, unknown>
    ): Promise<void> {
        await this.request('PATCH', `/sobjects/${objectType}/${recordId}`, fields);
    },

    /**
     * Delete a record
     */
    async deleteRecord(objectType: string, recordId: string): Promise<void> {
        await this.request('DELETE', `/sobjects/${objectType}/${recordId}`);
    },

    /**
     * Get object describe
     */
    async describeObject<T = unknown>(objectType: string): Promise<T> {
        return this.request<T>('GET', `/sobjects/${objectType}/describe`) as Promise<T>;
    },

    /**
     * Get global describe
     */
    async describeGlobal<T = unknown>(): Promise<T> {
        return this.request<T>('GET', '/sobjects') as Promise<T>;
    },

    /**
     * Execute anonymous Apex
     */
    async executeAnonymousApex<T = unknown>(code: string): Promise<T> {
        const response = await this.toolingRequest<T>(
            'GET',
            `/executeAnonymous/?anonymousBody=${encodeURIComponent(code)}`
        );
        return response as T;
    },

    /**
     * Get current user info
     */
    async getCurrentUser<T = unknown>(): Promise<T> {
        return this.request<T>('GET', '/chatter/users/me') as Promise<T>;
    },

    /**
     * Make a generic REST request (for REST API tab tests)
     */
    async restRequest(
        path: string,
        method = 'GET',
        body: string | Record<string, unknown> | null = null
    ): Promise<RestResponse> {
        const url = `${instanceUrl}${path}`;

        const options: RequestInit = {
            method,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        };

        if (body) {
            options.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        const response = await fetch(url, options);

        return {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries()),
            body: await response.text().then(text => {
                try {
                    return JSON.parse(text);
                } catch {
                    return text;
                }
            }),
        };
    },
};

/**
 * Test data cleanup tracker
 */
export class TestDataManager {
    private createdRecords: CreatedRecord[] = [];

    /**
     * Track a created record for cleanup
     */
    track(objectType: string, recordId: string): void {
        this.createdRecords.push({ objectType, recordId });
    }

    /**
     * Create a record and track it
     */
    async create(objectType: string, fields: Record<string, unknown>): Promise<string> {
        const id = await salesforce.createRecord(objectType, fields);
        this.track(objectType, id);
        return id;
    }

    /**
     * Clean up all tracked records (call in afterEach/afterAll)
     */
    async cleanup(): Promise<void> {
        // Delete in reverse order (children before parents)
        for (const { objectType, recordId } of this.createdRecords.reverse()) {
            try {
                await salesforce.deleteRecord(objectType, recordId);
            } catch (e) {
                // Ignore errors - record may already be deleted
                console.warn(
                    `Warning: Failed to delete ${objectType}/${recordId}: ${(e as Error).message}`
                );
            }
        }
        this.createdRecords = [];
    }
}

/**
 * Helper to generate unique test names
 */
export function uniqueName(prefix = 'IntTest'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

interface WaitForOptions {
    timeout?: number;
    interval?: number;
    message?: string;
}

/**
 * Helper to wait for a condition (with timeout)
 */
export async function waitFor(
    conditionFn: () => Promise<boolean> | boolean,
    options: WaitForOptions = {}
): Promise<boolean> {
    const { timeout = 30000, interval = 1000, message = 'Condition not met' } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        if (await conditionFn()) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`${message} (timeout: ${timeout}ms)`);
}
