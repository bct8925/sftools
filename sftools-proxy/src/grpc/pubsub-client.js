/**
 * Salesforce Pub/Sub API gRPC Client
 *
 * Provides a wrapper around the Salesforce Pub/Sub API for
 * subscribing to and publishing Platform Events.
 */

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.join(__dirname, '../../proto/pubsub_api.proto');

// Salesforce Pub/Sub API endpoint
const PUBSUB_ENDPOINT = 'api.pubsub.salesforce.com:7443';

// Cached proto definition
let protoDefinition = null;

// Active subscriptions by ID
const subscriptions = new Map();

/**
 * Load and cache the proto definition
 * @returns {Promise<object>} - The loaded proto definition
 */
async function loadProto() {
    if (protoDefinition) {
        return protoDefinition;
    }

    const packageDefinition = await protoLoader.load(PROTO_PATH, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
    });

    protoDefinition = grpc.loadPackageDefinition(packageDefinition);
    return protoDefinition;
}

/**
 * Create authentication metadata for Salesforce API calls
 * @param {string} accessToken - Salesforce access token
 * @param {string} instanceUrl - Salesforce instance URL
 * @param {string} tenantId - Salesforce org/tenant ID
 * @returns {grpc.Metadata}
 */
function createAuthMetadata(accessToken, instanceUrl, tenantId) {
    const metadata = new grpc.Metadata();
    metadata.add('accesstoken', accessToken);
    metadata.add('instanceurl', instanceUrl);
    metadata.add('tenantid', tenantId);
    return metadata;
}

/**
 * Extract org ID from access token if it's a JWT
 * Falls back to empty string if not a JWT
 * @param {string} accessToken - Salesforce access token
 * @returns {string} - Org ID or empty string
 */
function extractOrgIdFromToken(accessToken) {
    try {
        // Salesforce access tokens from certain OAuth flows are JWTs
        const parts = accessToken.split('.');
        if (parts.length === 3) {
            // Decode the payload (base64url)
            const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
            return decoded.organization_id || '';
        }
    } catch (e) {
        // Not a JWT or failed to parse
    }
    return '';
}

/**
 * Create a Pub/Sub API client
 * @param {string} accessToken - Salesforce access token
 * @param {string} instanceUrl - Salesforce instance URL
 * @param {string} [tenantId] - Optional tenant ID (extracted from token if not provided)
 * @returns {Promise<{client: object, metadata: grpc.Metadata}>}
 */
async function createClient(accessToken, instanceUrl, tenantId) {
    const proto = await loadProto();
    const PubSub = proto.eventbus.v1.PubSub;

    // Create SSL credentials for secure connection
    const credentials = grpc.credentials.createSsl();

    // Create the client
    const client = new PubSub(PUBSUB_ENDPOINT, credentials);

    // Use provided tenant ID or try to extract from token
    const orgId = tenantId || extractOrgIdFromToken(accessToken);
    const metadata = createAuthMetadata(accessToken, instanceUrl, orgId);

    return { client, metadata };
}

/**
 * Get topic information
 * @param {string} accessToken - Salesforce access token
 * @param {string} instanceUrl - Salesforce instance URL
 * @param {string} topicName - Topic name (e.g., '/event/MyEvent__e')
 * @param {string} [tenantId] - Optional tenant ID
 * @returns {Promise<object>}
 */
async function getTopic(accessToken, instanceUrl, topicName, tenantId) {
    const { client, metadata } = await createClient(accessToken, instanceUrl, tenantId);

    return new Promise((resolve, reject) => {
        client.GetTopic({ topic_name: topicName }, metadata, (error, response) => {
            if (error) {
                reject(error);
            } else {
                resolve(response);
            }
        });
    });
}

/**
 * Get schema for a topic
 * @param {string} accessToken - Salesforce access token
 * @param {string} instanceUrl - Salesforce instance URL
 * @param {string} schemaId - Schema ID
 * @param {string} [tenantId] - Optional tenant ID
 * @returns {Promise<object>}
 */
async function getSchema(accessToken, instanceUrl, schemaId, tenantId) {
    const { client, metadata } = await createClient(accessToken, instanceUrl, tenantId);

    return new Promise((resolve, reject) => {
        client.GetSchema({ schema_id: schemaId }, metadata, (error, response) => {
            if (error) {
                reject(error);
            } else {
                resolve(response);
            }
        });
    });
}

