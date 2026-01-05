/**
 * CometD Handlers for Streaming API
 *
 * Handles subscribe and unsubscribe requests for CometD channels.
 * Streaming events are sent back via Native Messaging.
 */

const { subscribe, unsubscribe } = require('../cometd/cometd-client');
const { sendMessage } = require('../native-messaging');

/**
 * Handle CometD subscribe request
 * Sets up a streaming subscription and forwards events via Native Messaging
 *
 * @param {object} request - Subscribe request
 * @param {string} request.subscriptionId - Unique subscription ID
 * @param {string} request.accessToken - Salesforce access token
 * @param {string} request.instanceUrl - Salesforce instance URL
 * @param {string} request.channel - Channel to subscribe to
 * @param {string} [request.replayPreset] - LATEST, EARLIEST, or CUSTOM
 * @param {string|number} [request.replayId] - Replay ID for CUSTOM preset
 * @param {string} [request.apiVersion] - API version
 * @returns {Promise<object>}
 */
async function handleCometdSubscribe(request) {
    const {
        subscriptionId,
        accessToken,
        instanceUrl,
        channel,
        replayPreset = 'LATEST',
        replayId,
        apiVersion
    } = request;

    if (!subscriptionId || !accessToken || !instanceUrl || !channel) {
        return {
            success: false,
            error: 'Missing required fields: subscriptionId, accessToken, instanceUrl, channel'
        };
    }

    try {
        const result = await subscribe({
            subscriptionId,
            accessToken,
            instanceUrl,
            channel,
            replayPreset,
            replayId,
            apiVersion,

            onEvent: ({ subscriptionId: subId, event }) => {
                sendMessage({
                    type: 'streamEvent',
                    subscriptionId: subId,
                    event
                });
            },

            onError: ({ subscriptionId: subId, error, code }) => {
                console.error(`[CometD] Stream error: ${error}`);
                sendMessage({
                    type: 'streamError',
                    subscriptionId: subId,
                    error,
                    code
                });
            },

            onEnd: ({ subscriptionId: subId }) => {
                console.error(`[CometD] Stream ended`);
                sendMessage({
                    type: 'streamEnd',
                    subscriptionId: subId
                });
            }
        });

        return result;
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Handle CometD unsubscribe request
 *
 * @param {object} request - Unsubscribe request
 * @param {string} request.subscriptionId - Subscription ID to cancel
 * @returns {object}
 */
function handleCometdUnsubscribe(request) {
    const { subscriptionId } = request;

    if (!subscriptionId) {
        return {
            success: false,
            error: 'Missing subscriptionId'
        };
    }

    return unsubscribe(subscriptionId);
}

module.exports = {
    handleCometdSubscribe,
    handleCometdUnsubscribe
};
