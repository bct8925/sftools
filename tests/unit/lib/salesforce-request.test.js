/**
 * Tests for src/lib/salesforce-request.js
 *
 * Test ID: UT-U-009
 * - UT-U-009: salesforceRequest() - Makes authenticated request
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
        it('builds correct URL from instanceUrl and endpoint', async () => {
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

        it('includes Authorization Bearer header', async () => {
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

        it('includes Content-Type and Accept headers', async () => {
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

        it('merges custom headers with defaults', async () => {
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

        it('uses GET method by default', async () => {
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

        it('passes method and body from options', async () => {
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

        it('parses JSON response', async () => {
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

        it('handles 200 response successfully', async () => {
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

        it('handles 404 response without throwing', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                status: 404,
                data: null
            });

            const result = await salesforceRequest('/test');

            expect(result.status).toBe(404);
            expect(result.json).toBeNull();
        });

        it('returns null json when data is empty', async () => {
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
        it('throws on CORS error and calls showCorsErrorModal', async () => {
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

        it('triggers authExpired on 401 without authExpired flag', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                status: 401,
                error: 'Unauthorized'
            });

            await expect(salesforceRequest('/test')).rejects.toThrow();
            expect(triggerAuthExpired).toHaveBeenCalledWith('conn-123', 'Session expired');
        });

        it('does not trigger authExpired when authExpired flag already set', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                status: 401,
                authExpired: true,
                error: 'Session expired'
            });

            await expect(salesforceRequest('/test')).rejects.toThrow();
            expect(triggerAuthExpired).not.toHaveBeenCalled();
        });

        it('extracts error from response.error', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                status: 500,
                error: 'Server error occurred'
            });

            await expect(salesforceRequest('/test')).rejects.toThrow('Server error occurred');
        });

        it('extracts error from Salesforce array format [{ message }]', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                status: 400,
                data: '[{"message":"Invalid field Id","errorCode":"INVALID_FIELD"}]'
            });

            await expect(salesforceRequest('/test')).rejects.toThrow('Invalid field Id');
        });

        it('extracts error from Salesforce object format { message }', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                status: 400,
                data: '{"message":"Something went wrong"}'
            });

            await expect(salesforceRequest('/test')).rejects.toThrow('Something went wrong');
        });

        it('uses statusText when data is null', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                status: 500,
                statusText: 'Internal Server Error',
                data: null
            });

            await expect(salesforceRequest('/test')).rejects.toThrow('Internal Server Error');
        });

        it('falls back to Request failed when data is empty object', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                status: 500,
                data: '{}'
            });

            await expect(salesforceRequest('/test')).rejects.toThrow('Request failed');
        });

        it('defaults to "Request failed" when no message available', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                status: 500,
                data: '{}'
            });

            await expect(salesforceRequest('/test')).rejects.toThrow('Request failed');
        });

        it('uses statusText from empty data response', async () => {
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
