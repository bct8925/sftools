// Events Tab Utility Functions
// Pure functions extracted for testability

/**
 * Builds grouped channel options for select dropdowns
 * @param {Array} platformEvents - Custom platform events
 * @param {Array} standardEvents - Standard platform events
 * @param {Array} pushTopics - PushTopic channels
 * @param {Array} systemTopics - System topic channels
 * @returns {Object} Grouped channel data with optgroup labels and options
 */
export function buildChannelOptions(platformEvents = [], standardEvents = [], pushTopics = [], systemTopics = []) {
    const groups = [];

    // Platform Events (gRPC) - Custom
    if (platformEvents.length > 0) {
        const options = platformEvents.map(evt => ({
            value: `/event/${evt.QualifiedApiName}`,
            label: evt.Label || evt.DeveloperName
        }));
        groups.push({
            label: 'Platform Events - Custom',
            options
        });
    }

    // Platform Events (gRPC) - Standard
    if (standardEvents.length > 0) {
        const options = standardEvents.map(evt => ({
            value: `/event/${evt.name}`,
            label: evt.label
        }));
        groups.push({
            label: 'Platform Events - Standard',
            options
        });
    }

    // PushTopics (CometD)
    if (pushTopics.length > 0) {
        const options = pushTopics.map(topic => ({
            value: `/topic/${topic.Name}`,
            label: topic.Name
        }));
        groups.push({
            label: 'PushTopics',
            options
        });
    }

    // System Topics (CometD)
    if (systemTopics.length > 0) {
        const options = systemTopics.map(topic => ({
            value: topic.channel,
            label: topic.label
        }));
        groups.push({
            label: 'System Topics',
            options
        });
    }

    return groups;
}

/**
 * Parses a stream message and returns normalized data
 * @param {Object} message - Raw stream message
 * @returns {Object} Parsed message with type and data
 */
export function parseStreamMessage(message) {
    const { type, subscriptionId, event, error } = message;

    switch (type) {
        case 'streamEvent':
            return {
                type: 'event',
                subscriptionId,
                data: {
                    channel: event?.channel,
                    protocol: event?.protocol,
                    replayId: event?.replayId,
                    payload: event?.payload,
                    error: event?.error
                }
            };

        case 'streamError':
            return {
                type: 'error',
                subscriptionId,
                data: {
                    error
                }
            };

        case 'streamEnd':
            return {
                type: 'end',
                subscriptionId,
                data: null
            };

        default:
            return {
                type: 'unknown',
                subscriptionId,
                data: null
            };
    }
}

/**
 * Formats an event for display in the stream output
 * @param {Object} event - Event data
 * @param {number} eventNumber - Sequential event number
 * @param {string} timestamp - ISO timestamp
 * @returns {Object} Formatted event entry
 */
export function formatEventEntry(event, eventNumber, timestamp) {
    return {
        _eventNumber: eventNumber,
        _receivedAt: timestamp,
        _channel: event.channel,
        _protocol: event.protocol,
        replayId: event.replayId,
        payload: event.payload,
        error: event.error
    };
}

/**
 * Formats a system message for display in the stream output
 * @param {string} msg - Message text
 * @returns {string} Formatted system message with timestamp
 */
export function formatSystemMessage(msg) {
    const timestamp = new Date().toLocaleTimeString();
    return `// [${timestamp}] ${msg}`;
}
