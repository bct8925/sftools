/**
 * Tests for src/lib/text-utils.js
 *
 * Test IDs: UT-U-001, UT-U-002
 * - UT-U-001: escapeHtml() - Escapes < > &
 * - UT-U-002: escapeAttr() - Escapes quotes
 */

import { describe, it, expect } from 'vitest';
import { escapeHtml, escapeAttr, truncate } from '../../../src/lib/text-utils.js';

describe('text-utils', () => {
    describe('escapeHtml', () => {
        it('UT-U-001: escapes < and > characters', () => {
            expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
        });

        it('UT-U-001: escapes & character', () => {
            expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
        });

        it('does not escape quotes (use escapeAttr for attributes)', () => {
            // escapeHtml uses textContent/innerHTML which doesn't escape quotes
            // This is fine for HTML content, use escapeAttr for attribute values
            expect(escapeHtml('"hello"')).toBe('"hello"');
        });

        it('handles combined special characters', () => {
            // Note: quotes are not escaped by this method
            expect(escapeHtml('<div class="test">a & b</div>'))
                .toBe('&lt;div class="test"&gt;a &amp; b&lt;/div&gt;');
        });

        it('returns empty string for null', () => {
            expect(escapeHtml(null)).toBe('');
        });

        it('returns empty string for undefined', () => {
            expect(escapeHtml(undefined)).toBe('');
        });

        it('returns empty string for empty string', () => {
            expect(escapeHtml('')).toBe('');
        });

        it('preserves safe strings unchanged', () => {
            expect(escapeHtml('Hello World')).toBe('Hello World');
        });
    });

    describe('escapeAttr', () => {
        it('UT-U-002: escapes double quotes', () => {
            expect(escapeAttr('say "hello"')).toBe('say &quot;hello&quot;');
        });

        it('UT-U-002: escapes single quotes', () => {
            expect(escapeAttr("it's")).toBe('it&#39;s');
        });

        it('escapes ampersand', () => {
            expect(escapeAttr('a & b')).toBe('a &amp; b');
        });

        it('escapes angle brackets', () => {
            expect(escapeAttr('<tag>')).toBe('&lt;tag&gt;');
        });

        it('returns empty string for null', () => {
            expect(escapeAttr(null)).toBe('');
        });

        it('returns empty string for undefined', () => {
            expect(escapeAttr(undefined)).toBe('');
        });

        it('preserves safe strings unchanged', () => {
            expect(escapeAttr('simple text')).toBe('simple text');
        });
    });

    describe('truncate', () => {
        it('returns original string when shorter than limit', () => {
            expect(truncate('hello', 10)).toBe('hello');
        });

        it('returns original string when equal to limit', () => {
            expect(truncate('hello', 5)).toBe('hello');
        });

        it('truncates and adds ellipsis when longer than limit', () => {
            expect(truncate('hello world', 5)).toBe('hello...');
        });

        it('returns empty string for null', () => {
            expect(truncate(null, 10)).toBe('');
        });

        it('returns empty string for undefined', () => {
            expect(truncate(undefined, 10)).toBe('');
        });

        it('returns empty string for empty string', () => {
            expect(truncate('', 10)).toBe('');
        });

        it('truncates at exact position', () => {
            expect(truncate('abcdefghij', 3)).toBe('abc...');
        });
    });
});
