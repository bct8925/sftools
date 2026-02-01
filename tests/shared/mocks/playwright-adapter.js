/**
 * Playwright Route Interception Adapter
 *
 * Intercepts Salesforce API calls via Playwright's page.route() and returns mocked responses.
 * Uses shared mock data factories from mock-data.js.
 */

import { createSalesforceMocks, createMockConnection } from './mock-data.js';

/**
 * MockRouter - Handles route interception for Playwright browser tests
 */
export class MockRouter {
    constructor() {
        this.routes = [];
        this.mockData = createSalesforceMocks();
    }

    /**
     * Set up route interception on a Playwright page or browser context
     * @param {import('playwright').Page|import('playwright').BrowserContext} pageOrContext - Playwright page or context object
     */
    async setup(pageOrContext) {
        // Intercept all Salesforce API requests (both data and tooling APIs)
        // Pattern matches any Salesforce domain variant (.salesforce.com, .my.salesforce.com, etc.)
        // Use context-level routing to catch requests from service workers
        const routeHandler = async route => {
            const request = route.request();
            const url = request.url();
            const method = request.method();

            // Find matching route handler
            const handler = this.findMatchingRoute(url, method);

            if (handler) {
                const mockResponse = handler.response;
                const responseData =
                    typeof mockResponse.data !== 'undefined' ? mockResponse.data : mockResponse;

                // Check if this is a plain text response (e.g., ApexLog Body endpoint)
                const contentType = mockResponse.contentType || 'application/json';
                const body =
                    contentType === 'text/plain' ? responseData : JSON.stringify(responseData);

                await route.fulfill({
                    status: mockResponse.status || 200,
                    contentType,
                    body,
                });
            } else {
                // No mock defined - return empty response to prevent actual API call
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ records: [], totalSize: 0 }),
                });
            }
        };

        await pageOrContext.route(/.*salesforce\.com\/.*/, routeHandler);
    }

    /**
     * Find a matching route handler for the given URL and method
     */
    findMatchingRoute(url, method) {
        return this.routes.find(route => {
            const methodMatches = !route.method || route.method === method;
            const urlMatches =
                route.pattern instanceof RegExp
                    ? route.pattern.test(url)
                    : url.includes(route.pattern);
            return methodMatches && urlMatches;
        });
    }

    /**
     * Add a custom route handler
     * @param {RegExp|string} pattern - URL pattern to match
     * @param {Object} response - Mock response data
     * @param {string} method - HTTP method (GET, POST, etc.)
     */
    addRoute(pattern, response, method = null) {
        this.routes.push({ pattern, response, method });
        return this;
    }

    /**
     * Mock a SOQL query response
     * @param {RegExp|string} queryPattern - Pattern to match the query
     * @param {Array} records - Array of record objects to return
     * @param {Array} columnMetadata - Optional column metadata
     * @param {string} entityName - Optional entity/object name (e.g., 'Account')
     */
    onQuery(queryPattern, records, columnMetadata = null, entityName = null) {
        // Infer entityName from first record's attributes if not provided
        const inferredEntityName = entityName || records[0]?.attributes?.type || null;

        // Query endpoint returns column metadata when columns=true parameter is present
        const metadataResponse = this.mockData.queryResponse(
            [],
            columnMetadata || [],
            inferredEntityName
        );
        const dataResponse = this.mockData.queryResponse(records);

        // Match query requests with columns=true
        this.addRoute(
            /\/services\/data\/v[\d.]+\/query\/?\?.*columns=true/,
            metadataResponse,
            'GET'
        );

        // Match regular query requests
        this.addRoute(
            queryPattern instanceof RegExp ? queryPattern : /\/services\/data\/v[\d.]+\/query/,
            dataResponse,
            'GET'
        );

        return this;
    }

    /**
     * Mock an object describe response
     * @param {string} objectType - Salesforce object type
     * @param {Array} fields - Array of field definitions
     * @param {Array} childRelationships - Array of child relationship definitions
     */
    onDescribe(objectType, fields, childRelationships = []) {
        const response = this.mockData.objectDescribe(objectType, fields, childRelationships);
        this.addRoute(
            new RegExp(`/services/data/v[\\d.]+/sobjects/${objectType}/describe`),
            response,
            'GET'
        );
        return this;
    }

    /**
     * Mock global describe response
     * @param {Array} sobjects - Array of sObject definitions
     */
    onGlobalDescribe(sobjects) {
        const response = this.mockData.globalDescribe(sobjects);
        this.addRoute(/\/services\/data\/v[\d.]+\/sobjects\/?$/, response, 'GET');
        return this;
    }

    /**
     * Mock anonymous Apex execution
     * @param {boolean} compiled - Whether Apex compiled successfully
     * @param {boolean} success - Whether execution succeeded
     * @param {string} log - Debug log content
     */
    onApexExecute(compiled, success, log = '') {
        const response = this.mockData.apexExecutionResponse(compiled, success, log);
        this.addRoute(/\/services\/data\/v[\d.]+\/tooling\/executeAnonymous/, response, 'GET');
        return this;
    }

    /**
     * Mock record retrieval
     * @param {string} objectType - Salesforce object type
     * @param {string} recordId - Record ID
     * @param {Object} record - Record data to return
     */
    onGetRecord(objectType, recordId, record) {
        const response = this.mockData.recordResponse(record);
        this.addRoute(
            new RegExp(`/services/data/v[\\d.]+/sobjects/${objectType}/${recordId}`),
            response,
            'GET'
        );
        return this;
    }

    /**
     * Mock record creation
     * @param {string} objectType - Salesforce object type
     * @param {string} recordId - ID to return
     */
    onCreateRecord(objectType, recordId) {
        const response = this.mockData.createResponse(recordId);
        this.addRoute(
            new RegExp(`/services/data/v[\\d.]+/sobjects/${objectType}$`),
            response,
            'POST'
        );
        return this;
    }

    /**
     * Mock record update
     * @param {string} objectType - Salesforce object type
     * @param {string} recordId - Record ID
     */
    onUpdateRecord(objectType, recordId) {
        const response = { ok: true, status: 204, data: null };
        this.addRoute(
            new RegExp(`/services/data/v[\\d.]+/sobjects/${objectType}/${recordId}`),
            response,
            'PATCH'
        );
        return this;
    }

    /**
     * Mock REST API request
     * @param {string} path - API path
     * @param {string} method - HTTP method
     * @param {Object} response - Response data
     */
    onRestRequest(path, method, response) {
        this.addRoute(new RegExp(path), response, method);
        return this;
    }

    /**
     * Use a preset configuration
     * @param {Object} preset - Preset object with routes
     */
    usePreset(preset) {
        if (preset.routes) {
            preset.routes.forEach(route => {
                this.addRoute(route.pattern, route.response, route.method);
            });
        }
        return this;
    }

    /**
     * Clear all routes
     */
    clear() {
        this.routes = [];
        return this;
    }
}

/**
 * Helper to create a mock connection for injection into extension storage
 */
export function createTestConnection() {
    return createMockConnection({
        id: 'test-connection-' + Date.now(),
        label: 'Test Connection',
        instanceUrl: 'https://test.salesforce.com',
        accessToken: 'mock-access-token',
    });
}
