/**
 * Integration tests for REST API Tab
 *
 * Test IDs: R-I-001 through R-I-008
 *
 * These tests verify the Salesforce REST API behavior that the REST API tab relies on.
 * Tests make real API calls against a test org.
 *
 * Coverage:
 * - R-I-001: GET /services/data - Returns API versions
 * - R-I-002: POST to sobjects - Creates record
 * - R-I-003: Invalid JSON in body - API error response
 * - R-I-006: Non-JSON response - Raw text displayed for HTML endpoints
 * - R-I-007: HTTP 400 error - Error response with details (multiple scenarios)
 *
 * Skipped (cannot reliably test):
 * - R-I-004: Empty URL - Client-side validation (not API behavior)
 * - R-I-005: Not authenticated - Would require invalid token setup
 * - R-I-008: HTTP 500 error - Cannot reliably trigger server errors
 *
 * Additional coverage beyond TEST_SCENARIOS.md:
 * - PATCH updates existing record
 * - GET retrieves record by ID with all fields
 * - DELETE removes record
 * - Response headers verification (content-type, request-id)
 * - SOQL query via REST endpoint
 */
import { describe, it, expect, afterEach } from 'vitest';
import { salesforce, TestDataManager, uniqueName } from './setup.js';

describe('REST API Tab Integration', () => {
    const testData = new TestDataManager();

    afterEach(async () => {
        await testData.cleanup();
    });

    describe('R-I-001: GET /services/data', () => {
        it('returns API versions', async () => {
            const result = await salesforce.restRequest('/services/data', 'GET');

            expect(result.ok).toBe(true);
            expect(result.status).toBe(200);
            expect(Array.isArray(result.body)).toBe(true);
            expect(result.body.length).toBeGreaterThan(0);

            // Verify version structure
            const latestVersion = result.body[0];
            expect(latestVersion).toHaveProperty('version');
            expect(latestVersion).toHaveProperty('url');
            expect(latestVersion).toHaveProperty('label');
        });
    });

    describe('R-I-002: POST to sobjects', () => {
        it('creates record and returns ID', async () => {
            const accountName = uniqueName('RestApiTest');

            const result = await salesforce.restRequest(
                `/services/data/v62.0/sobjects/Account`,
                'POST',
                { Name: accountName }
            );

            expect(result.ok).toBe(true);
            expect(result.status).toBe(201);
            expect(result.body).toHaveProperty('id');
            expect(result.body).toHaveProperty('success');
            expect(result.body.success).toBe(true);

            // Track for cleanup
            testData.track('Account', result.body.id);

            // Verify record exists
            const record = await salesforce.getRecord('Account', result.body.id, ['Name']);
            expect(record.Name).toBe(accountName);
        });
    });

    describe('R-I-003: Invalid JSON in body', () => {
        it('returns error from Salesforce API', async () => {
            // Send malformed JSON string (API will reject this)
            const result = await salesforce.restRequest(
                `/services/data/v62.0/sobjects/Account`,
                'POST',
                'invalid json {'
            );

            // Salesforce rejects malformed JSON
            expect(result.ok).toBe(false);
            expect(result.status).toBeGreaterThanOrEqual(400);
        });
    });

    describe('R-I-006: Non-JSON response', () => {
        it('returns raw text for HTML/binary endpoints', async () => {
            // Request an endpoint that returns non-JSON (e.g., static resources or login page)
            // The /services/data endpoint without a version returns an HTML error page
            const result = await salesforce.restRequest(
                `/invalid-endpoint-that-returns-html`,
                'GET'
            );

            // Should get a non-JSON response (either HTML or plain text)
            expect(typeof result.body).toBe('string');

            // Verify it's not valid JSON (if it were JSON, restRequest would have parsed it)
            // The fact that body is a string and not an object proves it's non-JSON
            expect(result.body.length).toBeGreaterThan(0);

            // Should contain some HTML-like content (table, div, html, etc.)
            const hasHtmlLikeContent =
                result.body.includes('<table') ||
                result.body.includes('<div') ||
                result.body.includes('<html') ||
                result.body.includes('<HTML') ||
                result.body.includes('<!DOCTYPE');

            expect(hasHtmlLikeContent).toBe(true);
        });
    });

    describe('R-I-007: HTTP 400 error', () => {
        it('returns error response with details', async () => {
            // Send invalid request (missing required field)
            const result = await salesforce.restRequest(
                `/services/data/v62.0/sobjects/Account`,
                'POST',
                {} // Missing required Name field
            );

            expect(result.ok).toBe(false);
            expect(result.status).toBe(400);

            // Verify error structure
            expect(Array.isArray(result.body)).toBe(true);
            expect(result.body.length).toBeGreaterThan(0);
            expect(result.body[0]).toHaveProperty('message');
            expect(result.body[0]).toHaveProperty('errorCode');
        });
    });

    describe('R-I-007: HTTP 400 error - Additional scenarios', () => {
        it('returns error for invalid field name', async () => {
            const accountName = uniqueName('RestApiTest');

            const result = await salesforce.restRequest(
                `/services/data/v62.0/sobjects/Account`,
                'POST',
                {
                    Name: accountName,
                    InvalidFieldName__c: 'test' // Field doesn't exist
                }
            );

            expect(result.ok).toBe(false);
            expect(result.status).toBe(400);
            expect(Array.isArray(result.body)).toBe(true);
            expect(result.body[0]).toHaveProperty('message');
        });

        it('returns error for invalid record ID in PATCH', async () => {
            const result = await salesforce.restRequest(
                `/services/data/v62.0/sobjects/Account/001INVALID000`,
                'PATCH',
                { Name: 'Updated Name' }
            );

            expect(result.ok).toBe(false);
            expect(result.status).toBe(404);
            expect(Array.isArray(result.body)).toBe(true);
            expect(result.body[0]).toHaveProperty('errorCode');
        });
    });

    describe('Additional REST API operations', () => {
        it('PATCH updates existing record', async () => {
            // Create a record first
            const accountName = uniqueName('RestApiTest');
            const createResult = await salesforce.restRequest(
                `/services/data/v62.0/sobjects/Account`,
                'POST',
                { Name: accountName }
            );
            const accountId = createResult.body.id;
            testData.track('Account', accountId);

            // Update the record
            const updatedName = uniqueName('RestApiUpdated');
            const updateResult = await salesforce.restRequest(
                `/services/data/v62.0/sobjects/Account/${accountId}`,
                'PATCH',
                { Name: updatedName }
            );

            expect(updateResult.ok).toBe(true);
            expect(updateResult.status).toBe(204);

            // Verify update
            const record = await salesforce.getRecord('Account', accountId, ['Name']);
            expect(record.Name).toBe(updatedName);
        });

        it('GET retrieves record by ID', async () => {
            // Create a record
            const accountName = uniqueName('RestApiTest');
            const createResult = await salesforce.restRequest(
                `/services/data/v62.0/sobjects/Account`,
                'POST',
                { Name: accountName }
            );
            const accountId = createResult.body.id;
            testData.track('Account', accountId);

            // Retrieve it
            const getResult = await salesforce.restRequest(
                `/services/data/v62.0/sobjects/Account/${accountId}`,
                'GET'
            );

            expect(getResult.ok).toBe(true);
            expect(getResult.status).toBe(200);
            expect(getResult.body).toHaveProperty('Id');
            expect(getResult.body.Id).toBe(accountId);
            expect(getResult.body.Name).toBe(accountName);
        });

        it('DELETE removes record', async () => {
            // Create a record
            const accountName = uniqueName('RestApiTest');
            const createResult = await salesforce.restRequest(
                `/services/data/v62.0/sobjects/Account`,
                'POST',
                { Name: accountName }
            );
            const accountId = createResult.body.id;

            // Delete it
            const deleteResult = await salesforce.restRequest(
                `/services/data/v62.0/sobjects/Account/${accountId}`,
                'DELETE'
            );

            expect(deleteResult.ok).toBe(true);
            expect(deleteResult.status).toBe(204);

            // Verify it's gone (should get 404)
            const getResult = await salesforce.restRequest(
                `/services/data/v62.0/sobjects/Account/${accountId}`,
                'GET'
            );
            expect(getResult.ok).toBe(false);
            expect(getResult.status).toBe(404);
        });
    });

    describe('Response headers', () => {
        it('includes content-type header', async () => {
            const result = await salesforce.restRequest('/services/data', 'GET');

            expect(result.headers).toHaveProperty('content-type');
            expect(result.headers['content-type']).toContain('application/json');
        });

        it('includes salesforce request ID header', async () => {
            const result = await salesforce.restRequest('/services/data', 'GET');

            // Salesforce includes a unique request ID header
            const hasRequestId = Object.keys(result.headers).some(
                key => key.toLowerCase().includes('request-id') ||
                       key.toLowerCase().includes('requestid')
            );
            expect(hasRequestId).toBe(true);
        });
    });

    describe('Query via REST', () => {
        it('executes SOQL query via REST endpoint', async () => {
            const result = await salesforce.restRequest(
                `/services/data/v62.0/query?q=${encodeURIComponent('SELECT Id, Name FROM Account LIMIT 1')}`,
                'GET'
            );

            expect(result.ok).toBe(true);
            expect(result.status).toBe(200);
            expect(result.body).toHaveProperty('records');
            expect(result.body).toHaveProperty('totalSize');
            expect(result.body).toHaveProperty('done');
        });
    });
});
