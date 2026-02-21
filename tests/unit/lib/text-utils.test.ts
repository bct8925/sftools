/**
 * Tests for src/lib/text-utils.js
 *
 * Test IDs: UT-U-016 through UT-U-035
 * - UT-U-016: escapeHtml() - Does not escape quotes (use escapeAttr for attributes)
 * - UT-U-017: escapeHtml() - Handles combined special characters
 * - UT-U-018: escapeHtml() - Returns empty string for null
 * - UT-U-019: escapeHtml() - Returns empty string for undefined
 * - UT-U-020: escapeHtml() - Returns empty string for empty string
 * - UT-U-021: escapeHtml() - Preserves safe strings unchanged
 * - UT-U-022: escapeAttr() - Escapes ampersand
 * - UT-U-023: escapeAttr() - Escapes angle brackets
 * - UT-U-024: escapeAttr() - Returns empty string for null
 * - UT-U-025: escapeAttr() - Returns empty string for undefined
 * - UT-U-026: escapeAttr() - Preserves safe strings unchanged
 * - UT-U-027: truncate() - Returns original string when shorter than limit
 * - UT-U-028: truncate() - Returns original string when equal to limit
 * - UT-U-029: truncate() - Truncates and adds ellipsis when longer than limit
 * - UT-U-030: truncate() - Returns empty string for null
 * - UT-U-031: truncate() - Returns empty string for undefined
 * - UT-U-032: truncate() - Returns empty string for empty string
 * - UT-U-033: truncate() - Truncates at exact position
 */

import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../../../src/lib/text-utils.js';
import { escapeAttr, truncate } from '../../../src/lib/text-utils.testing.js';

describe('text-utils', () => {
    describe('escapeHtml', () => {
        it('escapes < and > characters', () => {
            expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
        });

        it('escapes & character', () => {
            expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
        });

        it('UT-U-016: does not escape quotes (use escapeAttr for attributes)', () => {
            // escapeHtml uses textContent/innerHTML which doesn't escape quotes
            // This is fine for HTML content, use escapeAttr for attribute values
            expect(escapeHtml('"hello"')).toBe('"hello"');
        });

        it('UT-U-017: handles combined special characters', () => {
            // Note: quotes are not escaped by this method
            expect(escapeHtml('<div class="test">a & b</div>')).toBe(
                '&lt;div class="test"&gt;a &amp; b&lt;/div&gt;'
            );
        });

        it('UT-U-018: returns empty string for null', () => {
            expect(escapeHtml(null)).toBe('');
        });

        it('UT-U-019: returns empty string for undefined', () => {
            expect(escapeHtml(undefined)).toBe('');
        });

        it('UT-U-020: returns empty string for empty string', () => {
            expect(escapeHtml('')).toBe('');
        });

        it('UT-U-021: preserves safe strings unchanged', () => {
            expect(escapeHtml('Hello World')).toBe('Hello World');
        });
    });

    describe('escapeAttr', () => {
        it('escapes double quotes', () => {
            expect(escapeAttr('say "hello"')).toBe('say &quot;hello&quot;');
        });

        it('escapes single quotes', () => {
            expect(escapeAttr("it's")).toBe('it&#39;s');
        });

        it('UT-U-022: escapes ampersand', () => {
            expect(escapeAttr('a & b')).toBe('a &amp; b');
        });

        it('UT-U-023: escapes angle brackets', () => {
            expect(escapeAttr('<tag>')).toBe('&lt;tag&gt;');
        });

        it('UT-U-024: returns empty string for null', () => {
            expect(escapeAttr(null)).toBe('');
        });

        it('UT-U-025: returns empty string for undefined', () => {
            expect(escapeAttr(undefined)).toBe('');
        });

        it('UT-U-026: preserves safe strings unchanged', () => {
            expect(escapeAttr('simple text')).toBe('simple text');
        });
    });

    describe('truncate', () => {
        it('UT-U-027: returns original string when shorter than limit', () => {
            expect(truncate('hello', 10)).toBe('hello');
        });

        it('UT-U-028: returns original string when equal to limit', () => {
            expect(truncate('hello', 5)).toBe('hello');
        });

        it('UT-U-029: truncates and adds ellipsis when longer than limit', () => {
            expect(truncate('hello world', 5)).toBe('hello...');
        });

        it('UT-U-030: returns empty string for null', () => {
            expect(truncate(null, 10)).toBe('');
        });

        it('UT-U-031: returns empty string for undefined', () => {
            expect(truncate(undefined, 10)).toBe('');
        });

        it('UT-U-032: returns empty string for empty string', () => {
            expect(truncate('', 10)).toBe('');
        });

        it('UT-U-033: truncates at exact position', () => {
            expect(truncate('abcdefghij', 3)).toBe('abc...');
        });
    });
});
