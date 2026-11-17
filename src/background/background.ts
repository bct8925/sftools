// Service Worker for sftools Chrome Extension

import {
    parseLightningUrl,
    findConnectionByDomain as findConnectionByDomainUtil,
} from '../lib/background-utils';
import type { SalesforceConnection } from '../types/salesforce';
import {
    connectNative,
    disconnectNative,
    sendProxyRequest,
    isProxyConnected,
    getProxyInfo,
} from './native-messaging';
import {
    canReachTokenEndpoint,
    exchangeCodeForTokens,
    isReplacedAccessToken,
    refreshAccessToken,
} from './auth';
import { DPOP_SCHEME, getTokenScheme, handleDpopNonce, withDpopProof } from './dpop';
import { debugInfo } from './debug';

// ============================================================================
// Message Types
// ============================================================================

interface FetchRequest {
    type: 'fetch';
    url: string;
    options: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
    };
    connectionId?: string;
}

interface ConnectProxyRequest {
    type: 'connectProxy';
}

interface DisconnectProxyRequest {
    type: 'disconnectProxy';
}

interface CheckProxyConnectionRequest {
    type: 'checkProxyConnection';
}

interface GetProxyInfoRequest {
    type: 'getProxyInfo';
}

interface TokenExchangeRequest {
    type: 'tokenExchange';
    code: string;
    redirectUri: string;
    loginDomain: string;
    clientId: string;
    codeVerifier?: string;
}

interface ProxyFetchRequest {
    type: 'proxyFetch';
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
    connectionId?: string;
}

interface SubscribeRequest {
    type: 'subscribe';
    accessToken: string;
    instanceUrl: string;
    channel: string;
    replayPreset?: string;
    replayId?: string | number;
}

interface UnsubscribeRequest {
    type: 'unsubscribe';
    subscriptionId: string;
}

interface GetTopicRequest {
    type: 'getTopic';
    accessToken: string;
    instanceUrl: string;
    topicName: string;
    tenantId: string;
}

interface GetSchemaRequest {
    type: 'getSchema';
    accessToken: string;
    instanceUrl: string;
    schemaId: string;
    tenantId: string;
}

type BackgroundRequest =
    | FetchRequest
    | ConnectProxyRequest
    | DisconnectProxyRequest
    | CheckProxyConnectionRequest
    | GetProxyInfoRequest
    | TokenExchangeRequest
    | ProxyFetchRequest
    | SubscribeRequest
    | UnsubscribeRequest
    | GetTopicRequest
    | GetSchemaRequest;

interface FetchResponse {
    success: boolean;
    status: number;
    statusText?: string;
    headers?: Record<string, string>;
    data?: string;
    error?: string;
    authExpired?: boolean;
    connectionId?: string;
    [key: string]: unknown;
}

interface ProxyResponse {
    success: boolean;
    version?: string;
    error?: string;
    connected?: boolean;
    httpPort?: number | null;
    hasSecret?: boolean;
    status?: number;
    statusText?: string;
    data?: string;
    authExpired?: boolean;
    accessToken?: string;
    refreshToken?: string;
    instanceUrl?: string;
    loginDomain?: string;
    subscriptionId?: string;
    [key: string]: unknown;
}

// ============================================================================
// Extension Action Handler
// ============================================================================

chrome.action.onClicked.addListener(async (tab: chrome.tabs.Tab) => {
    if (tab.id !== undefined) {
        await chrome.sidePanel.open({ tabId: tab.id });
    }
});

// ============================================================================
// Context Menu Setup
// ============================================================================

const SFTOOLS_MENU_ID = 'sftools-parent';
const RECORD_MENU_ID = 'view-edit-record';

chrome.runtime.onInstalled.addListener(() => {
    // Parent menu - appears on Salesforce pages
    chrome.contextMenus.create({
        id: SFTOOLS_MENU_ID,
        title: 'sftools',
        contexts: ['page'],
        documentUrlPatterns: ['*://*.my.salesforce.com/*', '*://*.lightning.force.com/*'],
    });

    // Child menu item
    chrome.contextMenus.create({
        id: RECORD_MENU_ID,
        parentId: SFTOOLS_MENU_ID,
        title: 'View/Edit Record',
        contexts: ['page'],
        documentUrlPatterns: ['*://*.my.salesforce.com/*', '*://*.lightning.force.com/*'],
    });
});

