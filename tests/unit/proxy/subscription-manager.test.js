/**
 * Tests for sftools-proxy/src/subscription-manager.js
 *
 * Test IDs: SM-U-001 through SM-U-006
 * - SM-U-001: add() - Adds subscription
 * - SM-U-002: get() - Returns subscription
 * - SM-U-003: remove() - Removes subscription
 * - SM-U-004: getByChannel() - Returns by channel
 * - SM-U-005: count() - Returns correct count
 * - SM-U-006: clear() - Removes all
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

        it('adds multiple subscriptions', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });
            add('sub-002', { protocol: 'cometd', channel: '/topic/Topic1', cleanup: vi.fn() });

            expect(count()).toBe(2);
            expect(get('sub-001')).toBeDefined();
            expect(get('sub-002')).toBeDefined();
        });

        it('overwrites existing subscription with same ID', () => {
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

        it('increments count when adding new subscription', () => {
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

        it('returns undefined for non-existent ID', () => {
            expect(get('non-existent')).toBeUndefined();
        });

        it('returns correct info when multiple subscriptions exist', () => {
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

        it('returns false when removing non-existent subscription', () => {
            const result = remove('non-existent');

            expect(result).toBe(false);
        });

        it('decrements count when removing subscription', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });
            add('sub-002', { protocol: 'cometd', channel: '/topic/Topic1', cleanup: vi.fn() });

            expect(count()).toBe(2);
            remove('sub-001');
            expect(count()).toBe(1);
            remove('sub-002');
            expect(count()).toBe(0);
        });

        it('only removes specified subscription', () => {
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

        it('returns empty array when no subscriptions match channel', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });

            const results = getByChannel('/topic/NoMatch');

            expect(results).toEqual([]);
        });

        it('returns empty array when no subscriptions exist', () => {
            const results = getByChannel('/event/Event1__e');

            expect(results).toEqual([]);
        });

        it('returns array of [subscriptionId, info] pairs', () => {
            const cleanup = vi.fn();
            const info = { protocol: 'grpc', channel: '/event/Event1__e', cleanup };

            add('sub-001', info);

            const results = getByChannel('/event/Event1__e');

            expect(results).toHaveLength(1);
            expect(results[0]).toEqual(['sub-001', info]);
        });

        it('does not return subscriptions from different channels', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });
            add('sub-002', { protocol: 'cometd', channel: '/topic/Topic1', cleanup: vi.fn() });
            add('sub-003', { protocol: 'grpc', channel: '/event/Event2__e', cleanup: vi.fn() });

            const results = getByChannel('/topic/Topic1');

            expect(results).toHaveLength(1);
            expect(results[0][0]).toBe('sub-002');
        });

        it('matches channel exactly (case-sensitive)', () => {
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

        it('returns correct count for single subscription', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });

            expect(count()).toBe(1);
        });

        it('returns correct count for multiple subscriptions', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });
            add('sub-002', { protocol: 'cometd', channel: '/topic/Topic1', cleanup: vi.fn() });
            add('sub-003', { protocol: 'grpc', channel: '/event/Event2__e', cleanup: vi.fn() });

            expect(count()).toBe(3);
        });

        it('decrements after removing subscription', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });
            add('sub-002', { protocol: 'cometd', channel: '/topic/Topic1', cleanup: vi.fn() });

            expect(count()).toBe(2);
            remove('sub-001');
            expect(count()).toBe(1);
        });

        it('does not increment when overwriting subscription', () => {
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

        it('works when no subscriptions exist', () => {
            expect(count()).toBe(0);

            clear();

            expect(count()).toBe(0);
        });

        it('allows adding subscriptions after clearing', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });
            clear();
            add('sub-002', { protocol: 'cometd', channel: '/topic/Topic1', cleanup: vi.fn() });

            expect(count()).toBe(1);
            expect(get('sub-002')).toBeDefined();
        });

        it('returns getByChannel as empty after clear', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });
            add('sub-002', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });

            clear();

            const results = getByChannel('/event/Event1__e');
            expect(results).toEqual([]);
        });
    });

    describe('getAll', () => {
        it('returns Map with all subscriptions', () => {
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

        it('returns empty Map when no subscriptions exist', () => {
            const all = getAll();

            expect(all).toBeInstanceOf(Map);
            expect(all.size).toBe(0);
        });

        it('returns reference to internal Map (modifications affect subscription manager)', () => {
            add('sub-001', { protocol: 'grpc', channel: '/event/Event1__e', cleanup: vi.fn() });

            const all = getAll();
            all.delete('sub-001');

            expect(count()).toBe(0);
            expect(get('sub-001')).toBeUndefined();
        });
    });

    describe('integration scenarios', () => {
        it('handles full lifecycle: add, get, remove', () => {
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

        it('handles multiple subscriptions on same channel', () => {
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

        it('handles mixed protocol subscriptions', () => {
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
