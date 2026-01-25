// Native Messaging Module for sftools Chrome Extension
// Handles communication with the local proxy via Chrome Native Messaging

import { debugInfo } from './debug.js';

const NATIVE_HOST_NAME = 'com.sftools.proxy';

let nativePort: chrome.runtime.Port | null = null;
const pendingRequests = new Map<
    number,
    {
        resolve: (response: NativeMessageResponse) => void;
        reject: (error: Error) => void;
    }
>();
let requestId = 0;

// HTTP server info for large payloads (received during init)
let proxyHttpPort: number | null = null;
let proxySecret: string | null = null;
let proxyVersion: string | null = null;

interface StreamEvent {
    type: 'streamEvent' | 'streamError' | 'streamEnd';
    [key: string]: unknown;
}

interface NativeMessageResponse {
    type?: string;
    id?: number;
    success: boolean;
    version?: string;
    httpPort?: number;
    secret?: string;
    error?: string;
    largePayload?: string;
    data?: string;
    [key: string]: unknown;
}

interface InitResponse {
    success: boolean;
    version?: string;
    httpPort?: number;
    secret?: string;
    error?: string;
    [key: string]: unknown;
}

interface ProxyRequest {
    type: string;
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    subscriptionId?: string;
    accessToken?: string;
    instanceUrl?: string;
    channel?: string;
    replayPreset?: string;
    replayId?: string | number;
    topicName?: string;
    schemaId?: string;
    tenantId?: string;
}

interface ProxyResponse {
    success: boolean;
    data?: string;
    error?: string;
    largePayload?: string;
    [key: string]: unknown;
}

/**
 * Connect to native host and perform init handshake
 */
export function connectNative(): Promise<InitResponse> {
    if (nativePort) {
        return Promise.resolve({ success: true, version: 'connected' });
    }

    return new Promise(resolve => {
        try {
            nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);

            nativePort.onMessage.addListener((message: unknown) => {
                const msg = message as StreamEvent | NativeMessageResponse;

                // Check if this is a streaming event (no request ID)
                if (
                    msg.type === 'streamEvent' ||
                    msg.type === 'streamError' ||
                    msg.type === 'streamEnd'
                ) {
                    chrome.runtime.sendMessage(msg).catch(() => {
                        /* ignore */
                    });
                    return;
                }

                const response = msg as NativeMessageResponse;
                // Handle request-response messages
                if (response.id !== undefined) {
                    const pending = pendingRequests.get(response.id);
                    if (pending) {
                        pending.resolve(response);
                        pendingRequests.delete(response.id);
                    }
                }
            });

            nativePort.onDisconnect.addListener(() => {
                const error = chrome.runtime.lastError?.message || 'Disconnected';
                debugInfo('Native host disconnected:', error);

                nativePort = null;
                proxyHttpPort = null;
                proxySecret = null;
                proxyVersion = null;

                for (const [_id, pending] of pendingRequests) {
                    pending.reject(new Error('Native host disconnected'));
                }
                pendingRequests.clear();
            });

            // Perform init handshake to get HTTP server info
            sendNativeMessage({ type: 'init' })
                .then(initResponse => {
                    if (initResponse.success) {
                        proxyHttpPort = initResponse.httpPort || null;
                        proxySecret = initResponse.secret || null;
                        proxyVersion = initResponse.version || null;
                        debugInfo(`Proxy connected: HTTP server on port ${proxyHttpPort}`);

                        chrome.storage.local.set({ proxyConnected: true });
                        resolve(initResponse);
                    } else {
                        throw new Error(initResponse.error || 'Init failed');
                    }
                })
                .catch(err => {
                    console.error('Native init failed:', err);
                    disconnectNative();
                    resolve({ success: false, error: (err as Error).message });
                });
        } catch (err) {
            console.error('Failed to connect to native host:', err);
            resolve({ success: false, error: (err as Error).message });
        }
    });
}

/**
 * Disconnect from native host
 */
export function disconnectNative(): void {
    if (nativePort) {
        nativePort.disconnect();
        nativePort = null;
    }
    proxyHttpPort = null;
    proxySecret = null;
    proxyVersion = null;
    chrome.storage.local.set({ proxyConnected: false });
}

/**
 * Send message to native host (low-level)
 */
function sendNativeMessage(message: ProxyRequest): Promise<NativeMessageResponse> {
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
            resolve: (response: NativeMessageResponse) => {
                clearTimeout(timeoutId);
                resolve(response);
            },
            reject: (error: Error) => {
                clearTimeout(timeoutId);
                reject(error);
            },
        });

        nativePort.postMessage({ id, ...message });
    });
}

/**
 * Fetch large payload from HTTP server using secret
 */
async function fetchLargePayload(payloadId: string): Promise<string> {
    if (!proxyHttpPort || !proxySecret) {
        throw new Error('Proxy HTTP server not available');
    }

    const response = await fetch(`http://127.0.0.1:${proxyHttpPort}/payload/${payloadId}`, {
        headers: { 'X-Proxy-Secret': proxySecret },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch payload: ${response.status}`);
    }

    return response.text();
}

/**
 * Send proxy request with automatic large payload handling
 */
export async function sendProxyRequest(message: ProxyRequest): Promise<ProxyResponse> {
    const response = await sendNativeMessage(message);

    if (response.largePayload) {
        const payloadData = await fetchLargePayload(response.largePayload);
        const fullResponse = JSON.parse(payloadData) as ProxyResponse;
        return fullResponse;
    }

    return response as ProxyResponse;
}

/**
 * Check if proxy is connected
 */
export function isProxyConnected(): boolean {
    return nativePort !== null && proxyHttpPort !== null;
}

/**
 * Get proxy connection info
 */
export function getProxyInfo(): {
    connected: boolean;
    httpPort: number | null;
    version: string | undefined;
    hasSecret: boolean;
} {
    return {
        connected: isProxyConnected(),
        httpPort: proxyHttpPort,
        version: proxyVersion ?? undefined,
        hasSecret: !!proxySecret,
    };
}
