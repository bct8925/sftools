/**
 * Protocol Router
 *
 * Determines which streaming protocol to use based on channel path.
 */

/**
 * Get the appropriate protocol for a given channel
 * @param {string} channel - Channel path (e.g., /event/MyEvent__e, /topic/MyTopic)
 * @returns {'grpc'|'cometd'} Protocol to use
 */
function getProtocolForChannel(channel) {
    // Platform Events use gRPC Pub/Sub API
    if (channel.startsWith('/event/')) {
        return 'grpc';
    }

    // PushTopics, Change Data Capture, and System Topics use CometD
    // /topic/* - PushTopics
    // /data/* - Change Data Capture
    // /systemTopic/* - System Topics (e.g., /systemTopic/Logging)
    return 'cometd';
}

/**
 * Check if a channel uses gRPC protocol
 * @param {string} channel - Channel path
 * @returns {boolean}
 */
function isGrpcChannel(channel) {
    return getProtocolForChannel(channel) === 'grpc';
}

/**
 * Check if a channel uses CometD protocol
 * @param {string} channel - Channel path
 * @returns {boolean}
 */
function isCometdChannel(channel) {
    return getProtocolForChannel(channel) === 'cometd';
}

module.exports = {
    getProtocolForChannel,
    isGrpcChannel,
    isCometdChannel
};
