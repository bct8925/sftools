// Service Worker for sftools Chrome Extension

import {
    parseLightningUrl,
    findConnectionByDomain as findConnectionByDomainUtil,
} from '../lib/background-utils.js';
import type { SalesforceConnection } from '../types/salesforce';
import {
    connectNative,
    disconnectNative,
    sendProxyRequest,
    isProxyConnected,
    getProxyInfo,
} from './native-messaging.js';
import { exchangeCodeForTokens, refreshAccessToken, updateConnectionToken } from './auth.js';
import { debugInfo } from './debug.js';

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
 * Generic fetch wrapper with 401 retry logic
 */
async function fetchWithRetry(
    fetchFn: (headers: Record<string, string>) => Promise<Response | ProxyResponse>,
    convertFn: (response: Response | ProxyResponse) => Promise<FetchResponse>,
    headers: Record<string, string> | undefined,
    connectionId: string | undefined
): Promise<FetchResponse> {
    const hasAuth = !!headers?.Authorization;

    try {
        const response = await fetchFn(headers || {});
        const converted = await convertFn(response);

        return await handle401WithRefresh(
            converted,
            connectionId,
            hasAuth,
            async (newAccessToken: string) => {
                const retryResponse = await fetchFn({
                    ...headers,
                    Authorization: `Bearer ${newAccessToken}`,
                });
                return convertFn(retryResponse);
            }
        );
    } catch (error) {
        // CORS errors manifest as network failures with status 0
        // Include status: 0 so CORS detection logic can identify these errors
        return { success: false, status: 0, error: (error as Error).message };
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
    retryFn: (newAccessToken: string) => Promise<FetchResponse>
): Promise<FetchResponse> {
    if (response.status !== 401 || !connectionId || !hasAuth) {
        return response;
    }

    const { connections } = await chrome.storage.local.get(['connections']);
    const connection = (connections as SalesforceConnection[] | undefined)?.find(
        c => c.id === connectionId
    );

    if (connection?.refreshToken && isProxyConnected()) {
        debugInfo('Got 401, attempting token refresh for connection:', connectionId);
        const refreshResult = await refreshAccessToken(connection);

        if (refreshResult.success) {
            debugInfo('Token refresh succeeded, retrying request');
            await updateConnectionToken(connectionId, refreshResult.accessToken);
            return retryFn(refreshResult.accessToken);
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
        'proxy:',
        isProxyConnected()
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
            headers =>
                fetch(req.url, {
                    ...req.options,
                    headers,
                }),
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
            req.connectionId
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
        return exchangeCodeForTokens(req.code, req.redirectUri, req.loginDomain, req.clientId);
    },

    proxyFetch: proxyRequired((request: BackgroundRequest) => {
        const req = request as ProxyFetchRequest;
        return fetchWithRetry(
            headers =>
                sendProxyRequest({
                    type: 'rest',
                    url: req.url,
                    method: req.method,
                    headers,
                    body: req.body,
                }),
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
