/**
 * Pubsub module for inter-component communication in LWC components.
 *
 * This replaces document-level events (connection-changed, theme-changed, etc.)
 * with a more controlled publish/subscribe pattern.
 *
 * @example
 * // Subscribe to events
 * import { subscribe } from '../../lib/pubsub.js';
 *
 * connectedCallback() {
 *   this._unsubscribe = subscribe('connectionChanged', this.handleConnectionChange.bind(this));
 * }
 *
 * disconnectedCallback() {
 *   this._unsubscribe?.();
 * }
 *
 * @example
 * // Publish events
 * import { publish } from '../../lib/pubsub.js';
 *
 * handleConnectionSelect(connection) {
 *   publish('connectionChanged', connection);
 * }
 */

const callbacks = new Map();

/**
 * Subscribe to a channel.
 * @param {string} channel - The channel name to subscribe to
 * @param {Function} callback - The callback to invoke when a message is published
 * @returns {Function} Unsubscribe function - call this to remove the subscription
 */
export function subscribe(channel, callback) {
    if (!callbacks.has(channel)) {
        callbacks.set(channel, new Set());
    }
    callbacks.get(channel).add(callback);

    // Return unsubscribe function
    return () => {
        const channelCallbacks = callbacks.get(channel);
        if (channelCallbacks) {
            channelCallbacks.delete(callback);
            // Clean up empty channels
            if (channelCallbacks.size === 0) {
                callbacks.delete(channel);
            }
        }
    };
}

/**
 * Publish a message to a channel.
 * @param {string} channel - The channel name to publish to
 * @param {*} data - The data to send to subscribers
 */
export function publish(channel, data) {
    const channelCallbacks = callbacks.get(channel);
    if (channelCallbacks) {
        channelCallbacks.forEach((callback) => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in pubsub callback for channel "${channel}":`, error);
            }
        });
    }
}

/**
 * Check if a channel has any subscribers.
 * @param {string} channel - The channel name to check
 * @returns {boolean} True if the channel has subscribers
 */
export function hasSubscribers(channel) {
    const channelCallbacks = callbacks.get(channel);
    return channelCallbacks ? channelCallbacks.size > 0 : false;
}

/**
 * Clear all subscriptions for a channel.
 * @param {string} channel - The channel name to clear
 */
export function clearChannel(channel) {
    callbacks.delete(channel);
}

/**
 * Clear all subscriptions.
 * Use with caution - typically only for testing or cleanup.
 */
export function clearAll() {
    callbacks.clear();
}

// Standard channel names for the application
export const CHANNELS = {
    CONNECTION_CHANGED: 'connectionChanged',
    THEME_CHANGED: 'themeChanged',
    PROXY_STATUS_CHANGED: 'proxyStatusChanged'
};
