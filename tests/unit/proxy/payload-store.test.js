/**
 * Tests for sftools-proxy/src/payload-store.js
 *
 * Test IDs: PS-U-001 through PS-U-006
 * - PS-U-001: storePayload() - Returns UUID
 * - PS-U-002: getPayload() - Returns stored data
 * - PS-U-003: getPayload() - Returns null for expired
 * - PS-U-004: deletePayload() - Removes from store
 * - PS-U-005: shouldUseLargePayload() - True for >= 800KB
 * - PS-U-006: shouldUseLargePayload() - False for < 800KB
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import CommonJS module
const payloadStore = await import('../../../sftools-proxy/src/payload-store.js');

const {
    storePayload,
    getPayload,
    deletePayload,
    shouldUseLargePayload,
    getPayloadCount,
    MAX_NATIVE_MESSAGE_SIZE,
    PAYLOAD_TTL_MS
} = payloadStore;

describe('payload-store', () => {
    let storedIds = [];

    beforeEach(() => {
        vi.useFakeTimers();
        storedIds = [];
    });

    afterEach(() => {
        // Clean up all stored payloads
        for (const id of storedIds) {
            deletePayload(id);
        }
        storedIds = [];

        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    // Helper to track payload IDs for cleanup
    function trackPayload(id) {
        storedIds.push(id);
        return id;
    }

    describe('storePayload', () => {
        it('returns a UUID string', () => {
            const id = trackPayload(storePayload('test data'));

            // UUID format: 8-4-4-4-12 characters
            expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        });

        it('increments payload count', () => {
            const initialCount = getPayloadCount();

            trackPayload(storePayload('test data'));

            expect(getPayloadCount()).toBe(initialCount + 1);
        });

        it('stores multiple payloads with unique IDs', () => {
            const id1 = trackPayload(storePayload('data 1'));
            const id2 = trackPayload(storePayload('data 2'));

            expect(id1).not.toBe(id2);
            expect(getPayloadCount()).toBe(2);
        });

        it('schedules automatic cleanup after TTL', () => {
            const id = trackPayload(storePayload('test data'));
            expect(getPayload(id)).toBe('test data');

            // Advance time past TTL
            vi.advanceTimersByTime(PAYLOAD_TTL_MS + 1000);

            // Payload should be automatically deleted
            expect(getPayloadCount()).toBe(0);
        });
    });

    describe('getPayload', () => {
        it('returns stored data by ID', () => {
            const testData = 'my payload data';
            const id = trackPayload(storePayload(testData));

            const result = getPayload(id);

            expect(result).toBe(testData);
        });

        it('returns null for non-existent ID', () => {
            const result = getPayload('non-existent-uuid');

            expect(result).toBeNull();
        });

        it('returns null for expired payload', () => {
            const id = trackPayload(storePayload('test data'));
            expect(getPayload(id)).toBe('test data');

            // Advance time past TTL
            vi.advanceTimersByTime(PAYLOAD_TTL_MS + 1000);

            const result = getPayload(id);

            expect(result).toBeNull();
        });

        it('removes expired payload from store', () => {
            const id = trackPayload(storePayload('test data'));
            const initialCount = getPayloadCount();

            // Advance time past TTL
            vi.advanceTimersByTime(PAYLOAD_TTL_MS + 1000);

            // Attempt to get expired payload
            getPayload(id);

            // Should be removed
            expect(getPayloadCount()).toBe(initialCount - 1);
        });

        it('does not delete payload before expiration', () => {
            const id = trackPayload(storePayload('test data'));

            // Advance time, but not past TTL
            vi.advanceTimersByTime(PAYLOAD_TTL_MS - 1000);

            const result = getPayload(id);

            expect(result).toBe('test data');
            expect(getPayloadCount()).toBe(1);
        });

        it('returns correct data for multiple stored payloads', () => {
            const id1 = trackPayload(storePayload('payload 1'));
            const id2 = trackPayload(storePayload('payload 2'));
            const id3 = trackPayload(storePayload('payload 3'));

            expect(getPayload(id1)).toBe('payload 1');
            expect(getPayload(id2)).toBe('payload 2');
            expect(getPayload(id3)).toBe('payload 3');
        });
    });

    describe('deletePayload', () => {
        it('removes payload from store', () => {
            const id = trackPayload(storePayload('test data'));
            expect(getPayloadCount()).toBe(1);

            deletePayload(id);

            expect(getPayloadCount()).toBe(0);
            expect(getPayload(id)).toBeNull();
        });

        it('clears the auto-delete timeout', () => {
            const id = trackPayload(storePayload('test data'));

            deletePayload(id);

            // Advance time past TTL
            vi.advanceTimersByTime(PAYLOAD_TTL_MS + 1000);

            // Payload should stay deleted (no side effects from cleared timeout)
            expect(getPayloadCount()).toBe(0);
        });

        it('handles non-existent ID gracefully', () => {
            deletePayload('non-existent-uuid');

            // Should not throw or cause errors
            expect(getPayloadCount()).toBe(0);
        });

        it('removes only the specified payload', () => {
            const id1 = trackPayload(storePayload('payload 1'));
            const id2 = trackPayload(storePayload('payload 2'));
            const id3 = trackPayload(storePayload('payload 3'));

            deletePayload(id2);

            expect(getPayloadCount()).toBe(2);
            expect(getPayload(id1)).toBe('payload 1');
            expect(getPayload(id2)).toBeNull();
            expect(getPayload(id3)).toBe('payload 3');
        });
    });

    describe('shouldUseLargePayload', () => {
        it('returns true for data >= 800KB', () => {
            // Create string >= 800KB
            const largeData = 'x'.repeat(MAX_NATIVE_MESSAGE_SIZE);

            const result = shouldUseLargePayload(largeData);

            expect(result).toBe(true);
        });

        it('returns true for data exceeding 800KB', () => {
            // Create string > 800KB
            const largeData = 'x'.repeat(MAX_NATIVE_MESSAGE_SIZE + 1000);

            const result = shouldUseLargePayload(largeData);

            expect(result).toBe(true);
        });

        it('returns false for data < 800KB', () => {
            // Create string < 800KB
            const smallData = 'x'.repeat(MAX_NATIVE_MESSAGE_SIZE - 1);

            const result = shouldUseLargePayload(smallData);

            expect(result).toBe(false);
        });

        it('returns false for small strings', () => {
            const result = shouldUseLargePayload('small payload');

            expect(result).toBe(false);
        });

        it('calculates byte length correctly for UTF-8 characters', () => {
            // Multi-byte UTF-8 characters
            // Each emoji is typically 4 bytes
            const emoji = '🔥';
            const emojiBytes = Buffer.byteLength(emoji, 'utf8'); // 4 bytes

            // Create string that crosses threshold with multi-byte chars
            const count = Math.floor(MAX_NATIVE_MESSAGE_SIZE / emojiBytes);
            const justUnder = emoji.repeat(count - 1);
            const justOver = emoji.repeat(count + 1);

            expect(shouldUseLargePayload(justUnder)).toBe(false);
            expect(shouldUseLargePayload(justOver)).toBe(true);
        });

        it('returns false for empty string', () => {
            const result = shouldUseLargePayload('');

            expect(result).toBe(false);
        });
    });

    describe('getPayloadCount', () => {
        it('returns 0 when no payloads stored', () => {
            expect(getPayloadCount()).toBe(0);
        });

        it('returns correct count after storing payloads', () => {
            trackPayload(storePayload('data 1'));
            trackPayload(storePayload('data 2'));
            trackPayload(storePayload('data 3'));

            expect(getPayloadCount()).toBe(3);
        });

        it('decreases count after deletePayload', () => {
            const id1 = trackPayload(storePayload('data 1'));
            const id2 = trackPayload(storePayload('data 2'));
            expect(getPayloadCount()).toBe(2);

            deletePayload(id1);

            expect(getPayloadCount()).toBe(1);

            deletePayload(id2);

            expect(getPayloadCount()).toBe(0);
        });

        it('decreases count after automatic expiration', () => {
            trackPayload(storePayload('data 1'));
            trackPayload(storePayload('data 2'));
            expect(getPayloadCount()).toBe(2);

            // Advance time past TTL
            vi.advanceTimersByTime(PAYLOAD_TTL_MS + 1000);

            expect(getPayloadCount()).toBe(0);
        });
    });

    describe('TTL behavior', () => {
        it('keeps payload available just before TTL expires', () => {
            const id = trackPayload(storePayload('test data'));

            // Advance to 1ms before expiration
            vi.advanceTimersByTime(PAYLOAD_TTL_MS - 1);

            expect(getPayload(id)).toBe('test data');
            expect(getPayloadCount()).toBe(1);
        });

        it('expires payload exactly at TTL', () => {
            const id = trackPayload(storePayload('test data'));

            // Advance to exact TTL
            vi.advanceTimersByTime(PAYLOAD_TTL_MS);

            // Timeout should have fired
            expect(getPayloadCount()).toBe(0);
            expect(getPayload(id)).toBeNull();
        });

        it('handles multiple payloads with different expiration times', () => {
            const id1 = trackPayload(storePayload('payload 1'));

            vi.advanceTimersByTime(10000);

            const id2 = trackPayload(storePayload('payload 2'));

            // Advance time to expire first payload only
            vi.advanceTimersByTime(PAYLOAD_TTL_MS - 9000);

            expect(getPayload(id1)).toBeNull();
            expect(getPayload(id2)).toBe('payload 2');
            expect(getPayloadCount()).toBe(1);

            // Advance time to expire second payload
            vi.advanceTimersByTime(10000);

            expect(getPayload(id2)).toBeNull();
            expect(getPayloadCount()).toBe(0);
        });
    });

    describe('edge cases', () => {
        it('handles large number of stored payloads', () => {
            const ids = [];
            for (let i = 0; i < 100; i++) {
                ids.push(trackPayload(storePayload(`payload ${i}`)));
            }

            expect(getPayloadCount()).toBe(100);

            // Verify all payloads are retrievable
            for (let i = 0; i < 100; i++) {
                expect(getPayload(ids[i])).toBe(`payload ${i}`);
            }
        });

        it('handles storing exact 800KB threshold', () => {
            const exactData = 'x'.repeat(MAX_NATIVE_MESSAGE_SIZE);

            expect(shouldUseLargePayload(exactData)).toBe(true);

            const id = trackPayload(storePayload(exactData));
            const retrieved = getPayload(id);

            expect(retrieved).toBe(exactData);
        });

        it('handles binary-like data strings', () => {
            const binaryData = '\x00\x01\x02\xFF\xFE';

            const result = shouldUseLargePayload(binaryData);

            expect(result).toBe(false);

            const id = trackPayload(storePayload(binaryData));
            expect(getPayload(id)).toBe(binaryData);
        });
    });
});
