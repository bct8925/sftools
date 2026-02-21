import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    getFutureDate,
    getISODateFromNow,
    getNowISO,
    isExpired,
} from '../../../src/lib/date-utils.js';
import { formatRelativeTime, getFilenameTimestamp } from '../../../src/lib/date-utils.testing.js';

describe('date-utils', () => {
    const FIXED_TIME = new Date('2024-06-15T12:00:00.000Z');

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(FIXED_TIME);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('getFutureDate', () => {
        it('returns date in the future by correct amount', () => {
            const result = getFutureDate(30);
            expect(result.getTime()).toBe(new Date('2024-06-15T12:30:00.000Z').getTime());
        });

        it('handles zero minutes', () => {
            const result = getFutureDate(0);
            expect(result.getTime()).toBe(FIXED_TIME.getTime());
        });
    });

    describe('getISODateFromNow', () => {
        it('returns ISO string for future time', () => {
            const result = getISODateFromNow(45);
            expect(result).toBe('2024-06-15T12:45:00.000Z');
        });
    });

    describe('getNowISO', () => {
        it('returns ISO string matching current time', () => {
            expect(getNowISO()).toBe('2024-06-15T12:00:00.000Z');
        });
    });

    describe('isExpired', () => {
        it('returns false for recent timestamp', () => {
            const recent = FIXED_TIME.getTime() - 5 * 60 * 1000;
            expect(isExpired(recent, 10)).toBe(false);
        });

        it('returns true for old timestamp', () => {
            const old = FIXED_TIME.getTime() - 15 * 60 * 1000;
            expect(isExpired(old, 10)).toBe(true);
        });

        it('returns false at exact boundary', () => {
            const boundary = FIXED_TIME.getTime() - 10 * 60 * 1000;
            expect(isExpired(boundary, 10)).toBe(false);
        });
    });

    describe('formatRelativeTime', () => {
        it('returns "Just now" for less than 1 minute ago', () => {
            expect(formatRelativeTime(FIXED_TIME.getTime() - 30 * 1000)).toBe('Just now');
        });

        it('returns minutes ago', () => {
            expect(formatRelativeTime(FIXED_TIME.getTime() - 5 * 60 * 1000)).toBe('5m ago');
        });

        it('returns hours ago', () => {
            expect(formatRelativeTime(FIXED_TIME.getTime() - 2 * 60 * 60 * 1000)).toBe('2h ago');
        });

        it('returns days ago', () => {
            expect(formatRelativeTime(FIXED_TIME.getTime() - 3 * 24 * 60 * 60 * 1000)).toBe(
                '3d ago'
            );
        });

        it('returns locale date string for older than 7 days', () => {
            const ts = FIXED_TIME.getTime() - 8 * 24 * 60 * 60 * 1000;
            expect(formatRelativeTime(ts)).toBe(new Date(ts).toLocaleDateString());
        });
    });

    describe('getFilenameTimestamp', () => {
        it('returns YYYYMMDDTHHMMSS format', () => {
            expect(getFilenameTimestamp()).toBe('20240615T120000');
        });
    });
});
