/**
 * Unit tests for RestApiHistory helper functions
 *
 * Test IDs: RH-U-001 through RH-U-007
 * - RH-U-001: parseRequest() - valid JSON returns parsed request
 * - RH-U-002: parseRequest() - invalid JSON returns null
 * - RH-U-003: parseRequest() - includes body when present
 * - RH-U-004: parseRequest() - no body key when absent
 * - RH-U-005: getPreview() - short URL returns "METHOD /path"
 * - RH-U-006: getPreview() - long URL (>40 chars) is truncated with "..."
 * - RH-U-007: getPreview() - invalid JSON returns raw content string
 */

import { describe, it, expect } from 'vitest';
import { parseRequest, getPreview } from '../../../src/components/rest-api/RestApiHistory.testing';

describe('RestApiHistory helpers', () => {
    describe('parseRequest', () => {
        it('RH-U-001: valid JSON returns parsed request', () => {
            const content = JSON.stringify({ method: 'GET', url: '/services/data/v62.0/limits' });
            const result = parseRequest(content);
            expect(result).toEqual({ method: 'GET', url: '/services/data/v62.0/limits' });
        });

        it('RH-U-002: invalid JSON returns null', () => {
            const result = parseRequest('not valid json');
            expect(result).toBeNull();
        });

        it('RH-U-003: includes body when present', () => {
            const body = '{"Name":"Test"}';
            const content = JSON.stringify({
                method: 'POST',
                url: '/services/data/v62.0/sobjects/Account',
                body,
            });
            const result = parseRequest(content);
            expect(result).toEqual({
                method: 'POST',
                url: '/services/data/v62.0/sobjects/Account',
                body,
            });
        });

        it('RH-U-004: no body key when absent', () => {
            const content = JSON.stringify({ method: 'GET', url: '/services/data/v62.0/limits' });
            const result = parseRequest(content);
            expect(result).not.toHaveProperty('body');
        });
    });

    describe('getPreview', () => {
        it('RH-U-005: short URL returns "METHOD /path"', () => {
            const content = JSON.stringify({ method: 'GET', url: '/services/data/v62.0/limits' });
            expect(getPreview(content)).toBe('GET /services/data/v62.0/limits');
        });

        it('RH-U-006: long URL (>40 chars) is truncated with "..."', () => {
            const longUrl = '/services/data/v62.0/sobjects/Account/describe/extra-stuff-here';
            const content = JSON.stringify({ method: 'GET', url: longUrl });
            const preview = getPreview(content);
            expect(preview).toContain('...');
            expect(preview.startsWith('GET ')).toBe(true);
            expect(preview.length).toBeLessThan('GET '.length + longUrl.length);
        });

        it('RH-U-007: invalid JSON returns raw content string', () => {
            const raw = 'not json content';
            expect(getPreview(raw)).toBe(raw);
        });
    });
});
