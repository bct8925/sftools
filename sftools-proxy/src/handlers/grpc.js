/**
 * gRPC Handlers for Pub/Sub API
 *
 * Handles subscribe, unsubscribe, getTopic, and getSchema requests.
 * Streaming events are sent back via Native Messaging.
 */

const { subscribe, unsubscribe, getTopic, getSchema } = require('../grpc/pubsub-client');
const { decodeConsumerEvent } = require('../grpc/schema-cache');
const { sendMessage } = require('../native-messaging');

/**
 * Handle subscribe request
 * Sets up a streaming subscription and forwards events via Native Messaging
 *
 * @param {object} request - Subscribe request
 * @param {string} request.subscriptionId - Unique subscription ID
 * @param {string} request.accessToken - Salesforce access token
 * @param {string} request.instanceUrl - Salesforce instance URL
 * @param {string} request.topicName - Topic to subscribe to
 * @param {string} [request.replayPreset] - LATEST, EARLIEST, or CUSTOM
 * @param {string} [request.replayId] - Base64 replay ID for CUSTOM preset
 * @param {number} [request.numRequested] - Number of events to request
 * @param {string} [request.tenantId] - Optional tenant ID
 * @returns {Promise<object>}
 */
async function handleGrpcSubscribe(request) {
    const {
        subscriptionId,
        accessToken,
        instanceUrl,
        topicName,
        replayPreset = 'LATEST',
        replayId,
        numRequested = 100,
        tenantId
    } = request;

    if (!subscriptionId || !accessToken || !instanceUrl || !topicName) {
        return {
            success: false,
            error: 'Missing required fields: subscriptionId, accessToken, instanceUrl, topicName'
        };
    }

    try {
        const result = await subscribe({
            subscriptionId,
            accessToken,
            instanceUrl,
            topicName,
            replayPreset,
            replayId: replayId ? Buffer.from(replayId, 'base64') : undefined,
            numRequested,
            tenantId,

            // Event callback - decode and forward via Native Messaging
            onEvent: async ({ subscriptionId: subId, event }) => {
                try {
                    // Decode the Avro payload
                    const decodedEvent = await decodeConsumerEvent(
                        event,
                        accessToken,
                        instanceUrl,
                        tenantId
                    );

                    // Send event to extension via Native Messaging
                    sendMessage({
                        type: 'grpcEvent',
                        subscriptionId: subId,
                        event: decodedEvent
                    });
                } catch (error) {
                    // Send decode error
                    sendMessage({
                        type: 'grpcEvent',
                        subscriptionId: subId,
                        event: {
                            error: `Failed to decode event: ${error.message}`
                        }
                    });
                }
            },

            // Error callback
            onError: ({ subscriptionId: subId, error, code }) => {
                sendMessage({
                    type: 'grpcError',
                    subscriptionId: subId,
                    error,
                    code
                });
            },

            // End callback
            onEnd: ({ subscriptionId: subId }) => {
                sendMessage({
                    type: 'grpcEnd',
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
 * Handle unsubscribe request
 *
 * @param {object} request - Unsubscribe request
 * @param {string} request.subscriptionId - Subscription ID to cancel
 * @returns {object}
 */
function handleGrpcUnsubscribe(request) {
    const { subscriptionId } = request;

    if (!subscriptionId) {
        return {
            success: false,
            error: 'Missing subscriptionId'
        };
    }

    return unsubscribe(subscriptionId);
}

/**
 * Handle getTopic request
 *
 * @param {object} request - GetTopic request
 * @param {string} request.accessToken - Salesforce access token
 * @param {string} request.instanceUrl - Salesforce instance URL
 * @param {string} request.topicName - Topic name to query
 * @param {string} [request.tenantId] - Optional tenant ID
 * @returns {Promise<object>}
 */
async function handleGetTopic(request) {
    const { accessToken, instanceUrl, topicName, tenantId } = request;

    if (!accessToken || !instanceUrl || !topicName) {
        return {
            success: false,
            error: 'Missing required fields: accessToken, instanceUrl, topicName'
        };
    }

    try {
        const topicInfo = await getTopic(accessToken, instanceUrl, topicName, tenantId);
        return {
            success: true,
            topic: {
                name: topicInfo.topic_name,
                tenantGuid: topicInfo.tenant_guid,
                canPublish: topicInfo.can_publish,
                canSubscribe: topicInfo.can_subscribe,
                schemaId: topicInfo.schema_id
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Handle getSchema request
 *
 * @param {object} request - GetSchema request
 * @param {string} request.accessToken - Salesforce access token
 * @param {string} request.instanceUrl - Salesforce instance URL
 * @param {string} request.schemaId - Schema ID to fetch
 * @param {string} [request.tenantId] - Optional tenant ID
 * @returns {Promise<object>}
 */
async function handleGetSchema(request) {
    const { accessToken, instanceUrl, schemaId, tenantId } = request;

    if (!accessToken || !instanceUrl || !schemaId) {
        return {
            success: false,
            error: 'Missing required fields: accessToken, instanceUrl, schemaId'
        };
    }

    try {
        const schemaInfo = await getSchema(accessToken, instanceUrl, schemaId, tenantId);
        return {
            success: true,
            schema: {
                schemaId: schemaInfo.schema_id,
                schemaJson: schemaInfo.schema_json
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    handleGrpcSubscribe,
    handleGrpcUnsubscribe,
    handleGetTopic,
    handleGetSchema
};
