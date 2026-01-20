/**
 * Tests for src/lib/cors-detection.js
 *
 * Test IDs: UT-U-005, UT-U-006, UT-U-056 through UT-U-067
 * - UT-U-005: isCorsError() - Detects status 0
 * - UT-U-006: showCorsErrorModal() - Dispatches event
 * - UT-U-056: isCorsError() - Returns true for status 0 with "failed to fetch" error
 * - UT-U-057: isCorsError() - Returns true for error containing "cors" keyword
 * - UT-U-058: isCorsError() - Returns true for error containing "cross-origin" keyword
 * - UT-U-059: isCorsError() - Returns true for error containing "access-control" keyword
 * - UT-U-060: isCorsError() - Is case-insensitive for keyword detection
 * - UT-U-061: isCorsError() - Returns false for successful responses
 * - UT-U-062: isCorsError() - Returns false for 401 Unauthorized errors
 * - UT-U-063: isCorsError() - Returns false for 500 server errors without CORS keywords
 * - UT-U-064: isCorsError() - Returns false for 404 not found errors
 * - UT-U-065: isCorsError() - Handles missing error property gracefully
 * - UT-U-066: isCorsError() - Handles null error property gracefully
 * - UT-U-067: isCorsError() - Requires both status 0 and "failed to fetch" for network error detection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isCorsError, showCorsErrorModal } from '../../../src/lib/cors-detection.js';

describe('cors-detection', () => {
    describe('isCorsError', () => {
        it('UT-U-056: returns true for status 0 with "failed to fetch" error', () => {
            const response = {
                success: false,
                status: 0,
                error: 'Failed to fetch'
            };

            expect(isCorsError(response)).toBe(true);
        });

        it('UT-U-057: returns true for error containing "cors" keyword', () => {
            const response = {
                success: false,
                status: 500,
                error: 'CORS policy blocked the request'
            };

            expect(isCorsError(response)).toBe(true);
        });

        it('UT-U-058: returns true for error containing "cross-origin" keyword', () => {
            const response = {
                success: false,
                status: 403,
                error: 'Cross-origin request blocked'
            };

            expect(isCorsError(response)).toBe(true);
        });

        it('UT-U-059: returns true for error containing "access-control" keyword', () => {
            const response = {
                success: false,
                status: 0,
                error: 'Access-Control-Allow-Origin header missing'
            };

            expect(isCorsError(response)).toBe(true);
        });

        it('UT-U-060: is case-insensitive for keyword detection', () => {
            const responses = [
                { success: false, status: 500, error: 'CORS error' },
                { success: false, status: 500, error: 'cors error' },
                { success: false, status: 500, error: 'Cors Error' }
            ];

            for (const response of responses) {
                expect(isCorsError(response)).toBe(true);
            }
        });

        it('UT-U-061: returns false for successful responses', () => {
            const response = {
                success: true,
                status: 200,
                error: ''
            };

            expect(isCorsError(response)).toBe(false);
        });

        it('UT-U-062: returns false for 401 Unauthorized errors', () => {
            const response = {
                success: false,
                status: 401,
                error: 'Session expired or invalid'
            };

            expect(isCorsError(response)).toBe(false);
        });

        it('UT-U-063: returns false for 500 server errors without CORS keywords', () => {
            const response = {
                success: false,
                status: 500,
                error: 'Internal server error'
            };

            expect(isCorsError(response)).toBe(false);
        });

        it('UT-U-064: returns false for 404 not found errors', () => {
            const response = {
                success: false,
                status: 404,
                error: 'Resource not found'
            };

            expect(isCorsError(response)).toBe(false);
        });

        it('UT-U-065: handles missing error property gracefully', () => {
            const response = {
                success: false,
                status: 500
            };

            expect(isCorsError(response)).toBe(false);
        });

        it('UT-U-066: handles null error property gracefully', () => {
            const response = {
                success: false,
                status: 0,
                error: null
            };

            expect(isCorsError(response)).toBe(false);
        });

        it('UT-U-067: requires both status 0 and "failed to fetch" for network error detection', () => {
            // Status 0 but different error message
            const response1 = {
                success: false,
                status: 0,
                error: 'Network timeout'
            };
            expect(isCorsError(response1)).toBe(false);

            // "Failed to fetch" but not status 0
            const response2 = {
                success: false,
                status: 500,
                error: 'Failed to fetch data from server'
            };
            expect(isCorsError(response2)).toBe(false);
        });
    });

    describe('showCorsErrorModal', () => {
        beforeEach(() => {
            // Reset any existing event listeners
            vi.restoreAllMocks();
        });

        it('UT-U-006: dispatches show-cors-error CustomEvent on document', () => {
            const eventHandler = vi.fn();
            document.addEventListener('show-cors-error', eventHandler);

            showCorsErrorModal();

            expect(eventHandler).toHaveBeenCalledTimes(1);
            expect(eventHandler.mock.calls[0][0]).toBeInstanceOf(CustomEvent);
            expect(eventHandler.mock.calls[0][0].type).toBe('show-cors-error');

            document.removeEventListener('show-cors-error', eventHandler);
        });
    });
});
