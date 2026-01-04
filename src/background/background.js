// Service Worker for sftools Chrome Extension

// ============================================================================
// Native Messaging State
// ============================================================================

const NATIVE_HOST_NAME = 'com.sftools.proxy';

let nativePort = null;
let pendingRequests = new Map();
let requestId = 0;

// HTTP server info for large payloads (received during init)
let proxyHttpPort = null;
let proxySecret = null;

// ============================================================================
// Native Messaging Functions
// ============================================================================

/**
 * Connect to native host and perform init handshake
 * @returns {Promise<{success: boolean, version?: string, error?: string}>}
 */
async function connectNative() {
    if (nativePort) {
        // Already connected, just return success
        return { success: true, version: 'connected' };
    }

    return new Promise((resolve) => {
        try {
            nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);

            // Handle incoming messages
            nativePort.onMessage.addListener((message) => {
                // Check if this is a streaming event (no request ID)
                if (message.type === 'grpcEvent' || message.type === 'grpcError' || message.type === 'grpcEnd') {
                    // Forward streaming events to all extension pages
                    chrome.runtime.sendMessage(message).catch(() => {
                        // Ignore errors if no listeners
                    });
                    return;
                }

                // Handle request-response messages
                const pending = pendingRequests.get(message.id);
                if (pending) {
                    pending.resolve(message);
                    pendingRequests.delete(message.id);
                }
            });

            // Handle disconnect
            nativePort.onDisconnect.addListener(() => {
                const error = chrome.runtime.lastError?.message || 'Disconnected';
                console.log('Native host disconnected:', error);

                nativePort = null;
                proxyHttpPort = null;
                proxySecret = null;

                // Reject all pending requests
                for (const [id, pending] of pendingRequests) {
                    pending.reject(new Error('Native host disconnected'));
                }
                pendingRequests.clear();
            });

            // Perform init handshake to get HTTP server info
            sendNativeMessage({ type: 'init' })
                .then((initResponse) => {
                    if (initResponse.success) {
                        proxyHttpPort = initResponse.httpPort;
                        proxySecret = initResponse.secret;
                        console.log(`Proxy connected: HTTP server on port ${proxyHttpPort}`);

                        // Store connection status
                        chrome.storage.local.set({ proxyConnected: true });
                        resolve(initResponse);
                    } else {
                        throw new Error(initResponse.error || 'Init failed');
                    }
                })
                .catch((err) => {
                    console.error('Native init failed:', err);
                    disconnectNative();
                    resolve({ success: false, error: err.message });
                });

        } catch (err) {
            console.error('Failed to connect to native host:', err);
            resolve({ success: false, error: err.message });
        }
    });
}

/**
 * Disconnect from native host
 */
function disconnectNative() {
    if (nativePort) {
        nativePort.disconnect();
        nativePort = null;
    }
    proxyHttpPort = null;
    proxySecret = null;
    chrome.storage.local.set({ proxyConnected: false });
}

/**
 * Send message to native host (low-level)
 * @param {object} message - Message to send
 * @returns {Promise<object>} - Response from native host
 */
function sendNativeMessage(message) {
    return new Promise((resolve, reject) => {
        if (!nativePort) {
            reject(new Error('Native host not connected'));
            return;
        }

        const id = ++requestId;
        const timeoutId = setTimeout(() => {
            pendingRequests.delete(id);
            reject(new Error('Request timeout'));
        }, 30000); // 30 second timeout

        pendingRequests.set(id, {
            resolve: (response) => {
                clearTimeout(timeoutId);
                resolve(response);
            },
            reject: (error) => {
                clearTimeout(timeoutId);
                reject(error);
            }
        });

        nativePort.postMessage({ id, ...message });
    });
}

/**
 * Fetch large payload from HTTP server using secret
 * @param {string} payloadId - UUID of the payload to fetch
 * @returns {Promise<string>} - The payload data
 */
async function fetchLargePayload(payloadId) {
    if (!proxyHttpPort || !proxySecret) {
        throw new Error('Proxy HTTP server not available');
    }

    const response = await fetch(
        `http://127.0.0.1:${proxyHttpPort}/payload/${payloadId}`,
        { headers: { 'X-Proxy-Secret': proxySecret } }
    );

    if (!response.ok) {
        throw new Error(`Failed to fetch payload: ${response.status}`);
    }

    return await response.text();
}

/**
 * Send proxy request with automatic large payload handling
 * @param {object} message - Message to send to proxy
 * @returns {Promise<object>} - Response with data resolved
 */
