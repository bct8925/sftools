/**
 * Tests for sftools-proxy/src/payload-store.js
 *
 * Test IDs: PS-U-001 through PS-U-028
 * - PS-U-001: storePayload() - Returns UUID
 * - PS-U-002: getPayload() - Returns stored data
 * - PS-U-003: getPayload() - Returns null for expired
 * - PS-U-004: deletePayload() - Removes from store
 * - PS-U-005: shouldUseLargePayload() - True for >= 800KB
 * - PS-U-006: shouldUseLargePayload() - False for < 800KB
 * - PS-U-007: storePayload() - Increments payload count
 * - PS-U-008: storePayload() - Stores multiple payloads with unique IDs
 * - PS-U-009: storePayload() - Schedules automatic cleanup after TTL
 * - PS-U-010: getPayload() - Removes expired payload from store
 * - PS-U-011: getPayload() - Does not delete payload before expiration
 * - PS-U-012: getPayload() - Returns correct data for multiple stored payloads
 * - PS-U-013: deletePayload() - Clears the auto-delete timeout
 * - PS-U-014: deletePayload() - Handles non-existent ID gracefully
 * - PS-U-015: deletePayload() - Removes only the specified payload
 * - PS-U-016: shouldUseLargePayload() - Returns false for small strings
 * - PS-U-017: shouldUseLargePayload() - Calculates byte length correctly for UTF-8 characters
 * - PS-U-018: shouldUseLargePayload() - Returns false for empty string
 * - PS-U-019: getPayloadCount() - Returns 0 when no payloads stored
 * - PS-U-020: getPayloadCount() - Returns correct count after storing payloads
 * - PS-U-021: getPayloadCount() - Decreases count after deletePayload
 * - PS-U-022: getPayloadCount() - Decreases count after automatic expiration
 * - PS-U-023: TTL behavior - Keeps payload available just before TTL expires
 * - PS-U-024: TTL behavior - Expires payload exactly at TTL
 * - PS-U-025: TTL behavior - Handles multiple payloads with different expiration times
 * - PS-U-026: Edge cases - Handles large number of stored payloads
 * - PS-U-027: Edge cases - Handles storing exact 800KB threshold
 * - PS-U-028: Edge cases - Handles binary-like data strings
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
        it('PS-U-001: returns a UUID string', () => {
            const id = trackPayload(storePayload('test data'));

            // UUID format: 8-4-4-4-12 characters
            expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        });

        it('PS-U-007: increments payload count', () => {
            const initialCount = getPayloadCount();

            trackPayload(storePayload('test data'));

            expect(getPayloadCount()).toBe(initialCount + 1);
        });

        it('PS-U-008: stores multiple payloads with unique IDs', () => {
            const id1 = trackPayload(storePayload('data 1'));
            const id2 = trackPayload(storePayload('data 2'));

            expect(id1).not.toBe(id2);
            expect(getPayloadCount()).toBe(2);
        });

        it('PS-U-009: schedules automatic cleanup after TTL', () => {
            const id = trackPayload(storePayload('test data'));
            expect(getPayload(id)).toBe('test data');

            // Advance time past TTL
            vi.advanceTimersByTime(PAYLOAD_TTL_MS + 1000);

            // Payload should be automatically deleted
            expect(getPayloadCount()).toBe(0);
        });
    });

    describe('getPayload', () => {
        it('PS-U-002: returns stored data by ID', () => {
            const testData = 'my payload data';
            const id = trackPayload(storePayload(testData));

            const result = getPayload(id);

            expect(result).toBe(testData);
        });

        it('PS-U-002: returns null for non-existent ID', () => {
            const result = getPayload('non-existent-uuid');

            expect(result).toBeNull();
        });

        it('PS-U-003: returns null for expired payload', () => {
            const id = trackPayload(storePayload('test data'));
            expect(getPayload(id)).toBe('test data');

            // Advance time past TTL
            vi.advanceTimersByTime(PAYLOAD_TTL_MS + 1000);

            const result = getPayload(id);

            expect(result).toBeNull();
        });

        it('PS-U-010: removes expired payload from store', () => {
            const id = trackPayload(storePayload('test data'));
            const initialCount = getPayloadCount();

            // Advance time past TTL
            vi.advanceTimersByTime(PAYLOAD_TTL_MS + 1000);

            // Attempt to get expired payload
            getPayload(id);

            // Should be removed
            expect(getPayloadCount()).toBe(initialCount - 1);
        });

        it('PS-U-011: does not delete payload before expiration', () => {
            const id = trackPayload(storePayload('test data'));

            // Advance time, but not past TTL
            vi.advanceTimersByTime(PAYLOAD_TTL_MS - 1000);

            const result = getPayload(id);

            expect(result).toBe('test data');
            expect(getPayloadCount()).toBe(1);
        });

        it('PS-U-012: returns correct data for multiple stored payloads', () => {
            const id1 = trackPayload(storePayload('payload 1'));
            const id2 = trackPayload(storePayload('payload 2'));
            const id3 = trackPayload(storePayload('payload 3'));

            expect(getPayload(id1)).toBe('payload 1');
            expect(getPayload(id2)).toBe('payload 2');
            expect(getPayload(id3)).toBe('payload 3');
        });
    });

    describe('deletePayload', () => {
        it('PS-U-004: removes payload from store', () => {
            const id = trackPayload(storePayload('test data'));
            expect(getPayloadCount()).toBe(1);

            deletePayload(id);

            expect(getPayloadCount()).toBe(0);
            expect(getPayload(id)).toBeNull();
        });

        it('PS-U-013: clears the auto-delete timeout', () => {
            const id = trackPayload(storePayload('test data'));

            deletePayload(id);

            // Advance time past TTL
            vi.advanceTimersByTime(PAYLOAD_TTL_MS + 1000);

            // Payload should stay deleted (no side effects from cleared timeout)
            expect(getPayloadCount()).toBe(0);
        });

        it('PS-U-014: handles non-existent ID gracefully', () => {
            deletePayload('non-existent-uuid');

            // Should not throw or cause errors
            expect(getPayloadCount()).toBe(0);
        });

        it('PS-U-015: removes only the specified payload', () => {
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
        it('PS-U-005: returns true for data >= 800KB', () => {
            // Create string >= 800KB
            const largeData = 'x'.repeat(MAX_NATIVE_MESSAGE_SIZE);

            const result = shouldUseLargePayload(largeData);

            expect(result).toBe(true);
        });

        it('PS-U-005: returns true for data exceeding 800KB', () => {
            // Create string > 800KB
            const largeData = 'x'.repeat(MAX_NATIVE_MESSAGE_SIZE + 1000);

            const result = shouldUseLargePayload(largeData);

            expect(result).toBe(true);
        });

        it('PS-U-006: returns false for data < 800KB', () => {
            // Create string < 800KB
            const smallData = 'x'.repeat(MAX_NATIVE_MESSAGE_SIZE - 1);

            const result = shouldUseLargePayload(smallData);

            expect(result).toBe(false);
        });

        it('PS-U-016: returns false for small strings', () => {
            const result = shouldUseLargePayload('small payload');

            expect(result).toBe(false);
        });

        it('PS-U-017: calculates byte length correctly for UTF-8 characters', () => {
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

        it('PS-U-018: returns false for empty string', () => {
            const result = shouldUseLargePayload('');

            expect(result).toBe(false);
        });
    });

    describe('getPayloadCount', () => {
        it('PS-U-019: returns 0 when no payloads stored', () => {
            expect(getPayloadCount()).toBe(0);
        });

        it('PS-U-020: returns correct count after storing payloads', () => {
            trackPayload(storePayload('data 1'));
            trackPayload(storePayload('data 2'));
            trackPayload(storePayload('data 3'));

            expect(getPayloadCount()).toBe(3);
        });

        it('PS-U-021: decreases count after deletePayload', () => {
            const id1 = trackPayload(storePayload('data 1'));
            const id2 = trackPayload(storePayload('data 2'));
            expect(getPayloadCount()).toBe(2);

            deletePayload(id1);

            expect(getPayloadCount()).toBe(1);

            deletePayload(id2);

            expect(getPayloadCount()).toBe(0);
        });

        it('PS-U-022: decreases count after automatic expiration', () => {
            trackPayload(storePayload('data 1'));
            trackPayload(storePayload('data 2'));
            expect(getPayloadCount()).toBe(2);

            // Advance time past TTL
            vi.advanceTimersByTime(PAYLOAD_TTL_MS + 1000);

            expect(getPayloadCount()).toBe(0);
        });
    });

    describe('TTL behavior', () => {
        it('PS-U-023: keeps payload available just before TTL expires', () => {
            const id = trackPayload(storePayload('test data'));

            // Advance to 1ms before expiration
            vi.advanceTimersByTime(PAYLOAD_TTL_MS - 1);

            expect(getPayload(id)).toBe('test data');
            expect(getPayloadCount()).toBe(1);
        });

        it('PS-U-024: expires payload exactly at TTL', () => {
            const id = trackPayload(storePayload('test data'));

            // Advance to exact TTL
            vi.advanceTimersByTime(PAYLOAD_TTL_MS);

            // Timeout should have fired
            expect(getPayloadCount()).toBe(0);
            expect(getPayload(id)).toBeNull();
        });

        it('PS-U-025: handles multiple payloads with different expiration times', () => {
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
        it('PS-U-026: handles large number of stored payloads', () => {
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

        it('PS-U-027: handles storing exact 800KB threshold', () => {
            const exactData = 'x'.repeat(MAX_NATIVE_MESSAGE_SIZE);

            expect(shouldUseLargePayload(exactData)).toBe(true);

            const id = trackPayload(storePayload(exactData));
            const retrieved = getPayload(id);

            expect(retrieved).toBe(exactData);
        });

        it('PS-U-028: handles binary-like data strings', () => {
            const binaryData = '\x00\x01\x02\xFF\xFE';

            const result = shouldUseLargePayload(binaryData);

            expect(result).toBe(false);

            const id = trackPayload(storePayload(binaryData));
            expect(getPayload(id)).toBe(binaryData);
        });
    });
});
