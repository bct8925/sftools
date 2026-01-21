/**
 * Tests for src/lib/events-utils.js
 *
 * Test IDs:
 * - E-U-001: buildChannelOptions() - Creates grouped optgroups
 * - E-U-002: parseStreamMessage() - Processes event messages
 * - E-U-003: parseStreamMessage() - Handles error messages
 * - E-U-004: parseStreamMessage() - Handles end messages
 * - E-U-005: formatEventEntry() - Formats event for display
 * - E-U-006: formatSystemMessage() - Formats system message
 */

import { describe, it, expect } from 'vitest';
import {
    buildChannelOptions,
    parseStreamMessage,
    formatEventEntry,
    formatSystemMessage
} from '../../../src/lib/events-utils.js';

describe('events-utils', () => {
    describe('buildChannelOptions', () => {
        it('E-U-001: creates grouped optgroups for all channel types', () => {
            const platformEvents = [
                { QualifiedApiName: 'Order_Event__e', Label: 'Order Event' },
                { QualifiedApiName: 'Shipping_Event__e', DeveloperName: 'Shipping_Event' }
            ];
            const standardEvents = [
                { name: 'AccountChangeEvent', label: 'Account Change Event' }
            ];
            const pushTopics = [
                { Name: 'InvoiceUpdates' },
                { Name: 'OrderChanges' }
            ];
            const systemTopics = [
                { channel: '/systemTopic/Logging', label: 'Logging' }
            ];

            const groups = buildChannelOptions(platformEvents, standardEvents, pushTopics, systemTopics);

            expect(groups).toHaveLength(4);

            // Platform Events - Custom
            expect(groups[0].label).toBe('Platform Events - Custom');
            expect(groups[0].options).toHaveLength(2);
            expect(groups[0].options[0]).toEqual({
                value: '/event/Order_Event__e',
                label: 'Order Event'
            });
            expect(groups[0].options[1]).toEqual({
                value: '/event/Shipping_Event__e',
                label: 'Shipping_Event'
            });

            // Platform Events - Standard
            expect(groups[1].label).toBe('Platform Events - Standard');
            expect(groups[1].options).toHaveLength(1);
            expect(groups[1].options[0]).toEqual({
                value: '/event/AccountChangeEvent',
                label: 'Account Change Event'
            });

            // PushTopics
            expect(groups[2].label).toBe('PushTopics');
            expect(groups[2].options).toHaveLength(2);
            expect(groups[2].options[0]).toEqual({
                value: '/topic/InvoiceUpdates',
                label: 'InvoiceUpdates'
            });

            // System Topics
            expect(groups[3].label).toBe('System Topics');
            expect(groups[3].options).toHaveLength(1);
            expect(groups[3].options[0]).toEqual({
                value: '/systemTopic/Logging',
                label: 'Logging'
            });
        });

        it('E-U-001: handles empty arrays', () => {
            const groups = buildChannelOptions([], [], [], []);

            expect(groups).toHaveLength(0);
        });

        it('E-U-001: omits groups with no channels', () => {
            const platformEvents = [
                { QualifiedApiName: 'Order_Event__e', Label: 'Order Event' }
            ];

            const groups = buildChannelOptions(platformEvents, [], [], []);

            expect(groups).toHaveLength(1);
            expect(groups[0].label).toBe('Platform Events - Custom');
        });

        it('E-U-001: uses DeveloperName when Label is missing', () => {
            const platformEvents = [
                { QualifiedApiName: 'Test_Event__e', DeveloperName: 'Test_Event' }
            ];

            const groups = buildChannelOptions(platformEvents, [], [], []);

            expect(groups[0].options[0].label).toBe('Test_Event');
        });

        it('E-U-001: handles default parameter values', () => {
            const groups = buildChannelOptions();

            expect(groups).toHaveLength(0);
        });
    });

    describe('parseStreamMessage', () => {
        it('E-U-002: processes event messages', () => {
            const message = {
                type: 'streamEvent',
                subscriptionId: 'sub-123',
                event: {
                    channel: '/event/Order_Event__e',
                    protocol: 'grpc',
                    replayId: 12345,
                    payload: { OrderId: '001', Status: 'Completed' }
                }
            };

            const parsed = parseStreamMessage(message);

            expect(parsed.type).toBe('event');
            expect(parsed.subscriptionId).toBe('sub-123');
            expect(parsed.data).toEqual({
                channel: '/event/Order_Event__e',
                protocol: 'grpc',
                replayId: 12345,
                payload: { OrderId: '001', Status: 'Completed' },
                error: undefined
            });
        });

        it('E-U-003: handles error messages', () => {
            const message = {
                type: 'streamError',
                subscriptionId: 'sub-456',
                error: 'Connection timeout'
            };

            const parsed = parseStreamMessage(message);

            expect(parsed.type).toBe('error');
            expect(parsed.subscriptionId).toBe('sub-456');
            expect(parsed.data).toEqual({
                error: 'Connection timeout'
            });
        });

        it('E-U-004: handles end messages', () => {
            const message = {
                type: 'streamEnd',
                subscriptionId: 'sub-789'
            };

            const parsed = parseStreamMessage(message);

            expect(parsed.type).toBe('end');
            expect(parsed.subscriptionId).toBe('sub-789');
            expect(parsed.data).toBeNull();
        });

        it('E-U-004: handles unknown message types', () => {
            const message = {
                type: 'unknownType',
                subscriptionId: 'sub-000'
            };

            const parsed = parseStreamMessage(message);

            expect(parsed.type).toBe('unknown');
            expect(parsed.subscriptionId).toBe('sub-000');
            expect(parsed.data).toBeNull();
        });

        it('E-U-002: handles missing event data gracefully', () => {
            const message = {
                type: 'streamEvent',
                subscriptionId: 'sub-999',
                event: null
            };

            const parsed = parseStreamMessage(message);

            expect(parsed.type).toBe('event');
            expect(parsed.data).toEqual({
                channel: undefined,
                protocol: undefined,
                replayId: undefined,
                payload: undefined,
                error: undefined
            });
        });
    });

    describe('formatEventEntry', () => {
        it('E-U-005: adds event to output with metadata', () => {
            const event = {
                channel: '/event/Order_Event__e',
                protocol: 'grpc',
                replayId: 54321,
                payload: { Status: 'Shipped' }
            };
            const eventNumber = 42;
            const timestamp = '2025-01-19T12:00:00.000Z';

            const formatted = formatEventEntry(event, eventNumber, timestamp);

            expect(formatted).toEqual({
                _eventNumber: 42,
                _receivedAt: '2025-01-19T12:00:00.000Z',
                _channel: '/event/Order_Event__e',
                _protocol: 'grpc',
                replayId: 54321,
                payload: { Status: 'Shipped' },
                error: undefined
            });
        });

        it('E-U-005: preserves error field if present', () => {
            const event = {
                channel: '/event/Test__e',
                protocol: 'grpc',
                replayId: 1,
                payload: null,
                error: 'Payload validation failed'
            };

            const formatted = formatEventEntry(event, 1, '2025-01-19T12:00:00.000Z');

            expect(formatted.error).toBe('Payload validation failed');
        });
    });

    describe('formatSystemMessage', () => {
        it('E-U-006: adds system message with timestamp', () => {
            const message = 'Subscribed to /event/Order_Event__e';

            const formatted = formatSystemMessage(message);

            expect(formatted).toMatch(/^\/\/ \[\d{1,2}:\d{2}:\d{2}( (AM|PM))?\] Subscribed to \/event\/Order_Event__e$/);
        });

        it('E-U-006: formats error messages correctly', () => {
            const message = 'Error: Connection timeout';

            const formatted = formatSystemMessage(message);

            expect(formatted).toMatch(/^\/\/ \[\d{1,2}:\d{2}:\d{2}( (AM|PM))?\] Error: Connection timeout$/);
        });

        it('E-U-006: formats unsubscribe messages correctly', () => {
            const message = 'Unsubscribed';

            const formatted = formatSystemMessage(message);

            expect(formatted).toMatch(/^\/\/ \[\d{1,2}:\d{2}:\d{2}( (AM|PM))?\] Unsubscribed$/);
        });
    });
});
