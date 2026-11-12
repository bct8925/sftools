/**
 * Tests for sftools-proxy/src/event-sink.js
 * The VS Code extension host replaces the Native Messaging sink with its own.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { setEventSink, emitEvent } = require('../../../sftools-proxy/src/event-sink.js');

describe('event-sink', () => {
    afterEach(() => setEventSink(null));

    it('sends events to the sink that was set', () => {
        const sink = vi.fn();
        setEventSink(sink);
        emitEvent({ type: 'streamEvent', subscriptionId: 's1' });
        expect(sink).toHaveBeenCalledWith({ type: 'streamEvent', subscriptionId: 's1' });
    });

    it('lets pubsub-client load its proto from another path when bundled', () => {
        const pubsub = require('../../../sftools-proxy/src/grpc/pubsub-client.js');
        expect(typeof pubsub.setProtoPath).toBe('function');
    });
});
