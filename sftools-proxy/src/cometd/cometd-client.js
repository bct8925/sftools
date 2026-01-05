/**
 * Salesforce CometD Streaming Client
 *
 * Provides CometD (Bayeux protocol) support for Salesforce Streaming API.
 * Used for PushTopics, Change Data Capture, and System Topics.
 */

const faye = require('faye');
const subscriptionManager = require('../subscription-manager');

// Default Salesforce API version for CometD endpoint
const DEFAULT_API_VERSION = '62.0';

// Client pool: key (instanceUrl + token hash) -> { client, refCount }
const clientPool = new Map();

/**
 * Create a unique key for the client pool
 * @param {string} instanceUrl
 * @param {string} accessToken
 * @returns {string}
 */
function getClientKey(instanceUrl, accessToken) {
    // Use first 20 chars of token as part of key to distinguish sessions
    return `${instanceUrl}:${accessToken.substring(0, 20)}`;
}

/**
 * Create replay extension for Salesforce event replay
 * @param {object} replayMap - Map of channel -> replayId
 * @returns {object} Faye extension
 */
function createReplayExtension(replayMap) {
    return {
        outgoing: (message, callback) => {
            if (message.channel === '/meta/subscribe') {
                message.ext = message.ext || {};
                message.ext.replay = replayMap;
            }
            callback(message);
        }
    };
}

/**
 * Get or create a CometD client for the given instance
 * @param {string} instanceUrl - Salesforce instance URL
 * @param {string} accessToken - Salesforce access token
 * @param {string} [apiVersion] - API version (default: 62.0)
 * @returns {faye.Client}
 */
function getOrCreateClient(instanceUrl, accessToken, apiVersion = DEFAULT_API_VERSION) {
    const key = getClientKey(instanceUrl, accessToken);
    let poolEntry = clientPool.get(key);

    if (poolEntry) {
        poolEntry.refCount++;
        console.error(`[CometD] Reusing client for ${instanceUrl}, refCount: ${poolEntry.refCount}`);
        return poolEntry.client;
    }

    const cometdUrl = `${instanceUrl}/cometd/${apiVersion}`;
    console.error(`[CometD] Creating new client for: ${cometdUrl}`);

    const client = new faye.Client(cometdUrl, {
        timeout: 120,
        retry: 5
    });

    // Set Authorization header for Salesforce authentication
    client.setHeader('Authorization', `Bearer ${accessToken}`);

    // Handle client events
    client.on('transport:down', () => {
        console.error(`[CometD] Transport down for ${instanceUrl}`);
    });

    client.on('transport:up', () => {
        console.error(`[CometD] Transport up for ${instanceUrl}`);
    });

    clientPool.set(key, { client, refCount: 1, accessToken });
    return client;
}

/**
 * Release a client reference
 * @param {string} instanceUrl
 * @param {string} accessToken
 */
function releaseClient(instanceUrl, accessToken) {
    const key = getClientKey(instanceUrl, accessToken);
    const poolEntry = clientPool.get(key);

    if (poolEntry) {
        poolEntry.refCount--;
        console.error(`[CometD] Released client for ${instanceUrl}, refCount: ${poolEntry.refCount}`);

        if (poolEntry.refCount <= 0) {
            console.error(`[CometD] Disconnecting client for ${instanceUrl}`);
            poolEntry.client.disconnect();
            clientPool.delete(key);
        }
    }
}

/**
 * Convert replay preset to CometD replay ID
 * @param {string} replayPreset - LATEST, EARLIEST, or CUSTOM
 * @param {string|number} [replayId] - Custom replay ID
 * @returns {number}
 */
function getReplayId(replayPreset, replayId) {
    switch (replayPreset) {
        case 'EARLIEST':
            return -2; // All retained events
        case 'CUSTOM':
            return typeof replayId === 'number' ? replayId : parseInt(replayId, 10);
        case 'LATEST':
        default:
            return -1; // New events only
    }
}

/**
 * Subscribe to a CometD channel
 * @param {object} options - Subscription options
 * @param {string} options.subscriptionId - Unique ID for this subscription
 * @param {string} options.accessToken - Salesforce access token
 * @param {string} options.instanceUrl - Salesforce instance URL
 * @param {string} options.channel - Channel to subscribe to (e.g., /topic/MyTopic)
 * @param {string} [options.replayPreset] - LATEST, EARLIEST, or CUSTOM
 * @param {string|number} [options.replayId] - Replay ID for CUSTOM preset
 * @param {string} [options.apiVersion] - API version
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
        channel,
        replayPreset = 'LATEST',
        replayId,
        apiVersion,
        onEvent,
        onError,
        onEnd
    } = options;

    console.error(`[CometD] Subscribing to ${channel} (replay: ${replayPreset})`);

    try {
        const client = getOrCreateClient(instanceUrl, accessToken, apiVersion);

        // Add replay extension for this subscription
        const replayValue = getReplayId(replayPreset, replayId);
        const replayExtension = createReplayExtension({ [channel]: replayValue });
        client.addExtension(replayExtension);

        // Subscribe to the channel
        const subscription = client.subscribe(channel, (message) => {
            console.error(`[CometD] Event received on ${channel}`);

            const eventReplayId = message.event?.replayId || message.replayId;

            onEvent({
                subscriptionId,
                event: {
                    replayId: eventReplayId,
                    payload: message.payload || message,
                    channel,
                    protocol: 'cometd'
                }
            });
        });

        // Handle subscription callbacks
        subscription.then(
            () => {
                console.error(`[CometD] Subscribed to ${channel}`);
            },
            (error) => {
                console.error(`[CometD] Subscription failed for ${channel}: ${error}`);
                subscriptionManager.remove(subscriptionId);
                releaseClient(instanceUrl, accessToken);
                onError({
                    subscriptionId,
                    error: String(error),
                    code: null
                });
            }
        );

        // Store subscription in central manager
        subscriptionManager.add(subscriptionId, {
            protocol: 'cometd',
            channel,
            fayeSubscription: subscription,
            cleanup: () => {
                subscription.cancel();
                releaseClient(instanceUrl, accessToken);
            }
        });

        return { success: true, subscriptionId };
    } catch (error) {
        console.error(`[CometD] Subscribe error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Unsubscribe from a CometD channel
 * @param {string} subscriptionId - Subscription ID to cancel
 * @returns {object}
 */
function unsubscribe(subscriptionId) {
    const sub = subscriptionManager.get(subscriptionId);
    if (sub && sub.protocol === 'cometd') {
        sub.cleanup();
        subscriptionManager.remove(subscriptionId);
        return { success: true };
    }
    return { success: false, error: 'Subscription not found' };
}

/**
 * Disconnect all clients (for cleanup/shutdown)
 */
function disconnectAll() {
    for (const [key, entry] of clientPool) {
        console.error(`[CometD] Disconnecting client: ${key}`);
        entry.client.disconnect();
    }
    clientPool.clear();
}

module.exports = {
    subscribe,
    unsubscribe,
    getOrCreateClient,
    releaseClient,
    disconnectAll
};