chrome.contextMenus.onClicked.addListener(
    async (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
        if (info.menuItemId === RECORD_MENU_ID && tab) {
            await handleViewEditRecord(tab);
        }
    }
);

async function findConnectionByDomain(tabUrl: string): Promise<SalesforceConnection | null> {
    const { connections } = await chrome.storage.local.get(['connections']);
    return findConnectionByDomainUtil(connections as SalesforceConnection[], tabUrl);
}

async function handleViewEditRecord(tab: chrome.tabs.Tab): Promise<void> {
    const iconUrl = chrome.runtime.getURL('dist/icon.png');

    if (!tab.url) {
        return;
    }

    const parsed = parseLightningUrl(tab.url);
    if (!parsed) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl,
            title: 'sftools',
            message: 'Navigate to a Salesforce record page to use this feature.',
        });
        return;
    }

    const connection = await findConnectionByDomain(tab.url);
    if (!connection) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl,
            title: 'sftools',
            message: 'No saved connection for this Salesforce org. Please authorize first.',
        });
        return;
    }

    const viewerUrl =
        `${chrome.runtime.getURL(
            'dist/pages/record/record.html'
        )}?objectType=${encodeURIComponent(parsed.objectType)}` +
        `&recordId=${encodeURIComponent(parsed.recordId)}` +
        `&connectionId=${encodeURIComponent(connection.id)}`;

    chrome.tabs.create({ url: viewerUrl });
}

// ============================================================================
// Helper Functions
// ============================================================================

function proxyRequired<T extends BackgroundRequest>(
    handler: (request: T) => Promise<ProxyResponse>
) {
    return async (request: T): Promise<ProxyResponse> => {
        if (!isProxyConnected()) {
            return { success: false, error: 'Proxy not connected' };
        }
        try {
            return await handler(request);
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    };
}

/**
 * Probe the org's unauthenticated REST versions endpoint.
 * Salesforce sends 401 responses without CORS headers, so in extension fetch an
 * expired session fails exactly like a missing CORS entry ("Failed to fetch").
 * If this unauthenticated request gets any response, the origin is allowed and
 * the earlier failure came from the session, not from CORS.
 */
async function isOriginAllowed(url: string): Promise<boolean> {
    try {
        await fetch(`${new URL(url).origin}/services/data/`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
        });
        return true;
    } catch {
        return false;
    }
}

function responseMeta(response: Response | ProxyResponse): {
    status: number;
    headers: Record<string, string> | undefined;
} {
    if (response instanceof Response) {
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
            headers[key.toLowerCase()] = value;
        });
        return { status: response.status, headers };
    }
    const proxyResponse = response as { status?: number; headers?: Record<string, string> };
    return { status: proxyResponse.status ?? 0, headers: proxyResponse.headers };
}

/**
 * Wrap a request function so requests with a DPoP-bound token (Authorization: DPoP)
 * carry a fresh proof, and are retried once when the server asks for a DPoP nonce.
 */
function withDpop(
    send: (headers: Record<string, string>) => Promise<Response | ProxyResponse>,
    method: string,
    url: string
): (headers: Record<string, string>) => Promise<Response | ProxyResponse> {
    return async headers => {
        const response = await send(await withDpopProof(headers, method, url));
        if (getTokenScheme(headers) !== DPOP_SCHEME) return response;
        const { status, headers: responseHeaders } = responseMeta(response);
        if (!handleDpopNonce(url, status, responseHeaders)) return response;
        debugInfo('Server asked for a DPoP nonce, retrying');
        return send(await withDpopProof(headers, method, url));
    };
}

/**
 * Generic fetch wrapper with 401 retry logic
 * @param probeUrl - when set, a network failure on an authenticated request probes this
 *   URL's origin to tell an expired session apart from a CORS error
 */
