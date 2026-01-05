/**
 * Unified Streaming Handlers
 *
 * Routes subscribe/unsubscribe requests to the appropriate protocol handler
 * based on the channel path.
 */

const { getProtocolForChannel } = require('../protocols/router');
const subscriptionManager = require('../subscription-manager');
const { handleGrpcSubscribe, handleGrpcUnsubscribe } = require('./grpc');
const { handleCometdSubscribe, handleCometdUnsubscribe } = require('./cometd');

/**
 * Handle unified subscribe request
 * Routes to gRPC or CometD based on channel prefix
 *
 * @param {object} request - Subscribe request
 * @param {string} request.subscriptionId - Unique subscription ID
 * @param {string} request.accessToken - Salesforce access token
 * @param {string} request.instanceUrl - Salesforce instance URL
 * @param {string} request.channel - Channel to subscribe to
 * @param {string} [request.replayPreset] - LATEST, EARLIEST, or CUSTOM
 * @param {string} [request.replayId] - Replay ID for CUSTOM preset
 * @returns {Promise<object>}
 */
async function handleSubscribe(request) {
    const { channel } = request;

    if (!channel) {
        return {
            success: false,
            error: 'Missing channel'
        };
    }

    const protocol = getProtocolForChannel(channel);
    console.error(`[Streaming] Routing ${channel} to ${protocol} handler`);

    if (protocol === 'grpc') {
        // gRPC uses 'topicName' instead of 'channel'
        return handleGrpcSubscribe({
            ...request,
            topicName: channel
        });
    }

    return handleCometdSubscribe(request);
}

/**
 * Handle unified unsubscribe request
 * Looks up the subscription to determine which protocol handler to use
 *
 * @param {object} request - Unsubscribe request
 * @param {string} request.subscriptionId - Subscription ID to cancel
 * @returns {object}
 */
function handleUnsubscribe(request) {
    const { subscriptionId } = request;

    if (!subscriptionId) {
        return {
            success: false,
            error: 'Missing subscriptionId'
        };
    }

    const subscription = subscriptionManager.get(subscriptionId);

    if (!subscription) {
        return {
            success: false,
            error: 'Subscription not found'
        };
    }

    console.error(`[Streaming] Unsubscribing ${subscriptionId} (protocol: ${subscription.protocol})`);

    if (subscription.protocol === 'grpc') {
        return handleGrpcUnsubscribe(request);
    }

    return handleCometdUnsubscribe(request);
}

module.exports = {
    handleSubscribe,
    handleUnsubscribe
};
