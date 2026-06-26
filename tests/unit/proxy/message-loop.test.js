/**
 * Tests for sftools-proxy/src/index.js message loop concurrency
 *
 * Test IDs: ML-U-001 through ML-U-003
 * - ML-U-001: Processes messages concurrently (slow request doesn't block later ones)
 * - ML-U-002: Reads the next message without awaiting the previous handler
 * - ML-U-003: A rejected handler doesn't crash the loop
 *
 * Regression coverage for #154: a long-running anonymous Apex execution must not
 * block a concurrent query on the single Native Messaging channel.
 */

import { describe, it, expect } from 'vitest';
import { runMessageLoop } from '../../../sftools-proxy/src/index.js';

/**
 * Build a `read` function that yields the given messages in order, then throws
 * to terminate the loop (mimicking stdin closing).
 */
function readerFor(messages) {
    let index = 0;
    return async () => {
        if (index < messages.length) return messages[index++];
        throw new Error('stdin closed');
    };
}

describe('runMessageLoop', () => {
    it('ML-U-001: processes a slow message without blocking later messages', async () => {
        const order = [];
        let resolveSlow;
        const slow = new Promise(resolve => {
            resolveSlow = resolve;
        });

        const read = readerFor([
            { id: 1, type: 'slow' },
            { id: 2, type: 'fast' },
        ]);

        const handleMessage = async message => {
            if (message.type === 'slow') {
                order.push('slow-start');
                await slow;
                order.push('slow-end');
            } else {
                order.push('fast-start');
                order.push('fast-end');
            }
        };

        const loop = runMessageLoop(read, handleMessage).catch(() => {});

        // Let microtasks flush while the slow handler is still pending
        await new Promise(resolve => setTimeout(resolve, 10));

        // The fast message completed even though the slow one is still in flight
        expect(order).toEqual(['slow-start', 'fast-start', 'fast-end']);

        resolveSlow();
        await loop;
        expect(order).toEqual(['slow-start', 'fast-start', 'fast-end', 'slow-end']);
    });

    it('ML-U-002: reads the next message without awaiting the previous handler', async () => {
        const reads = [];
        const messages = [
            { id: 1, type: 'a' },
            { id: 2, type: 'b' },
        ];
        let index = 0;
        const read = async () => {
            if (index < messages.length) {
                reads.push(messages[index].id);
                return messages[index++];
            }
            throw new Error('stdin closed');
        };

        // Handler never resolves — if reads were awaited, only one would happen
        const handleMessage = () => new Promise(() => {});

        runMessageLoop(read, handleMessage).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(reads).toEqual([1, 2]);
    });

    it('ML-U-003: a rejected handler does not crash the loop', async () => {
        const handled = [];
        const read = readerFor([
            { id: 1, type: 'boom' },
            { id: 2, type: 'ok' },
        ]);

        const handleMessage = async message => {
            handled.push(message.id);
            if (message.type === 'boom') throw new Error('handler failed');
        };

        await runMessageLoop(read, handleMessage).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(handled).toEqual([1, 2]);
    });
});
