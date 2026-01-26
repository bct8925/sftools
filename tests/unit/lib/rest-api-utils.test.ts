/**
 * Tests for src/lib/rest-api-utils.js
 *
 * Test IDs: R-U-001 through R-U-005
 * - R-U-001: shouldShowBody() - Shows body for POST
 * - R-U-002: shouldShowBody() - Hides body for GET
 * - R-U-003: shouldShowBody() - Shows body for PATCH
 * - R-U-004: shouldShowBody() - Shows body for PUT
 * - R-U-005: shouldShowBody() - Hides body for DELETE
 */

import { describe, it, expect } from 'vitest';
import { shouldShowBody } from '../../../src/lib/rest-api-utils.js';

describe('rest-api-utils', () => {
    describe('shouldShowBody', () => {
        it('R-U-001: returns true for POST method', () => {
            expect(shouldShowBody('POST')).toBe(true);
        });

        it('R-U-002: returns false for GET method', () => {
            expect(shouldShowBody('GET')).toBe(false);
        });

        it('R-U-003: returns true for PATCH method', () => {
            expect(shouldShowBody('PATCH')).toBe(true);
        });

        it('R-U-004: returns true for PUT method', () => {
            expect(shouldShowBody('PUT')).toBe(true);
        });

        it('R-U-005: returns false for DELETE method', () => {
            expect(shouldShowBody('DELETE')).toBe(false);
        });
    });
});
