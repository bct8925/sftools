#!/usr/bin/env node

/**
 * sftools Local Proxy
 *
 * Native Messaging host for the sftools Chrome extension.
 * Provides:
 * - REST API proxying (bypasses CORS)
 * - gRPC/HTTP2 support for Salesforce Pub/Sub API
 * - Large payload handling via HTTP fallback
 */

const { readMessage, sendMessage } = require('./native-messaging');
const { startServer } = require('./http-server');
const { storePayload, shouldUseLargePayload } = require('./payload-store');
const { handleRest } = require('./handlers/rest');
const { handleGetTopic, handleGetSchema } = require('./handlers/grpc');
const { handleSubscribe, handleUnsubscribe } = require('./handlers/streaming');

const VERSION = '1.0.0';

// HTTP server info (set during init)
let httpPort = null;
let httpSecret = null;

/**
 * Message handlers by type
 */
const handlers = {
    /**
     * Initialize the proxy - starts HTTP server and returns connection info
     */
    init: async () => {
        const serverInfo = await startServer();
        httpPort = serverInfo.port;
        httpSecret = serverInfo.secret;

        return {
            success: true,
            version: VERSION,
            httpPort,
            secret: httpSecret
        };
    },

    /**
     * Health check / ping
     */
    ping: () => ({
        success: true,
        version: VERSION
    }),

    /**
     * REST API proxy
     */
    rest: handleRest,

    /**
     * Unified streaming handlers (routes to gRPC or CometD based on channel)
     */
    subscribe: handleSubscribe,
    unsubscribe: handleUnsubscribe,

    /**
     * gRPC-specific metadata handlers (for Platform Events)
     */
    getTopic: handleGetTopic,
    getSchema: handleGetSchema
};

/**
 * Send a response, using large payload handling if needed
 * @param {number} id - Request ID for correlation
 * @param {object} response - Response object to send
 */
function sendResponse(id, response) {
    const json = JSON.stringify(response);

    if (shouldUseLargePayload(json)) {
        // Store payload and return reference
        const payloadId = storePayload(json);
        sendMessage({
            id,
            success: true,
            largePayload: payloadId
        });
    } else {
        // Send directly via Native Messaging
        sendMessage({ id, ...response });
    }
}

/**
 * Process a single message
 * @param {object} message - Incoming message with type and id
 */
async function processMessage(message) {
    const { id, type } = message;

    if (!type) {
        sendResponse(id, { success: false, error: 'Missing message type' });
        return;
    }

    const handler = handlers[type];

    if (!handler) {
        sendResponse(id, { success: false, error: `Unknown message type: ${type}` });
        return;
    }

    try {
        const response = await handler(message);
        sendResponse(id, response);
    } catch (err) {
        sendResponse(id, { success: false, error: err.message });
    }
}

/**
 * Main message loop
 */
async function main() {
    // Log to stderr (stdout is reserved for Native Messaging)
    console.error(`sftools-proxy v${VERSION} starting...`);

    try {
        while (true) {
            const message = await readMessage();
            await processMessage(message);
        }
    } catch (err) {
        // stdin closed or fatal error
        console.error('Proxy shutting down:', err.message);
        process.exit(0);
    }
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err);
    process.exit(1);
});

// Start the proxy
main();
