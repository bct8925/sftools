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

// Salesforce Pub/Sub API endpoint (port 443 works on networks that block 7443)
const PUBSUB_ENDPOINT = 'api.pubsub.salesforce.com:443';

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
 * Extract org ID from access token
 * Salesforce tokens can be:
 * 1. Session tokens: format "00Dxxxxxx!xxxxxx" where 00Dxxxxxx is the org ID
 * 2. JWTs: contains organization_id in the payload
 * @param {string} accessToken - Salesforce access token
 * @returns {string} - Org ID or empty string
 */
function extractOrgIdFromToken(accessToken) {
    if (!accessToken) return '';

    // Try session token format first: 00Dxxxxxx!xxxxxx
    // The org ID is the part before the !
    const exclamationIndex = accessToken.indexOf('!');
    if (exclamationIndex > 0) {
        const potentialOrgId = accessToken.substring(0, exclamationIndex);
        // Salesforce org IDs start with 00D and are 15 or 18 characters
        if (potentialOrgId.startsWith('00D') && (potentialOrgId.length === 15 || potentialOrgId.length === 18)) {
            console.error(`[gRPC] Extracted org ID from session token: ${potentialOrgId}`);
            return potentialOrgId;
        }
    }

    // Try JWT format
    try {
        const parts = accessToken.split('.');
        if (parts.length === 3) {
            const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
            if (decoded.organization_id) {
                console.error(`[gRPC] Extracted org ID from JWT: ${decoded.organization_id}`);
                return decoded.organization_id;
            }
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
    console.error(`[gRPC] Loading proto definition...`);
    const proto = await loadProto();
    const PubSub = proto.eventbus.v1.PubSub;

    // Create SSL credentials for secure connection
    const credentials = grpc.credentials.createSsl();

    console.error(`[gRPC] Creating client for endpoint: ${PUBSUB_ENDPOINT}`);
    // Create the client
    const client = new PubSub(PUBSUB_ENDPOINT, credentials);

    // Use provided tenant ID or try to extract from token
    let orgId = tenantId || extractOrgIdFromToken(accessToken);

    // If we couldn't extract org ID, try to get it from the instance URL
    // Format: https://MyDomainName.my.salesforce.com -> extract org ID requires API call
    // For now, log a warning - the API might still work without it in some cases
    if (!orgId) {
        console.error(`[gRPC] WARNING: Could not extract org ID from token. Authentication may fail.`);
        console.error(`[gRPC] Token starts with: ${accessToken.substring(0, 20)}...`);
    } else {
        console.error(`[gRPC] Using org ID: ${orgId}`);
    }

    const metadata = createAuthMetadata(accessToken, instanceUrl, orgId);
    console.error(`[gRPC] Metadata headers: accesstoken=..., instanceurl=${instanceUrl}, tenantid=${orgId || '(empty)'}`);

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

    console.error(`[gRPC] Subscribing to ${topicName} with replay ${replayPreset}`);

    const { client, metadata } = await createClient(accessToken, instanceUrl, tenantId);

    // Create bidirectional stream
    console.error(`[gRPC] Creating bidirectional stream...`);
    const call = client.Subscribe(metadata);

    // Track stream state
    call.on('metadata', (metadata) => {
        console.error(`[gRPC] Stream metadata received:`, JSON.stringify(metadata.getMap()));
    });

    call.on('status', (status) => {
        console.error(`[gRPC] Stream status: code=${status.code}, details=${status.details}`);
    });

    // Handle incoming events
    call.on('data', (fetchResponse) => {
        console.error(`[gRPC] Received FetchResponse: ${fetchResponse.events?.length || 0} events, pending: ${fetchResponse.pending_num_requested}`);

        if (fetchResponse.events && fetchResponse.events.length > 0) {
            for (const consumerEvent of fetchResponse.events) {
                console.error(`[gRPC] Event received, schema: ${consumerEvent.event?.schema_id}`);
                onEvent({
                    subscriptionId,
                    event: consumerEvent
                });
            }
        }

        // Request more events to maintain flow
        if (fetchResponse.pending_num_requested < numRequested / 2) {
            console.error(`[gRPC] Requesting more events`);
            call.write({
                topic_name: topicName,
                num_requested: numRequested
            });
        }
    });

    // Handle errors
    call.on('error', (error) => {
        console.error(`[gRPC] Stream error: ${error.message} (code: ${error.code})`);
        subscriptions.delete(subscriptionId);
        onError({
            subscriptionId,
            error: error.message,
            code: error.code
        });
    });

    // Handle stream end
    call.on('end', () => {
        console.error(`[gRPC] Stream ended`);
        subscriptions.delete(subscriptionId);
        onEnd({ subscriptionId });
    });

    // Send initial fetch request
    // Note: With enums: String in proto-loader, we pass enum names as strings
    const fetchRequest = {
        topic_name: topicName,
        replay_preset: replayPreset, // 'LATEST', 'EARLIEST', or 'CUSTOM'
        num_requested: numRequested
    };

    if (replayPreset === 'CUSTOM' && replayId) {
        fetchRequest.replay_id = replayId;
    }

    console.error(`[gRPC] Sending initial FetchRequest:`, JSON.stringify(fetchRequest));
    const writeSuccess = call.write(fetchRequest);
    console.error(`[gRPC] FetchRequest write returned: ${writeSuccess}`);

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
