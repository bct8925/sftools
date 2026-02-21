import { describe, it, expect } from 'vitest';
import { parseFieldValue } from '../../../src/lib/value-utils.js';
import {
    valuesEqual,
    isNullish,
    isEmpty,
    ensureString,
    formatFieldForInput,
} from '../../../src/lib/value-utils.testing.js';

describe('valuesEqual', () => {
    it('returns true when both values are null', () => {
        expect(valuesEqual(null, null)).toBe(true);
    });

    it('returns true when original is null and newValue is undefined', () => {
        expect(valuesEqual(null, undefined)).toBe(true);
    });

    it('returns true when original is null and newValue is empty string', () => {
        expect(valuesEqual(null, '')).toBe(true);
    });

    it('returns false when original is null and newValue has content', () => {
        expect(valuesEqual(null, 'hello')).toBe(false);
    });

    it('returns true when string values are equal', () => {
        expect(valuesEqual('hello', 'hello')).toBe(true);
    });

    it('returns false when string values are different', () => {
        expect(valuesEqual('hello', 'world')).toBe(false);
    });

    it('coerces number to string for comparison', () => {
        expect(valuesEqual(123, '123')).toBe(true);
    });

    it('coerces boolean to string for comparison', () => {
        expect(valuesEqual(true, 'true')).toBe(true);
    });
});

describe('isNullish', () => {
    it('returns true for null', () => {
        expect(isNullish(null)).toBe(true);
    });

    it('returns true for undefined', () => {
        expect(isNullish(undefined)).toBe(true);
    });

    it('returns false for empty string', () => {
        expect(isNullish('')).toBe(false);
    });

    it('returns false for zero', () => {
        expect(isNullish(0)).toBe(false);
    });

    it('returns false for false boolean', () => {
        expect(isNullish(false)).toBe(false);
    });
});

describe('isEmpty', () => {
    it('returns true for null', () => {
        expect(isEmpty(null)).toBe(true);
    });

    it('returns true for undefined', () => {
        expect(isEmpty(undefined)).toBe(true);
    });

    it('returns true for empty string', () => {
        expect(isEmpty('')).toBe(true);
    });

    it('returns false for zero', () => {
        expect(isEmpty(0)).toBe(false);
    });

    it('returns false for non-empty string', () => {
        expect(isEmpty('text')).toBe(false);
    });

    it('returns false for false boolean', () => {
        expect(isEmpty(false)).toBe(false);
    });
});

describe('ensureString', () => {
    it('returns default value for null', () => {
        expect(ensureString(null)).toBe('');
    });

    it('returns default value for undefined', () => {
        expect(ensureString(undefined)).toBe('');
    });

    it('returns custom default value', () => {
        expect(ensureString(null, 'N/A')).toBe('N/A');
    });

    it('converts number to string', () => {
        expect(ensureString(123)).toBe('123');
    });

    it('converts boolean to string', () => {
        expect(ensureString(true)).toBe('true');
    });

    it('returns existing string unchanged', () => {
        expect(ensureString('hello')).toBe('hello');
    });
});

describe('parseFieldValue', () => {
    it('returns null for empty string', () => {
        expect(parseFieldValue('', { type: 'string' } as any)).toBe(null);
    });

    it('returns null for null input', () => {
        expect(parseFieldValue(null, { type: 'string' } as any)).toBe(null);
    });

    it('parses boolean true', () => {
        expect(parseFieldValue('true', { type: 'boolean' } as any)).toBe(true);
    });

    it('parses boolean false', () => {
        expect(parseFieldValue('false', { type: 'boolean' } as any)).toBe(false);
    });

    it('parses boolean case-insensitive', () => {
        expect(parseFieldValue('TRUE', { type: 'boolean' } as any)).toBe(true);
        expect(parseFieldValue('False', { type: 'boolean' } as any)).toBe(false);
    });

    it('parses integer value', () => {
        expect(parseFieldValue('42', { type: 'int' } as any)).toBe(42);
    });

    it('returns null for non-numeric integer input', () => {
        expect(parseFieldValue('abc', { type: 'int' } as any)).toBe(null);
    });

    it('parses double value', () => {
        expect(parseFieldValue('3.14', { type: 'double' } as any)).toBe(3.14);
    });

    it('returns null for non-numeric double input', () => {
        expect(parseFieldValue('not-a-number', { type: 'double' } as any)).toBe(null);
    });

    it('parses currency type as float', () => {
        expect(parseFieldValue('99.99', { type: 'currency' } as any)).toBe(99.99);
    });

    it('parses percent type as float', () => {
        expect(parseFieldValue('75.5', { type: 'percent' } as any)).toBe(75.5);
    });

    it('returns string for unknown field types', () => {
        expect(parseFieldValue('test', { type: 'string' } as any)).toBe('test');
    });

    it('returns string for date field type', () => {
        expect(parseFieldValue('2024-01-15', { type: 'date' } as any)).toBe('2024-01-15');
    });
});

describe('formatFieldForInput', () => {
    it('returns empty string for null', () => {
        expect(formatFieldForInput(null, { type: 'string' } as any)).toBe('');
    });

    it('returns empty string for undefined', () => {
        expect(formatFieldForInput(undefined, { type: 'string' } as any)).toBe('');
    });

    it('formats boolean true as "true"', () => {
        expect(formatFieldForInput(true, { type: 'boolean' } as any)).toBe('true');
    });

    it('formats boolean false as "false"', () => {
        expect(formatFieldForInput(false, { type: 'boolean' } as any)).toBe('false');
    });

    it('formats number as string', () => {
        expect(formatFieldForInput(123, { type: 'int' } as any)).toBe('123');
    });

    it('formats float as string', () => {
        expect(formatFieldForInput(3.14, { type: 'double' } as any)).toBe('3.14');
    });

    it('formats string value', () => {
        expect(formatFieldForInput('hello', { type: 'string' } as any)).toBe('hello');
    });

    it('formats date type as string', () => {
        expect(formatFieldForInput('2024-01-15', { type: 'date' } as any)).toBe('2024-01-15');
    });

    it('formats datetime type as string', () => {
        expect(formatFieldForInput('2024-01-15T10:00:00Z', { type: 'datetime' } as any)).toBe(
            '2024-01-15T10:00:00Z'
        );
    });
});
