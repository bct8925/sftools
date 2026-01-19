/**
 * Tests for src/lib/cors-detection.js
 *
 * Test IDs: UT-U-005, UT-U-006
 * - UT-U-005: isCorsError() - Detects status 0
 * - UT-U-006: showCorsErrorModal() - Dispatches event
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isCorsError, showCorsErrorModal } from '../../../src/lib/cors-detection.js';

describe('cors-detection', () => {
    describe('isCorsError', () => {
        it('returns true for status 0 with "failed to fetch" error', () => {
            const response = {
                success: false,
                status: 0,
                error: 'Failed to fetch'
            };

            expect(isCorsError(response)).toBe(true);
        });

        it('returns true for error containing "cors" keyword', () => {
            const response = {
                success: false,
                status: 500,
                error: 'CORS policy blocked the request'
            };

            expect(isCorsError(response)).toBe(true);
        });

        it('returns true for error containing "cross-origin" keyword', () => {
            const response = {
                success: false,
                status: 403,
                error: 'Cross-origin request blocked'
            };

            expect(isCorsError(response)).toBe(true);
        });

        it('returns true for error containing "access-control" keyword', () => {
            const response = {
                success: false,
                status: 0,
                error: 'Access-Control-Allow-Origin header missing'
            };

            expect(isCorsError(response)).toBe(true);
        });

        it('is case-insensitive for keyword detection', () => {
            const responses = [
                { success: false, status: 500, error: 'CORS error' },
                { success: false, status: 500, error: 'cors error' },
                { success: false, status: 500, error: 'Cors Error' }
            ];

            for (const response of responses) {
                expect(isCorsError(response)).toBe(true);
            }
        });

        it('returns false for successful responses', () => {
            const response = {
                success: true,
                status: 200,
                error: ''
            };

            expect(isCorsError(response)).toBe(false);
        });

        it('returns false for 401 Unauthorized errors', () => {
            const response = {
                success: false,
                status: 401,
                error: 'Session expired or invalid'
            };

            expect(isCorsError(response)).toBe(false);
        });

        it('returns false for 500 server errors without CORS keywords', () => {
            const response = {
                success: false,
                status: 500,
                error: 'Internal server error'
            };

            expect(isCorsError(response)).toBe(false);
        });

        it('returns false for 404 not found errors', () => {
            const response = {
                success: false,
                status: 404,
                error: 'Resource not found'
            };

            expect(isCorsError(response)).toBe(false);
        });

        it('handles missing error property gracefully', () => {
            const response = {
                success: false,
                status: 500
            };

            expect(isCorsError(response)).toBe(false);
        });

        it('handles null error property gracefully', () => {
            const response = {
                success: false,
                status: 0,
                error: null
            };

            expect(isCorsError(response)).toBe(false);
        });

        it('requires both status 0 and "failed to fetch" for network error detection', () => {
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

        it('dispatches show-cors-error CustomEvent on document', () => {
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
