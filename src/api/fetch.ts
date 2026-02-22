// Fetch routing and proxy connection utilities

import { getActiveConnectionId, triggerAuthExpired } from '../auth/auth';
import { debugInfo } from '../lib/debug';

// Test extension ID used by headless test mode
const TEST_EXTENSION_ID = 'test-extension-id';

// --- Types ---

export interface FetchOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
}

export interface FetchResponse {
    success: boolean;
    status: number;
    statusText?: string;
    data?: string;
    error?: string;
    authExpired?: boolean;
    connectionId?: string;
}

// --- Proxy Connection State ---
let PROXY_CONNECTED = false;

export function setProxyConnected(connected: boolean): void {
    PROXY_CONNECTED = connected;
}

/**
 * Helper to handle auth expiration from background responses
 */
function handleAuthExpired(response: FetchResponse, connectionId: string | null): FetchResponse {
    if (response.authExpired) {
        triggerAuthExpired(response.connectionId || connectionId || undefined);
    }
    return response;
}

/**
 * Background fetch proxy (uses Chrome extension fetch to bypass CORS)
 */
export async function extensionFetch(
    url: string,
    options: FetchOptions = {},
    connectionId: string | null = null
): Promise<FetchResponse> {
    const connId = connectionId || getActiveConnectionId();
    const response = (await chrome.runtime.sendMessage({
        type: 'fetch',
        url,
        options,
        connectionId: connId,
    })) as FetchResponse;
    return handleAuthExpired(response, connId);
}

/**
 * Fetch via native proxy (bypasses all CORS restrictions)
 */
export async function proxyFetch(url: string, options: FetchOptions = {}): Promise<FetchResponse> {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        const connId = getActiveConnectionId();
        debugInfo('[proxyFetch]', options.method || 'GET', url);

        const response = (await chrome.runtime.sendMessage({
            type: 'proxyFetch',
            url,
            method: options.method,
            headers: options.headers,
            body: options.body,
            connectionId: connId,
        })) as FetchResponse;

        return handleAuthExpired(response, connId);
    }
    throw new Error('Proxy fetch requires extension context');
}

/**
 * Detect if we're running in a real Chrome extension context.
 * Returns false in headless test mode where chrome.runtime.id is mocked.
 */
function isExtensionContext(): boolean {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
        return false;
    }
    // The mock sets id to TEST_EXTENSION_ID
    return chrome.runtime.id !== TEST_EXTENSION_ID;
}

/**
 * Perform a direct fetch (used in headless test mode).
 * MockRouter intercepts these at the network level.
 */
async function directFetch(url: string, options: FetchOptions = {}): Promise<FetchResponse> {
    try {
        const response = await fetch(url, {
            method: options.method || 'GET',
            headers: options.headers,
            body: options.body,
        });
        const data = await response.text();
        return {
            success: response.ok,
            status: response.status,
            statusText: response.statusText,
            data,
        };
    } catch (error) {
        return {
            success: false,
            status: 0,
            error: error instanceof Error ? error.message : 'Network error',
        };
    }
}

/**
 * Smart fetch: uses proxy if available, falls back to extensionFetch
 */
export function smartFetch(url: string, options: FetchOptions = {}): Promise<FetchResponse> {
    // In headless test mode, use direct fetch
    if (!isExtensionContext()) {
        return directFetch(url, options);
    }

    if (PROXY_CONNECTED) {
        return proxyFetch(url, options);
    }
    return extensionFetch(url, options);
}