async function sendProxyRequest(message) {
    const response = await sendNativeMessage(message);

    // If response references a large payload, fetch it transparently
    if (response.largePayload) {
        const payloadData = await fetchLargePayload(response.largePayload);
        // Parse the payload (it's the full response object as JSON)
        const fullResponse = JSON.parse(payloadData);
        return fullResponse;
    }

    return response;
}

/**
 * Check if proxy is connected
 * @returns {boolean}
 */
function isProxyConnected() {
    return nativePort !== null && proxyHttpPort !== null;
}

/**
 * Get proxy connection info
 * @returns {object}
 */
function getProxyInfo() {
    return {
        connected: isProxyConnected(),
        httpPort: proxyHttpPort,
        hasSecret: !!proxySecret
    };
}

// ============================================================================
// Extension Action Handler
// ============================================================================

// Open app.html when extension icon is clicked
chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: 'dist/app.html' });
});

// ============================================================================
// Message Handlers
// ============================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // --- Existing fetch proxy (for Lite mode) ---
    if (request.type === 'fetch') {
        fetch(request.url, request.options)
            .then(response => {
                const status = response.status;
                const statusText = response.statusText;
                // Extract headers to a plain object
                const headers = {};
                response.headers.forEach((value, key) => {
                    headers[key.toLowerCase()] = value;
                });
                return response.text().then(data => ({
                    success: response.ok,
                    status,
                    statusText,
                    headers,
                    data
                }));
            })
            .then(data => sendResponse(data))
            .catch(error => sendResponse({
                success: false,
                error: error.message
            }));
        return true;
    }

    // --- Proxy connection management ---
    if (request.type === 'connectProxy') {
        connectNative()
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    if (request.type === 'disconnectProxy') {
        disconnectNative();
        sendResponse({ success: true });
        return false;
    }

    if (request.type === 'checkProxyConnection') {
        sendResponse({
            connected: isProxyConnected(),
            ...getProxyInfo()
        });
        return false;
    }

    if (request.type === 'getProxyInfo') {
        sendResponse(getProxyInfo());
        return false;
    }

    // --- Proxy fetch (routes through native host) ---
    if (request.type === 'proxyFetch') {
        if (!isProxyConnected()) {
            sendResponse({ success: false, error: 'Proxy not connected' });
            return false;
        }

        sendProxyRequest({
            type: 'rest',
            url: request.url,
            method: request.method,
            headers: request.headers,
            body: request.body
        })
            .then(response => sendResponse(response))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    // --- gRPC Pub/Sub API handlers ---
    if (request.type === 'subscribe') {
        if (!isProxyConnected()) {
            sendResponse({ success: false, error: 'Proxy not connected' });
            return false;
        }

        const subscriptionId = crypto.randomUUID();
        sendProxyRequest({
            type: 'grpcSubscribe',
            subscriptionId,
            accessToken: request.accessToken,
            instanceUrl: request.instanceUrl,
            topicName: request.topicName,
            replayPreset: request.replayPreset,
            replayId: request.replayId,
            numRequested: request.numRequested,
            tenantId: request.tenantId
        })
            .then(response => sendResponse({ ...response, subscriptionId }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    if (request.type === 'unsubscribe') {
        if (!isProxyConnected()) {
            sendResponse({ success: false, error: 'Proxy not connected' });
            return false;
        }

        sendProxyRequest({
            type: 'grpcUnsubscribe',
            subscriptionId: request.subscriptionId
        })
            .then(response => sendResponse(response))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    if (request.type === 'getTopic') {
        if (!isProxyConnected()) {
            sendResponse({ success: false, error: 'Proxy not connected' });
            return false;
        }

        sendProxyRequest({
            type: 'getTopic',
            accessToken: request.accessToken,
            instanceUrl: request.instanceUrl,
            topicName: request.topicName,
            tenantId: request.tenantId
        })
            .then(response => sendResponse(response))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    if (request.type === 'getSchema') {
        if (!isProxyConnected()) {
            sendResponse({ success: false, error: 'Proxy not connected' });
            return false;
        }

        sendProxyRequest({
            type: 'getSchema',
            accessToken: request.accessToken,
            instanceUrl: request.instanceUrl,
            schemaId: request.schemaId,
            tenantId: request.tenantId
        })
            .then(response => sendResponse(response))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
});

// ============================================================================
// Auto-connect to Proxy on Startup
// ============================================================================

// Silently attempt to connect to the local proxy when the service worker starts.
// This enables automatic connection without requiring a manual trip to Settings.
// If the proxy isn't installed or available, this fails silently.
connectNative()
    .then(result => {
        if (result.success) {
            console.log('Auto-connected to proxy');
        }
    })
    .catch(() => {
        // Silent failure - proxy not available
    });
