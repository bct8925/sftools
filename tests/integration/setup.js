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

/**
 * Salesforce API client for integration tests
 */
export const salesforce = {
    accessToken,
    instanceUrl,

    /**
     * Make a REST API request
     */
    async request(method, path, body = null) {
        const url = `${instanceUrl}/services/data/v${API_VERSION}${path}`;

        const options = {
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
            let errorMessage;
            try {
                const errors = await response.json();
                errorMessage = Array.isArray(errors)
                    ? errors.map(e => e.message).join(', ')
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
    async toolingRequest(method, path, body = null) {
        const url = `${instanceUrl}/services/data/v${API_VERSION}/tooling${path}`;

        const options = {
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
            let errorMessage;
            try {
                const errors = await response.json();
                errorMessage = Array.isArray(errors)
                    ? errors.map(e => e.message).join(', ')
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
    async query(soql) {
        const response = await this.request('GET', `/query?q=${encodeURIComponent(soql)}`);
        return response.records || [];
    },

    /**
     * Execute a Tooling API query
     */
    async toolingQuery(soql) {
        const response = await this.toolingRequest('GET', `/query?q=${encodeURIComponent(soql)}`);
        return response.records || [];
    },

    /**
     * Create a record
     */
    async createRecord(objectType, fields) {
        const response = await this.request('POST', `/sobjects/${objectType}`, fields);
        return response.id;
    },

    /**
     * Get a record by ID
     */
    async getRecord(objectType, recordId, fields = null) {
        let path = `/sobjects/${objectType}/${recordId}`;
        if (fields && fields.length > 0) {
            path += `?fields=${fields.join(',')}`;
        }
        return this.request('GET', path);
    },

    /**
     * Update a record
     */
    async updateRecord(objectType, recordId, fields) {
        await this.request('PATCH', `/sobjects/${objectType}/${recordId}`, fields);
    },

    /**
     * Delete a record
     */
    async deleteRecord(objectType, recordId) {
        await this.request('DELETE', `/sobjects/${objectType}/${recordId}`);
    },

    /**
     * Get object describe
     */
    async describeObject(objectType) {
        return this.request('GET', `/sobjects/${objectType}/describe`);
    },

    /**
     * Get global describe
     */
    async describeGlobal() {
        return this.request('GET', '/sobjects');
    },

    /**
     * Execute anonymous Apex
     */
    async executeAnonymousApex(code) {
        const response = await this.toolingRequest(
            'GET',
            `/executeAnonymous/?anonymousBody=${encodeURIComponent(code)}`
        );
        return response;
    },

    /**
     * Get current user info
     */
    async getCurrentUser() {
        return this.request('GET', '/chatter/users/me');
    },

    /**
     * Make a generic REST request (for REST API tab tests)
     */
    async restRequest(path, method = 'GET', body = null) {
        const url = `${instanceUrl}${path}`;

        const options = {
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
    constructor() {
        this.createdRecords = [];
    }

    /**
     * Track a created record for cleanup
     */
    track(objectType, recordId) {
        this.createdRecords.push({ objectType, recordId });
    }

    /**
     * Create a record and track it
     */
    async create(objectType, fields) {
        const id = await salesforce.createRecord(objectType, fields);
        this.track(objectType, id);
        return id;
    }

    /**
     * Clean up all tracked records (call in afterEach/afterAll)
     */
    async cleanup() {
        // Delete in reverse order (children before parents)
        for (const { objectType, recordId } of this.createdRecords.reverse()) {
            try {
                await salesforce.deleteRecord(objectType, recordId);
            } catch (e) {
                // Ignore errors - record may already be deleted
                console.warn(`Warning: Failed to delete ${objectType}/${recordId}: ${e.message}`);
            }
        }
        this.createdRecords = [];
    }
}

/**
 * Helper to generate unique test names
 */
export function uniqueName(prefix = 'IntTest') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Helper to wait for a condition (with timeout)
 */
export async function waitFor(conditionFn, options = {}) {
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