async function fetchWithRetry(
    fetchFn: (headers: Record<string, string>) => Promise<Response | ProxyResponse>,
    convertFn: (response: Response | ProxyResponse) => Promise<FetchResponse>,
    headers: Record<string, string> | undefined,
    connectionId: string | undefined,
    probeUrl?: string
): Promise<FetchResponse> {
    const hasAuth = !!headers?.Authorization;
    const usedToken = headers?.Authorization?.split(' ')[1];
    const retryWithToken = async (
        newAccessToken: string,
        tokenType: string
    ): Promise<FetchResponse> => {
        const retryResponse = await fetchFn({
            ...headers,
            Authorization: `${tokenType} ${newAccessToken}`,
        });
        return convertFn(retryResponse);
    };

    try {
        const response = await fetchFn(headers || {});
        const converted = await convertFn(response);
        return await handle401WithRefresh(
            converted,
            connectionId,
            hasAuth,
            retryWithToken,
            usedToken
        );
    } catch (error) {
        // CORS errors manifest as network failures with status 0
        // Include status: 0 so CORS detection logic can identify these errors
        const networkError: FetchResponse = {
            success: false,
            status: 0,
            error: (error as Error).message,
        };
        if (!hasAuth || !probeUrl || !(await isOriginAllowed(probeUrl))) {
            return networkError;
        }
        debugInfo('Authenticated request failed but origin is allowed; treating as 401');
        try {
            return await handle401WithRefresh(
                { success: false, status: 401, statusText: 'Unauthorized' },
                connectionId,
                hasAuth,
                retryWithToken,
                usedToken
            );
        } catch {
            return networkError;
        }
    }
}

/**
 * Handle 401 response with automatic token refresh
 * Generic wrapper that attempts refresh and retries the request
 */
async function handle401WithRefresh(
    response: FetchResponse,
    connectionId: string | undefined,
    hasAuth: boolean,
    retryFn: (newAccessToken: string, tokenType: string) => Promise<FetchResponse>,
    usedToken?: string
): Promise<FetchResponse> {
    if (response.status !== 401 || !connectionId || !hasAuth) {
        return response;
    }

    const { connections } = await chrome.storage.local.get(['connections']);
    const connection = (connections as SalesforceConnection[] | undefined)?.find(
        c => c.id === connectionId
    );

    // Another request already refreshed this connection: retry with the stored token.
    // Refreshing again would reuse a rotated refresh token.
    if (
        connection &&
        usedToken &&
        connection.accessToken !== usedToken &&
        isReplacedAccessToken(connectionId, usedToken)
    ) {
        debugInfo('Got 401 with an old token, retrying with the stored token');
        return retryFn(connection.accessToken, connection.tokenType ?? 'Bearer');
    }

    const canRefresh =
        !!connection?.refreshToken &&
        (await canReachTokenEndpoint(connection.loginDomain || 'https://login.salesforce.com'));

    if (connection && canRefresh) {
        debugInfo('Got 401, attempting token refresh for connection:', connectionId);
        const refreshResult = await refreshAccessToken(connection);

        if (refreshResult.success) {
            debugInfo('Token refresh succeeded, retrying request');
            return retryFn(refreshResult.accessToken, refreshResult.tokenType);
        }
        debugInfo('Token refresh failed:', refreshResult.error);
        return {
            success: false,
            status: 401,
            statusText: 'Unauthorized',
            authExpired: true,
            connectionId: connectionId,
            error: refreshResult.error,
        };
    }
    debugInfo(
        'Cannot refresh - refreshToken:',
        !!connection?.refreshToken,
        'token endpoint reachable:',
        canRefresh
    );
    return {
        success: false,
        status: 401,
        statusText: 'Unauthorized',
        authExpired: true,
        connectionId: connectionId,
        error: 'Session expired',
    };
}

// ============================================================================
// Message Handlers
// ============================================================================

