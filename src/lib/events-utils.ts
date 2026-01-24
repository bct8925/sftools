// Events Tab Utility Functions
// Pure functions extracted for testability

export interface PlatformEventCustom {
    QualifiedApiName: string;
    Label?: string;
    DeveloperName: string;
}

export interface PlatformEventStandard {
    name: string;
    label: string;
}

export interface PushTopic {
    Name: string;
}

export interface SystemTopic {
    channel: string;
    label: string;
}

export interface ChannelOption {
    value: string;
    label: string;
}

export interface ChannelGroup {
    label: string;
    options: ChannelOption[];
}

export interface StreamEventData {
    channel?: string;
    protocol?: string;
    replayId?: number | string;
    payload?: unknown;
    error?: string;
}

export interface StreamMessageBase {
    type: string;
    subscriptionId?: string;
}

export interface StreamEventMessage extends StreamMessageBase {
    type: 'streamEvent';
    event: {
        channel?: string;
        protocol?: string;
        replayId?: number | string;
        payload?: unknown;
        error?: string;
    };
}

export interface StreamErrorMessage extends StreamMessageBase {
    type: 'streamError';
    error: string;
}

export interface StreamEndMessage extends StreamMessageBase {
    type: 'streamEnd';
}

export type StreamMessage = StreamEventMessage | StreamErrorMessage | StreamEndMessage;

export interface ParsedStreamMessage {
    type: 'event' | 'error' | 'end' | 'unknown';
    subscriptionId?: string;
    data: StreamEventData | { error: string } | null;
}

export interface FormattedEventEntry {
    _eventNumber: number;
    _receivedAt: string;
    _channel?: string;
    _protocol?: string;
    replayId?: number | string;
    payload?: unknown;
    error?: string;
}

/**
 * Builds grouped channel options for select dropdowns
 * @param platformEvents - Custom platform events
 * @param standardEvents - Standard platform events
 * @param pushTopics - PushTopic channels
 * @param systemTopics - System topic channels
 * @returns Grouped channel data with optgroup labels and options
 */
export function buildChannelOptions(
    platformEvents: PlatformEventCustom[] = [],
    standardEvents: PlatformEventStandard[] = [],
    pushTopics: PushTopic[] = [],
    systemTopics: SystemTopic[] = []
): ChannelGroup[] {
    const groups: ChannelGroup[] = [];

    // Platform Events (gRPC) - Custom
    if (platformEvents.length > 0) {
        const options = platformEvents.map(evt => ({
            value: `/event/${evt.QualifiedApiName}`,
            label: evt.Label || evt.DeveloperName,
        }));
        groups.push({
            label: 'Platform Events - Custom',
            options,
        });
    }

    // Platform Events (gRPC) - Standard
    if (standardEvents.length > 0) {
        const options = standardEvents.map(evt => ({
            value: `/event/${evt.name}`,
            label: evt.label,
        }));
        groups.push({
            label: 'Platform Events - Standard',
            options,
        });
    }

    // PushTopics (CometD)
    if (pushTopics.length > 0) {
        const options = pushTopics.map(topic => ({
            value: `/topic/${topic.Name}`,
            label: topic.Name,
        }));
        groups.push({
            label: 'PushTopics',
            options,
        });
    }

    // System Topics (CometD)
    if (systemTopics.length > 0) {
        const options = systemTopics.map(topic => ({
            value: topic.channel,
            label: topic.label,
        }));
        groups.push({
            label: 'System Topics',
            options,
        });
    }

    return groups;
}

/**
 * Parses a stream message and returns normalized data
 * @param message - Raw stream message
 * @returns Parsed message with type and data
 */
export function parseStreamMessage(message: StreamMessage): ParsedStreamMessage {
    const { type, subscriptionId } = message;

    switch (type) {
        case 'streamEvent': {
            const { event } = message as StreamEventMessage;
            return {
                type: 'event',
                subscriptionId,
                data: {
                    channel: event?.channel,
                    protocol: event?.protocol,
                    replayId: event?.replayId,
                    payload: event?.payload,
                    error: event?.error,
                },
            };
        }

        case 'streamError': {
            const { error } = message as StreamErrorMessage;
            return {
                type: 'error',
                subscriptionId,
                data: {
                    error,
                },
            };
        }

        case 'streamEnd':
            return {
                type: 'end',
                subscriptionId,
                data: null,
            };

        default:
            return {
                type: 'unknown',
                subscriptionId,
                data: null,
            };
    }
}

/**
 * Formats an event for display in the stream output
 * @param event - Event data
 * @param eventNumber - Sequential event number
 * @param timestamp - ISO timestamp
 * @returns Formatted event entry
 */
export function formatEventEntry(
    event: StreamEventData,
    eventNumber: number,
    timestamp: string
): FormattedEventEntry {
    return {
        _eventNumber: eventNumber,
        _receivedAt: timestamp,
        _channel: event.channel,
        _protocol: event.protocol,
        replayId: event.replayId,
        payload: event.payload,
        error: event.error,
    };
}

/**
 * Formats a system message for display in the stream output
 * @param msg - Message text
 * @returns Formatted system message with timestamp
 */
export function formatSystemMessage(msg: string): string {
    const timestamp = new Date().toLocaleTimeString();
    return `// [${timestamp}] ${msg}`;
}
