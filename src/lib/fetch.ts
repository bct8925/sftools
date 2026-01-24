// Fetch routing and proxy connection utilities

import { getActiveConnectionId, triggerAuthExpired } from './auth.js';
import { debugInfo } from './debug.js';

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

interface ProxyStatusResponse {
  connected: boolean;
}

// --- Proxy Connection State ---
let PROXY_CONNECTED = false;

export function isProxyConnected(): boolean {
  return PROXY_CONNECTED;
}

/**
 * Check and update proxy connection status
 */
export async function checkProxyStatus(): Promise<boolean> {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'checkProxyConnection',
      })) as ProxyStatusResponse;
      PROXY_CONNECTED = response.connected;
      return PROXY_CONNECTED;
    } catch (err) {
      console.error('Error checking proxy status:', err);
      PROXY_CONNECTED = false;
      return false;
    }
  }
  return false;
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
 * Smart fetch: uses proxy if available, falls back to extensionFetch
 */
export function smartFetch(url: string, options: FetchOptions = {}): Promise<FetchResponse> {
  if (PROXY_CONNECTED) {
    return proxyFetch(url, options);
  }
  return extensionFetch(url, options);
}
