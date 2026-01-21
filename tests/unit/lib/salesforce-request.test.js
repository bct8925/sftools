/**
 * Tests for src/lib/salesforce-request.js
 *
 * Test IDs: UT-U-009, UT-U-036 through UT-U-055
 * - UT-U-009, UT-U-036: salesforceRequest() - Builds correct URL
 * - UT-U-037: salesforceRequest() - Includes Authorization Bearer header
 * - UT-U-038: salesforceRequest() - Includes Content-Type and Accept headers
 * - UT-U-039: salesforceRequest() - Merges custom headers with defaults
 * - UT-U-040: salesforceRequest() - Uses GET method by default
 * - UT-U-041: salesforceRequest() - Passes method and body from options
 * - UT-U-042: salesforceRequest() - Parses JSON response
 * - UT-U-043: salesforceRequest() - Handles 200 response successfully
 * - UT-U-044: salesforceRequest() - Handles 404 response without throwing
 * - UT-U-045: salesforceRequest() - Returns null json when data is empty
 * - UT-U-046: salesforceRequest() - Throws on CORS error and calls showCorsErrorModal
 * - UT-U-047: salesforceRequest() - Triggers authExpired on 401 without authExpired flag
 * - UT-U-048: salesforceRequest() - Does not trigger authExpired when authExpired flag already set
 * - UT-U-049: salesforceRequest() - Extracts error from response.error
 * - UT-U-050: salesforceRequest() - Extracts error from Salesforce array format [{ message }]
 * - UT-U-051: salesforceRequest() - Extracts error from Salesforce object format { message }
 * - UT-U-052: salesforceRequest() - Uses statusText when data is null
 * - UT-U-053: salesforceRequest() - Falls back to Request failed when data is empty object
 * - UT-U-054: salesforceRequest() - Defaults to "Request failed" when no message available
 * - UT-U-055: salesforceRequest() - Uses statusText from empty data response
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('../../../src/lib/fetch.js', () => ({
    smartFetch: vi.fn()
}));

vi.mock('../../../src/lib/auth.js', () => ({
    getAccessToken: vi.fn(),
    getInstanceUrl: vi.fn(),
    getActiveConnectionId: vi.fn(),
    triggerAuthExpired: vi.fn()
}));

vi.mock('../../../src/lib/cors-detection.js', () => ({
    isCorsError: vi.fn(),
    showCorsErrorModal: vi.fn()
}));

// Import after mocking
import { salesforceRequest } from '../../../src/lib/salesforce-request.js';
import { smartFetch } from '../../../src/lib/fetch.js';
import { getAccessToken, getInstanceUrl, getActiveConnectionId, triggerAuthExpired } from '../../../src/lib/auth.js';
import { isCorsError, showCorsErrorModal } from '../../../src/lib/cors-detection.js';

describe('salesforce-request', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getAccessToken.mockReturnValue('test-token');
        getInstanceUrl.mockReturnValue('https://test.salesforce.com');
        getActiveConnectionId.mockReturnValue('conn-123');
        isCorsError.mockReturnValue(false);
    });

    describe('successful requests', () => {
        it('UT-U-009: builds correct URL', async () => {
            smartFetch.mockResolvedValue({
                success: true,
                status: 200,
                data: '{"result":"ok"}'
            });

            await salesforceRequest('/services/data/v59.0/sobjects');

            expect(smartFetch).toHaveBeenCalledWith(
                'https://test.salesforce.com/services/data/v59.0/sobjects',
                expect.any(Object)
            );
        });

        it('UT-U-036: builds correct URL from instanceUrl and endpoint', async () => {
            smartFetch.mockResolvedValue({
                success: true,
                status: 200,
                data: '{"result":"ok"}'
            });

            await salesforceRequest('/services/data/v59.0/sobjects');

            expect(smartFetch).toHaveBeenCalledWith(
                'https://test.salesforce.com/services/data/v59.0/sobjects',
                expect.any(Object)
            );
        });

        it('UT-U-037: includes Authorization Bearer header', async () => {
            smartFetch.mockResolvedValue({
                success: true,
                status: 200,
                data: '{"result":"ok"}'
            });

            await salesforceRequest('/test');

            expect(smartFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test-token'
                    })
                })
            );
        });

        it('UT-U-038: includes Content-Type and Accept headers', async () => {
            smartFetch.mockResolvedValue({
                success: true,
                status: 200,
                data: '{"result":"ok"}'
            });

            await salesforceRequest('/test');

            expect(smartFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    })
                })
            );
        });

        it('UT-U-039: merges custom headers with defaults', async () => {
            smartFetch.mockResolvedValue({
                success: true,
                status: 200,
                data: '{"result":"ok"}'
            });

            await salesforceRequest('/test', {
                headers: { 'X-Custom-Header': 'custom-value' }
            });

            expect(smartFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test-token',
                        'X-Custom-Header': 'custom-value'
                    })
                })
            );
        });

        it('UT-U-040: uses GET method by default', async () => {
            smartFetch.mockResolvedValue({
                success: true,
                status: 200,
                data: '{"result":"ok"}'
            });

            await salesforceRequest('/test');

            expect(smartFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    method: 'GET'
                })
            );
        });

        it('UT-U-041: passes method and body from options', async () => {
            smartFetch.mockResolvedValue({
                success: true,
                status: 200,
                data: '{"id":"001abc"}'
            });

            await salesforceRequest('/test', {
                method: 'POST',
                body: '{"Name":"Test"}'
            });

            expect(smartFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    method: 'POST',
                    body: '{"Name":"Test"}'
                })
            );
        });

        it('UT-U-042: parses JSON response', async () => {
            smartFetch.mockResolvedValue({
                success: true,
                status: 200,
                data: '{"records":[{"Id":"001"}],"totalSize":1}'
            });

            const result = await salesforceRequest('/test');

            expect(result.json).toEqual({
                records: [{ Id: '001' }],
                totalSize: 1
            });
        });

        it('UT-U-043: handles 200 response successfully', async () => {
            smartFetch.mockResolvedValue({
                success: true,
                status: 200,
                data: '{"success":true}'
            });

            const result = await salesforceRequest('/test');

            expect(result.success).toBe(true);
            expect(result.status).toBe(200);
            expect(result.json).toEqual({ success: true });
        });

        it('UT-U-044: handles 404 response without throwing', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                status: 404,
                data: null
            });

            const result = await salesforceRequest('/test');

            expect(result.status).toBe(404);
            expect(result.json).toBeNull();
        });

        it('UT-U-045: returns null json when data is empty', async () => {
            smartFetch.mockResolvedValue({
                success: true,
                status: 204,
                data: ''
            });

            const result = await salesforceRequest('/test');

            expect(result.json).toBeNull();
        });
    });

    describe('error handling', () => {
        it('UT-U-046: throws on CORS error and calls showCorsErrorModal', async () => {
            isCorsError.mockReturnValue(true);
            smartFetch.mockResolvedValue({
                success: false,
                status: 0,
                error: 'Failed to fetch'
            });

            await expect(salesforceRequest('/test')).rejects.toThrow(
                'CORS error - please configure CORS settings or enable the local proxy'
            );
            expect(showCorsErrorModal).toHaveBeenCalled();
        });

        it('UT-U-047: triggers authExpired on 401 without authExpired flag', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                status: 401,
                error: 'Unauthorized'
            });

            await expect(salesforceRequest('/test')).rejects.toThrow();
            expect(triggerAuthExpired).toHaveBeenCalledWith('conn-123', 'Session expired');
        });

        it('UT-U-048: does not trigger authExpired when authExpired flag already set', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                status: 401,
                authExpired: true,
                error: 'Session expired'
            });

            await expect(salesforceRequest('/test')).rejects.toThrow();
            expect(triggerAuthExpired).not.toHaveBeenCalled();
        });

        it('UT-U-049: extracts error from response.error', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                status: 500,
                error: 'Server error occurred'
            });

            await expect(salesforceRequest('/test')).rejects.toThrow('Server error occurred');
        });

        it('UT-U-050: extracts error from Salesforce array format [{ message }]', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                status: 400,
                data: '[{"message":"Invalid field Id","errorCode":"INVALID_FIELD"}]'
            });

            await expect(salesforceRequest('/test')).rejects.toThrow('Invalid field Id');
        });

        it('UT-U-051: extracts error from Salesforce object format { message }', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                status: 400,
                data: '{"message":"Something went wrong"}'
            });

            await expect(salesforceRequest('/test')).rejects.toThrow('Something went wrong');
        });

        it('UT-U-052: uses statusText when data is null', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                status: 500,
                statusText: 'Internal Server Error',
                data: null
            });

            await expect(salesforceRequest('/test')).rejects.toThrow('Internal Server Error');
        });

        it('UT-U-053: falls back to Request failed when data is empty object', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                status: 500,
                data: '{}'
            });

            await expect(salesforceRequest('/test')).rejects.toThrow('Request failed');
        });

        it('UT-U-054: defaults to "Request failed" when no message available', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                status: 500,
                data: '{}'
            });

            await expect(salesforceRequest('/test')).rejects.toThrow('Request failed');
        });

        it('UT-U-055: uses statusText from empty data response', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                status: 503,
                statusText: 'Service Unavailable',
                data: null
            });

            await expect(salesforceRequest('/test')).rejects.toThrow('Service Unavailable');
        });
    });
});
