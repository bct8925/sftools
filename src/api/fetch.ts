// Fetch routing and proxy connection utilities

import { getActiveConnectionId, triggerAuthExpired } from '../auth/auth';
import { debugInfo } from '../lib/debug';
import { getPlatform } from '../platform';

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
    headers?: Record<string, string>;
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
 * Host fetch (Chrome background service worker, or the VS Code extension host).
 * Requests made by the host are not subject to page CORS rules.
 */
export async function extensionFetch(
    url: string,
    options: FetchOptions = {},
    connectionId: string | null = null
): Promise<FetchResponse> {
    const connId = connectionId || getActiveConnectionId();
    const response = await getPlatform().sendMessage<FetchResponse>({
        type: 'fetch',
        url,
        options,
        connectionId: connId,
    });
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
 * Detect if we're running in a real extension context (Chrome or VS Code).
 * Returns false in headless test mode where chrome.runtime.id is mocked.
 */
function isExtensionContext(): boolean {
    if (getPlatform().kind === 'vscode') return true;
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
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
            headers[key.toLowerCase()] = value;
        });
        return {
            success: response.ok,
            status: response.status,
            statusText: response.statusText,
            data,
            headers,
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
 * Detect proxy connectivity errors (not Salesforce API errors).
 * These indicate the proxy itself is unavailable, not that the API request failed.
 */
function isProxyConnectionError(response: FetchResponse): boolean {
    // No HTTP status or status 0 with an error message indicates transport failure
    if (response.status === 0 && response.error) return true;

    // Known proxy disconnect error messages
    const proxyErrors = ['Proxy not connected', 'Native host disconnected', 'Request timeout'];
    if (response.error && proxyErrors.some(msg => response.error!.includes(msg))) return true;

    return false;
}

/**
 * Smart fetch: uses proxy if available, falls back to extensionFetch.
 * If the proxy returns a connectivity error, disables proxy and retries via extension.
 * In VS Code there is no proxy: the extension host makes every request directly.
 */
export async function smartFetch(url: string, options: FetchOptions = {}): Promise<FetchResponse> {
    // In headless test mode, use direct fetch
    if (!isExtensionContext()) {
        return directFetch(url, options);
    }

    if (getPlatform().kind === 'vscode') {
        return extensionFetch(url, options);
    }

    if (PROXY_CONNECTED) {
        try {
            const response = await proxyFetch(url, options);
            if (isProxyConnectionError(response)) {
                debugInfo('[smartFetch] Proxy connection error, falling back to extension fetch');
                PROXY_CONNECTED = false;
                return extensionFetch(url, options);
            }
            return response;
        } catch {
            debugInfo('[smartFetch] Proxy fetch threw, falling back to extension fetch');
            PROXY_CONNECTED = false;
            return extensionFetch(url, options);
        }
    }
    return extensionFetch(url, options);
}
