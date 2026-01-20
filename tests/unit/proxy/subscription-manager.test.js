/**
 * Tests for sftools-proxy/src/subscription-manager.js
 *
 * Test IDs: SM-U-001 through SM-U-036
 * - SM-U-001: add() - Adds subscription
 * - SM-U-002: get() - Returns subscription
 * - SM-U-003: remove() - Removes subscription
 * - SM-U-004: getByChannel() - Returns by channel
 * - SM-U-005: count() - Returns correct count
 * - SM-U-006: clear() - Removes all
 * - SM-U-007: add() - Adds multiple subscriptions
 * - SM-U-008: add() - Overwrites existing subscription
 * - SM-U-009: add() - Increments count
 * - SM-U-010: get() - Returns undefined for non-existent ID
 * - SM-U-011: get() - Returns correct info with multiple subscriptions
 * - SM-U-012: remove() - Returns false for non-existent subscription
 * - SM-U-013: remove() - Decrements count
 * - SM-U-014: remove() - Only removes specified subscription
 * - SM-U-015: getByChannel() - Returns empty array when no match
 * - SM-U-016: getByChannel() - Returns empty array when no subscriptions
 * - SM-U-017: getByChannel() - Returns [subscriptionId, info] pairs
 * - SM-U-018: getByChannel() - Does not return different channels
 * - SM-U-019: getByChannel() - Matches channel exactly (case-sensitive)
 * - SM-U-020: count() - Returns correct count for single subscription
 * - SM-U-021: count() - Returns correct count for multiple subscriptions
 * - SM-U-022: count() - Decrements after removing
 * - SM-U-023: count() - Does not increment when overwriting
 * - SM-U-024: clear() - Works when no subscriptions exist
 * - SM-U-025: clear() - Allows adding after clearing
 * - SM-U-026: clear() - Returns empty getByChannel after clear
 * - SM-U-027: getAll() - Returns Map with all subscriptions
 * - SM-U-028: getAll() - Returns empty Map when no subscriptions
 * - SM-U-029: getAll() - Returns reference to internal Map
 * - SM-U-030: integration - Full lifecycle: add, get, remove
 * - SM-U-031: integration - Multiple subscriptions on same channel
 * - SM-U-032: integration - Mixed protocol subscriptions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import the CommonJS module
const subscriptionManager = await import('../../../sftools-proxy/src/subscription-manager.js');
const { add, get, remove, getAll, getByChannel, count, clear } = subscriptionManager;

describe('subscription-manager', () => {
    // Clear subscriptions before each test to ensure isolation
    beforeEach(() => {
        clear();
    });

    describe('add', () => {
        it('SM-U-001: adds a subscription with all required fields', () => {
            const cleanup = vi.fn();
            const info = {
                protocol: 'grpc',
                channel: '/event/MyEvent__e',
                cleanup
            };

            add('sub-001', info);

            const retrieved = get('sub-001');
            expect(retrieved).toEqual(info);
            expect(retrieved.protocol).toBe('grpc');
            expect(retrieved.channel).toBe('/event/MyEvent__e');
            expect(retrieved.cleanup).toBe(cleanup);
        });

        it('SM-U-007: adds multiple subscriptions', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });
            add('sub-002', { protocol: 'cometd', channel: '/topic/Topic1', cleanup: vi.fn() });

            expect(count()).toBe(2);
            expect(get('sub-001')).toBeDefined();
            expect(get('sub-002')).toBeDefined();
        });

        it('SM-U-008: overwrites existing subscription with same ID', () => {
            const cleanup1 = vi.fn();
            const cleanup2 = vi.fn();

            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: cleanup1 });
            add('sub-001', { protocol: 'cometd', channel: '/topic/Topic1', cleanup: cleanup2 });

            const retrieved = get('sub-001');
            expect(retrieved.protocol).toBe('cometd');
            expect(retrieved.channel).toBe('/topic/Topic1');
            expect(retrieved.cleanup).toBe(cleanup2);
            expect(count()).toBe(1);
        });

        it('SM-U-009: increments count when adding new subscription', () => {
            expect(count()).toBe(0);
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });
            expect(count()).toBe(1);
            add('sub-002', { protocol: 'cometd', channel: '/topic/Topic1', cleanup: vi.fn() });
            expect(count()).toBe(2);
        });
    });

    describe('get', () => {
        it('SM-U-002: returns subscription info for existing ID', () => {
            const cleanup = vi.fn();
            const info = { protocol: 'grpc', channel: '/event/MyEvent__e', cleanup };

            add('sub-001', info);

            expect(get('sub-001')).toEqual(info);
        });

        it('SM-U-010: returns undefined for non-existent ID', () => {
            expect(get('non-existent')).toBeUndefined();
        });

        it('SM-U-011: returns correct info when multiple subscriptions exist', () => {
            const cleanup1 = vi.fn();
            const cleanup2 = vi.fn();
            const info1 = { protocol: 'grpc', channel: '/event/Event1__e', cleanup: cleanup1 };
            const info2 = { protocol: 'cometd', channel: '/topic/Topic1', cleanup: cleanup2 };

            add('sub-001', info1);
            add('sub-002', info2);

            expect(get('sub-001')).toEqual(info1);
            expect(get('sub-002')).toEqual(info2);
        });
    });

    describe('remove', () => {
        it('SM-U-003: removes subscription and returns true', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });

            const result = remove('sub-001');

            expect(result).toBe(true);
            expect(get('sub-001')).toBeUndefined();
            expect(count()).toBe(0);
        });

        it('SM-U-012: returns false when removing non-existent subscription', () => {
            const result = remove('non-existent');

            expect(result).toBe(false);
        });

        it('SM-U-013: decrements count when removing subscription', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });
            add('sub-002', { protocol: 'cometd', channel: '/topic/Topic1', cleanup: vi.fn() });

            expect(count()).toBe(2);
            remove('sub-001');
            expect(count()).toBe(1);
            remove('sub-002');
            expect(count()).toBe(0);
        });

        it('SM-U-014: only removes specified subscription', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });
            add('sub-002', { protocol: 'cometd', channel: '/topic/Topic1', cleanup: vi.fn() });

            remove('sub-001');

            expect(get('sub-001')).toBeUndefined();
            expect(get('sub-002')).toBeDefined();
            expect(count()).toBe(1);
        });
    });

    describe('getByChannel', () => {
        it('SM-U-004: returns subscriptions matching channel', () => {
            const cleanup1 = vi.fn();
            const cleanup2 = vi.fn();
            const cleanup3 = vi.fn();

            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: cleanup1 });
            add('sub-002', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: cleanup2 });
            add('sub-003', { protocol: 'cometd', channel: '/topic/Topic1', cleanup: cleanup3 });

            const results = getByChannel('/event/Event1__e');

            expect(results).toHaveLength(2);
            expect(results.map(([id]) => id)).toEqual(['sub-001', 'sub-002']);
            expect(results[0][1].cleanup).toBe(cleanup1);
            expect(results[1][1].cleanup).toBe(cleanup2);
        });

        it('SM-U-015: returns empty array when no subscriptions match channel', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });

            const results = getByChannel('/topic/NoMatch');

            expect(results).toEqual([]);
        });

        it('SM-U-016: returns empty array when no subscriptions exist', () => {
            const results = getByChannel('/event/Event1__e');

            expect(results).toEqual([]);
        });

        it('SM-U-017: returns array of [subscriptionId, info] pairs', () => {
            const cleanup = vi.fn();
            const info = { protocol: 'grpc', channel: '/event/Event1__e', cleanup };

            add('sub-001', info);

            const results = getByChannel('/event/Event1__e');

            expect(results).toHaveLength(1);
            expect(results[0]).toEqual(['sub-001', info]);
        });

        it('SM-U-018: does not return subscriptions from different channels', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });
            add('sub-002', { protocol: 'cometd', channel: '/topic/Topic1', cleanup: vi.fn() });
            add('sub-003', { protocol: 'grpc', channel: '/event/Event2__e', cleanup: vi.fn() });

            const results = getByChannel('/topic/Topic1');

            expect(results).toHaveLength(1);
            expect(results[0][0]).toBe('sub-002');
        });

        it('SM-U-019: matches channel exactly (case-sensitive)', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });

            const results1 = getByChannel('/event/Event1__e');
            const results2 = getByChannel('/event/event1__e');

            expect(results1).toHaveLength(1);
            expect(results2).toHaveLength(0);
        });
    });

    describe('count', () => {
        it('SM-U-005: returns 0 when no subscriptions exist', () => {
            expect(count()).toBe(0);
        });

        it('SM-U-020: returns correct count for single subscription', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });

            expect(count()).toBe(1);
        });

        it('SM-U-021: returns correct count for multiple subscriptions', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });
            add('sub-002', { protocol: 'cometd', channel: '/topic/Topic1', cleanup: vi.fn() });
            add('sub-003', { protocol: 'grpc', channel: '/event/Event2__e', cleanup: vi.fn() });

            expect(count()).toBe(3);
        });

        it('SM-U-022: decrements after removing subscription', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });
            add('sub-002', { protocol: 'cometd', channel: '/topic/Topic1', cleanup: vi.fn() });

            expect(count()).toBe(2);
            remove('sub-001');
            expect(count()).toBe(1);
        });

        it('SM-U-023: does not increment when overwriting subscription', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });
            expect(count()).toBe(1);
            add('sub-001', { protocol: 'cometd', channel: '/topic/Topic1', cleanup: vi.fn() });
            expect(count()).toBe(1);
        });
    });

    describe('clear', () => {
        it('SM-U-006: removes all subscriptions', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });
            add('sub-002', { protocol: 'cometd', channel: '/topic/Topic1', cleanup: vi.fn() });
            add('sub-003', { protocol: 'grpc', channel: '/event/Event2__e', cleanup: vi.fn() });

            expect(count()).toBe(3);

            clear();

            expect(count()).toBe(0);
            expect(get('sub-001')).toBeUndefined();
            expect(get('sub-002')).toBeUndefined();
            expect(get('sub-003')).toBeUndefined();
        });

        it('SM-U-024: works when no subscriptions exist', () => {
            expect(count()).toBe(0);

            clear();

            expect(count()).toBe(0);
        });

        it('SM-U-025: allows adding subscriptions after clearing', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });
            clear();
            add('sub-002', { protocol: 'cometd', channel: '/topic/Topic1', cleanup: vi.fn() });

            expect(count()).toBe(1);
            expect(get('sub-002')).toBeDefined();
        });

        it('SM-U-026: returns getByChannel as empty after clear', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });
            add('sub-002', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });

            clear();

            const results = getByChannel('/event/Event1__e');
            expect(results).toEqual([]);
        });
    });

    describe('getAll', () => {
        it('SM-U-027: returns Map with all subscriptions', () => {
            const info1 = { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() };
            const info2 = { protocol: 'cometd', channel: '/topic/Topic1', cleanup: vi.fn() };

            add('sub-001', info1);
            add('sub-002', info2);

            const all = getAll();

            expect(all).toBeInstanceOf(Map);
            expect(all.size).toBe(2);
            expect(all.get('sub-001')).toEqual(info1);
            expect(all.get('sub-002')).toEqual(info2);
        });

        it('SM-U-028: returns empty Map when no subscriptions exist', () => {
            const all = getAll();

            expect(all).toBeInstanceOf(Map);
            expect(all.size).toBe(0);
        });

        it('SM-U-029: returns reference to internal Map (modifications affect subscription manager)', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });

            const all = getAll();
            all.delete('sub-001');

            expect(count()).toBe(0);
            expect(get('sub-001')).toBeUndefined();
        });
    });

    describe('integration scenarios', () => {
        it('SM-U-030: handles full lifecycle: add, get, remove', () => {
            const cleanup = vi.fn();
            const info = { protocol: 'grpc', channel: '/event/Event1__e', cleanup };

            // Add
            add('sub-001', info);
            expect(count()).toBe(1);

            // Get
            const retrieved = get('sub-001');
            expect(retrieved).toEqual(info);

            // Remove
            const removed = remove('sub-001');
            expect(removed).toBe(true);
            expect(count()).toBe(0);
            expect(get('sub-001')).toBeUndefined();
        });

        it('SM-U-031: handles multiple subscriptions on same channel', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });
            add('sub-002', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });
            add('sub-003', { protocol: 'grpc', channel: '/event/Event2__e', cleanup: vi.fn() });

            expect(count()).toBe(3);

            const event1Subs = getByChannel('/event/Event1__e');
            expect(event1Subs).toHaveLength(2);

            remove('sub-001');
            const event1SubsAfter = getByChannel('/event/Event1__e');
            expect(event1SubsAfter).toHaveLength(1);
            expect(count()).toBe(2);
        });

        it('SM-U-032: handles mixed protocol subscriptions', () => {
            add('grpc-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });
            add('cometd-001', { protocol: 'cometd', channel: '/topic/Topic1', cleanup: vi.fn() });
            add('cometd-002', { protocol: 'cometd', channel: '/systemTopic/Logging', cleanup: vi.fn() });

            expect(count()).toBe(3);

            const grpc = get('grpc-001');
            const cometd1 = get('cometd-001');
            const cometd2 = get('cometd-002');

            expect(grpc.protocol).toBe('grpc');
            expect(cometd1.protocol).toBe('cometd');
            expect(cometd2.protocol).toBe('cometd');

            expect(getByChannel('/topic/Topic1')).toHaveLength(1);
            expect(getByChannel('/systemTopic/Logging')).toHaveLength(1);
        });
    });
});
