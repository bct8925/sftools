/**
 * Tests for sftools-proxy/src/protocols/router.js
 *
 * Test IDs: PR-U-001 through PR-U-005
 * - PR-U-001: getProtocolForChannel() - Returns grpc for /event/*
 * - PR-U-002: getProtocolForChannel() - Returns cometd for /topic/*
 * - PR-U-003: getProtocolForChannel() - Returns cometd for /data/*
 * - PR-U-004: isGrpcChannel() - Returns true for /event/*
 * - PR-U-005: isCometdChannel() - Returns true for /topic/*
 */

import { describe, it, expect } from 'vitest';
import { getProtocolForChannel, isGrpcChannel, isCometdChannel } from '../../../sftools-proxy/src/protocols/router.js';

describe('Protocol Router', () => {
    describe('getProtocolForChannel', () => {
        it('PR-U-001: returns grpc for /event/* channels', () => {
            expect(getProtocolForChannel('/event/MyEvent__e')).toBe('grpc');
        });

        it('returns grpc for /event/ with no event name', () => {
            expect(getProtocolForChannel('/event/')).toBe('grpc');
        });

        it('returns grpc for nested /event/ paths', () => {
            expect(getProtocolForChannel('/event/Order_Event__e')).toBe('grpc');
            expect(getProtocolForChannel('/event/Custom_Event__e')).toBe('grpc');
        });

        it('PR-U-002: returns cometd for /topic/* channels', () => {
            expect(getProtocolForChannel('/topic/InvoiceUpdates')).toBe('cometd');
        });

        it('returns cometd for /topic/ with no topic name', () => {
            expect(getProtocolForChannel('/topic/')).toBe('cometd');
        });

        it('returns cometd for nested /topic/ paths', () => {
            expect(getProtocolForChannel('/topic/AccountUpdates')).toBe('cometd');
            expect(getProtocolForChannel('/topic/MyPushTopic')).toBe('cometd');
        });

        it('PR-U-003: returns cometd for /data/* channels (CDC)', () => {
            expect(getProtocolForChannel('/data/AccountChangeEvent')).toBe('cometd');
        });

        it('returns cometd for /data/ with no event name', () => {
            expect(getProtocolForChannel('/data/')).toBe('cometd');
        });

        it('returns cometd for nested /data/ paths', () => {
            expect(getProtocolForChannel('/data/ContactChangeEvent')).toBe('cometd');
            expect(getProtocolForChannel('/data/OpportunityChangeEvent')).toBe('cometd');
        });

        it('returns cometd for /systemTopic/* channels', () => {
            expect(getProtocolForChannel('/systemTopic/Logging')).toBe('cometd');
        });

        it('returns cometd for /systemTopic/ with no topic name', () => {
            expect(getProtocolForChannel('/systemTopic/')).toBe('cometd');
        });

        it('returns cometd for unknown channel patterns', () => {
            expect(getProtocolForChannel('/unknown/Channel')).toBe('cometd');
            expect(getProtocolForChannel('/custom/path')).toBe('cometd');
            expect(getProtocolForChannel('no-leading-slash')).toBe('cometd');
        });

        it('returns cometd for empty string', () => {
            expect(getProtocolForChannel('')).toBe('cometd');
        });
    });

    describe('isGrpcChannel', () => {
        it('PR-U-004: returns true for /event/* channels', () => {
            expect(isGrpcChannel('/event/MyEvent__e')).toBe(true);
        });

        it('returns true for /event/ prefix', () => {
            expect(isGrpcChannel('/event/')).toBe(true);
            expect(isGrpcChannel('/event/Order_Event__e')).toBe(true);
        });

        it('returns false for /topic/* channels', () => {
            expect(isGrpcChannel('/topic/MyTopic')).toBe(false);
        });

        it('returns false for /data/* channels', () => {
            expect(isGrpcChannel('/data/AccountChangeEvent')).toBe(false);
        });

        it('returns false for /systemTopic/* channels', () => {
            expect(isGrpcChannel('/systemTopic/Logging')).toBe(false);
        });

        it('returns false for unknown channel patterns', () => {
            expect(isGrpcChannel('/unknown/Channel')).toBe(false);
            expect(isGrpcChannel('')).toBe(false);
        });
    });

    describe('isCometdChannel', () => {
        it('PR-U-005: returns true for /topic/* channels', () => {
            expect(isCometdChannel('/topic/MyTopic')).toBe(true);
        });

        it('returns true for /topic/ prefix', () => {
            expect(isCometdChannel('/topic/')).toBe(true);
            expect(isCometdChannel('/topic/InvoiceUpdates')).toBe(true);
        });

        it('returns true for /data/* channels', () => {
            expect(isCometdChannel('/data/AccountChangeEvent')).toBe(true);
        });

        it('returns true for /systemTopic/* channels', () => {
            expect(isCometdChannel('/systemTopic/Logging')).toBe(true);
        });

        it('returns true for unknown channel patterns', () => {
            expect(isCometdChannel('/unknown/Channel')).toBe(true);
            expect(isCometdChannel('')).toBe(true);
        });

        it('returns false for /event/* channels', () => {
            expect(isCometdChannel('/event/MyEvent__e')).toBe(false);
        });

        it('returns false for /event/ prefix', () => {
            expect(isCometdChannel('/event/')).toBe(false);
            expect(isCometdChannel('/event/Order_Event__e')).toBe(false);
        });
    });

    describe('edge cases', () => {
        it('handles case-sensitive channel paths', () => {
            expect(getProtocolForChannel('/Event/MyEvent__e')).toBe('cometd');
            expect(getProtocolForChannel('/EVENT/MyEvent__e')).toBe('cometd');
            expect(getProtocolForChannel('/event/MyEvent__e')).toBe('grpc');
        });

        it('does not match /event substring in middle of path', () => {
            expect(getProtocolForChannel('/topic/event/something')).toBe('cometd');
            expect(getProtocolForChannel('/other/event/path')).toBe('cometd');
        });

        it('requires /event/ at start of path', () => {
            expect(getProtocolForChannel('event/MyEvent__e')).toBe('cometd');
            expect(getProtocolForChannel(' /event/MyEvent__e')).toBe('cometd');
        });
    });
});