/**
 * Subscribe to a topic
 * @param {object} options - Subscription options
 * @param {string} options.subscriptionId - Unique ID for this subscription
 * @param {string} options.accessToken - Salesforce access token
 * @param {string} options.instanceUrl - Salesforce instance URL
 * @param {string} options.topicName - Topic to subscribe to
 * @param {string} [options.replayPreset] - LATEST, EARLIEST, or CUSTOM
 * @param {Buffer} [options.replayId] - Replay ID for CUSTOM preset
 * @param {number} [options.numRequested] - Number of events to request (default: 100)
 * @param {string} [options.tenantId] - Optional tenant ID
 * @param {function} options.onEvent - Callback for received events
 * @param {function} options.onError - Callback for errors
 * @param {function} options.onEnd - Callback for stream end
 * @returns {Promise<object>}
 */
async function subscribe(options) {
    const {
        subscriptionId,
        accessToken,
        instanceUrl,
        topicName,
        replayPreset = 'LATEST',
        replayId,
        numRequested = 100,
        tenantId,
        onEvent,
        onError,
        onEnd
    } = options;

    const { client, metadata } = await createClient(accessToken, instanceUrl, tenantId);

    // Create bidirectional stream
    const call = client.Subscribe(metadata);

    // Handle incoming events
    call.on('data', (fetchResponse) => {
        if (fetchResponse.events && fetchResponse.events.length > 0) {
            for (const consumerEvent of fetchResponse.events) {
                onEvent({
                    subscriptionId,
                    event: consumerEvent
                });
            }
        }

        // Request more events to maintain flow
        if (fetchResponse.pending_num_requested < numRequested / 2) {
            call.write({
                topic_name: topicName,
                num_requested: numRequested
            });
        }
    });

    // Handle errors
    call.on('error', (error) => {
        subscriptions.delete(subscriptionId);
        onError({
            subscriptionId,
            error: error.message,
            code: error.code
        });
    });

    // Handle stream end
    call.on('end', () => {
        subscriptions.delete(subscriptionId);
        onEnd({ subscriptionId });
    });

    // Send initial fetch request
    const fetchRequest = {
        topic_name: topicName,
        replay_preset: replayPreset === 'EARLIEST' ? 1 : (replayPreset === 'CUSTOM' ? 2 : 0),
        num_requested: numRequested
    };

    if (replayPreset === 'CUSTOM' && replayId) {
        fetchRequest.replay_id = replayId;
    }

    call.write(fetchRequest);

    // Store subscription for management
    subscriptions.set(subscriptionId, {
        call,
        client,
        topicName
    });

    return { success: true, subscriptionId };
}

/**
 * Unsubscribe from a topic
 * @param {string} subscriptionId - Subscription ID to cancel
 * @returns {object}
 */
function unsubscribe(subscriptionId) {
    const sub = subscriptions.get(subscriptionId);
    if (sub) {
        sub.call.end();
        subscriptions.delete(subscriptionId);
        return { success: true };
    }
    return { success: false, error: 'Subscription not found' };
}

/**
 * Publish events to a topic
 * @param {string} accessToken - Salesforce access token
 * @param {string} instanceUrl - Salesforce instance URL
 * @param {string} topicName - Topic to publish to
 * @param {Array} events - Array of ProducerEvent objects
 * @param {string} [tenantId] - Optional tenant ID
 * @returns {Promise<object>}
 */
async function publish(accessToken, instanceUrl, topicName, events, tenantId) {
    const { client, metadata } = await createClient(accessToken, instanceUrl, tenantId);

    return new Promise((resolve, reject) => {
        client.Publish({
            topic_name: topicName,
            events
        }, metadata, (error, response) => {
            if (error) {
                reject(error);
            } else {
                resolve(response);
            }
        });
    });
}

/**
 * Get all active subscription IDs
 * @returns {string[]}
 */
function getActiveSubscriptions() {
    return Array.from(subscriptions.keys());
}

module.exports = {
    createClient,
    getTopic,
    getSchema,
    subscribe,
    unsubscribe,
    publish,
    getActiveSubscriptions,
    subscriptions,
    extractOrgIdFromToken
};
