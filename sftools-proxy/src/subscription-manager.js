/**
 * Subscription Manager
 *
 * Central registry for all active streaming subscriptions regardless of protocol.
 * Tracks subscription state and provides cleanup coordination.
 */

// Map: subscriptionId -> {protocol, channel, cleanup}
const subscriptions = new Map();

/**
 * Add a subscription to the registry
 * @param {string} subscriptionId - Unique subscription ID
 * @param {object} info - Subscription info
 * @param {string} info.protocol - 'grpc' or 'cometd'
 * @param {string} info.channel - Channel path (e.g., /event/MyEvent__e)
 * @param {function} info.cleanup - Function to call when unsubscribing
 */
function add(subscriptionId, info) {
    subscriptions.set(subscriptionId, info);
}

/**
 * Remove a subscription from the registry
 * @param {string} subscriptionId - Subscription ID to remove
 * @returns {boolean} True if subscription existed and was removed
 */
function remove(subscriptionId) {
    return subscriptions.delete(subscriptionId);
}

/**
 * Get subscription info
 * @param {string} subscriptionId - Subscription ID to look up
 * @returns {object|undefined} Subscription info or undefined
 */
function get(subscriptionId) {
    return subscriptions.get(subscriptionId);
}

/**
 * Get all active subscriptions
 * @returns {Map} All subscriptions
 */
function getAll() {
    return subscriptions;
}

/**
 * Get subscriptions by channel
 * @param {string} channel - Channel path to filter by
 * @returns {array} Array of [subscriptionId, info] pairs
 */
function getByChannel(channel) {
    return Array.from(subscriptions.entries())
        .filter(([_, info]) => info.channel === channel);
}

/**
 * Get count of active subscriptions
 * @returns {number} Number of active subscriptions
 */
function count() {
    return subscriptions.size;
}

/**
 * Clear all subscriptions (for cleanup/shutdown)
 */
function clear() {
    subscriptions.clear();
}

module.exports = {
    add,
    remove,
    get,
    getAll,
    getByChannel,
    count,
    clear
};