const handlers: Record<string, (request: BackgroundRequest) => Promise<ProxyResponse>> = {
    fetch: (request: BackgroundRequest) => {
        const req = request as FetchRequest;
        return fetchWithRetry(
            withDpop(
                headers =>
                    fetch(req.url, {
                        ...req.options,
                        headers,
                    }),
                req.options.method || 'GET',
                req.url
            ),
            async (response: Response | ProxyResponse) => {
                if (response instanceof Response) {
                    const headers: Record<string, string> = {};
                    response.headers.forEach((value, key) => {
                        headers[key.toLowerCase()] = value;
                    });
                    return {
                        success: response.ok,
                        status: response.status,
                        statusText: response.statusText,
                        headers,
                        data: await response.text(),
                    };
                }
                return response as unknown as FetchResponse;
            },
            req.options.headers,
            req.connectionId,
            req.url
        );
    },

    connectProxy: () => connectNative(),

    disconnectProxy: () => {
        disconnectNative();
        return Promise.resolve({ success: true });
    },

    checkProxyConnection: () => {
        const info = getProxyInfo();
        return Promise.resolve({ success: true, ...info });
    },

    getProxyInfo: () => {
        const info = getProxyInfo();
        return Promise.resolve({ success: true, ...info });
    },

    tokenExchange: (request: BackgroundRequest) => {
        const req = request as TokenExchangeRequest;
        return exchangeCodeForTokens(
            req.code,
            req.redirectUri,
            req.loginDomain,
            req.clientId,
            req.codeVerifier
        );
    },

    proxyFetch: proxyRequired((request: BackgroundRequest) => {
        const req = request as ProxyFetchRequest;
        return fetchWithRetry(
            withDpop(
                headers =>
                    sendProxyRequest({
                        type: 'rest',
                        url: req.url,
                        method: req.method,
                        headers,
                        body: req.body,
                    }),
                req.method || 'GET',
                req.url
            ),
            response => Promise.resolve(response as unknown as FetchResponse),
            req.headers,
            req.connectionId
        );
    }),

    subscribe: proxyRequired(async (request: BackgroundRequest) => {
        const req = request as SubscribeRequest;
        const subscriptionId = crypto.randomUUID();
        const response = await sendProxyRequest({
            type: 'subscribe',
            subscriptionId,
            accessToken: req.accessToken,
            instanceUrl: req.instanceUrl,
            channel: req.channel,
            replayPreset: req.replayPreset,
            replayId: req.replayId,
        });
        return { ...response, subscriptionId };
    }),

    unsubscribe: proxyRequired((request: BackgroundRequest) => {
        const req = request as UnsubscribeRequest;
        return sendProxyRequest({ type: 'unsubscribe', subscriptionId: req.subscriptionId });
    }),

    getTopic: proxyRequired((request: BackgroundRequest) => {
        const req = request as GetTopicRequest;
        return sendProxyRequest({
            type: 'getTopic',
            accessToken: req.accessToken,
            instanceUrl: req.instanceUrl,
            topicName: req.topicName,
            tenantId: req.tenantId,
        });
    }),

    getSchema: proxyRequired((request: BackgroundRequest) => {
        const req = request as GetSchemaRequest;
        return sendProxyRequest({
            type: 'getSchema',
            accessToken: req.accessToken,
            instanceUrl: req.instanceUrl,
            schemaId: req.schemaId,
            tenantId: req.tenantId,
        });
    }),
};

chrome.runtime.onMessage.addListener(
    (
        request: BackgroundRequest,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: ProxyResponse) => void
    ) => {
        const handler = handlers[request.type];
        if (!handler) return false;

        Promise.resolve(handler(request))
            .then(sendResponse)
            .catch(error => sendResponse({ success: false, error: (error as Error).message }));
        return true;
    }
);

// ============================================================================
// Auto-connect to Proxy on Startup (if enabled)
// ============================================================================

chrome.storage.local.get(['proxyEnabled']).then(({ proxyEnabled }) => {
    if (proxyEnabled) {
        connectNative()
            .then(result => {
                if (result.success) debugInfo('Auto-connected to proxy');
            })
            .catch(() => {
                /* ignore */
            });
    }
});
