// Native Messaging Module for sftools Chrome Extension
// Handles communication with the local proxy via Chrome Native Messaging

const NATIVE_HOST_NAME = 'com.sftools.proxy';

let nativePort = null;
let pendingRequests = new Map();
let requestId = 0;

// HTTP server info for large payloads (received during init)
let proxyHttpPort = null;
let proxySecret = null;

/**
 * Connect to native host and perform init handshake
 * @returns {Promise<{success: boolean, version?: string, error?: string}>}
 */
export async function connectNative() {
    if (nativePort) {
        return { success: true, version: 'connected' };
    }

    return new Promise((resolve) => {
        try {
            nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);

            nativePort.onMessage.addListener((message) => {
                // Check if this is a streaming event (no request ID)
                if (message.type === 'grpcEvent' || message.type === 'grpcError' || message.type === 'grpcEnd') {
                    chrome.runtime.sendMessage(message).catch(() => {});
                    return;
                }

                // Handle request-response messages
                const pending = pendingRequests.get(message.id);
                if (pending) {
                    pending.resolve(message);
                    pendingRequests.delete(message.id);
                }
            });

            nativePort.onDisconnect.addListener(() => {
                const error = chrome.runtime.lastError?.message || 'Disconnected';
                console.log('Native host disconnected:', error);

                nativePort = null;
                proxyHttpPort = null;
                proxySecret = null;

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
export function disconnectNative() {
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
        }, 30000);

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
export async function sendProxyRequest(message) {
    const response = await sendNativeMessage(message);

    if (response.largePayload) {
        const payloadData = await fetchLargePayload(response.largePayload);
        const fullResponse = JSON.parse(payloadData);
        return fullResponse;
    }

    return response;
}

/**
 * Check if proxy is connected
 * @returns {boolean}
 */
export function isProxyConnected() {
    return nativePort !== null && proxyHttpPort !== null;
}

/**
 * Get proxy connection info
 * @returns {object}
 */
export function getProxyInfo() {
    return {
        connected: isProxyConnected(),
        httpPort: proxyHttpPort,
        hasSecret: !!proxySecret
    };
}
