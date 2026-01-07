// Service Worker for sftools Chrome Extension

import {
    connectNative,
    disconnectNative,
    sendProxyRequest,
    isProxyConnected,
    getProxyInfo
} from './native-messaging.js';

import {
    exchangeCodeForTokens,
    refreshAccessToken,
    updateConnectionToken
} from './auth.js';

// ============================================================================
// Extension Action Handler
// ============================================================================

chrome.action.onClicked.addListener(async (tab) => {
    await chrome.sidePanel.open({ tabId: tab.id });
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
        documentUrlPatterns: [
            '*://*.my.salesforce.com/*',
            '*://*.lightning.force.com/*'
        ]
    });

    // Child menu item
    chrome.contextMenus.create({
        id: RECORD_MENU_ID,
        parentId: SFTOOLS_MENU_ID,
        title: 'View/Edit Record',
        contexts: ['page'],
        documentUrlPatterns: [
            '*://*.my.salesforce.com/*',
            '*://*.lightning.force.com/*'
        ]
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === RECORD_MENU_ID) {
        await handleViewEditRecord(tab);
    }
});

function parseLightningUrl(url) {
    // Match Lightning record page URLs: /lightning/r/{SObjectType}/{RecordId}/view
    const regex = /\/lightning\/r\/([^/]+)\/([a-zA-Z0-9]{15,18})\/view/;
    const match = url.match(regex);
    return match ? { objectType: match[1], recordId: match[2] } : null;
}

function extractOrgIdentifier(hostname) {
    // Extract org-specific part from Salesforce domain formats
    const patterns = [
        /^([^.]+)\.lightning\.force\.com$/,
        /^([^.]+)\.my\.salesforce\.com$/,
        /^([^.]+)\.sandbox\.lightning\.force\.com$/,
        /^([^.]+)\.sandbox\.my\.salesforce\.com$/,
        /^([^.]+)\.scratch\.lightning\.force\.com$/,
        /^([^.]+)\.scratch\.my\.salesforce\.com$/
    ];

    for (const pattern of patterns) {
        const match = hostname.match(pattern);
        if (match) {
            return match[1].toLowerCase();
        }
    }
    return null;
}

async function findConnectionByDomain(tabUrl) {
    const tabHostname = new URL(tabUrl).hostname;
    const { connections } = await chrome.storage.local.get(['connections']);

    if (!connections || connections.length === 0) {
        return null;
    }

    const tabOrgId = extractOrgIdentifier(tabHostname);

    for (const connection of connections) {
        const connHostname = new URL(connection.instanceUrl).hostname;

        // Direct hostname match
        if (tabHostname === connHostname) {
            return connection;
        }

        // Match by org identifier (handles lightning vs my.salesforce domain differences)
        const connOrgId = extractOrgIdentifier(connHostname);
        if (tabOrgId && connOrgId && tabOrgId === connOrgId) {
            return connection;
        }
    }

    return null;
}

async function handleViewEditRecord(tab) {
    const iconUrl = chrome.runtime.getURL('dist/icon.png');

    const parsed = parseLightningUrl(tab.url);
    if (!parsed) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl,
            title: 'sftools',
            message: 'Navigate to a Salesforce record page to use this feature.'
        });
        return;
    }

    const connection = await findConnectionByDomain(tab.url);
    if (!connection) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl,
            title: 'sftools',
            message: 'No saved connection for this Salesforce org. Please authorize first.'
        });
        return;
    }

    const viewerUrl = chrome.runtime.getURL('dist/pages/record/record.html') +
        `?objectType=${encodeURIComponent(parsed.objectType)}` +
        `&recordId=${encodeURIComponent(parsed.recordId)}` +
        `&connectionId=${encodeURIComponent(connection.id)}`;

    chrome.tabs.create({ url: viewerUrl });
}

// ============================================================================
// Helper Functions
// ============================================================================

function proxyRequired(handler) {
    return async (request) => {
        if (!isProxyConnected()) {
            return { success: false, error: 'Proxy not connected' };
        }
        try {
            return await handler(request);
        } catch (error) {
            return { success: false, error: error.message };
        }
    };
}

// ============================================================================
// Message Handlers
// ============================================================================

const handlers = {
    fetch: handleFetch,

    connectProxy: () => connectNative(),
    disconnectProxy: () => { disconnectNative(); return { success: true }; },
    checkProxyConnection: () => ({ connected: isProxyConnected(), ...getProxyInfo() }),
    getProxyInfo: () => getProxyInfo(),

    tokenExchange: (req) => exchangeCodeForTokens(req.code, req.redirectUri, req.loginDomain, req.clientId),

    proxyFetch: proxyRequired((req) =>
        sendProxyRequest({
            type: 'rest',
            url: req.url,
            method: req.method,
            headers: req.headers,
            body: req.body
        })
    ),

    subscribe: proxyRequired(async (req) => {
        const subscriptionId = crypto.randomUUID();
        const response = await sendProxyRequest({
            type: 'subscribe',
            subscriptionId,
            accessToken: req.accessToken,
            instanceUrl: req.instanceUrl,
            channel: req.channel,
            replayPreset: req.replayPreset,
            replayId: req.replayId
        });
        return { ...response, subscriptionId };
    }),

    unsubscribe: proxyRequired((req) =>
        sendProxyRequest({ type: 'unsubscribe', subscriptionId: req.subscriptionId })
    ),

    getTopic: proxyRequired((req) =>
        sendProxyRequest({
            type: 'getTopic',
            accessToken: req.accessToken,
            instanceUrl: req.instanceUrl,
            topicName: req.topicName,
            tenantId: req.tenantId
        })
    ),

    getSchema: proxyRequired((req) =>
        sendProxyRequest({
            type: 'getSchema',
            accessToken: req.accessToken,
            instanceUrl: req.instanceUrl,
            schemaId: req.schemaId,
            tenantId: req.tenantId
        })
    )
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const handler = handlers[request.type];
    if (!handler) return false;

    Promise.resolve(handler(request))
        .then(sendResponse)
        .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
});

// ============================================================================
// Fetch Handler (with 401 retry logic)
// ============================================================================

async function handleFetch(request) {
    try {
        let response = await fetch(request.url, request.options);

        if (response.status === 401 && request.options?.headers?.Authorization && request.connectionId) {
            // Find the connection in storage
            const { connections } = await chrome.storage.local.get(['connections']);
            const connection = connections?.find(c => c.id === request.connectionId);

            if (connection?.refreshToken && isProxyConnected()) {
                console.log('Got 401, attempting token refresh for connection:', request.connectionId);
                const refreshResult = await refreshAccessToken(connection);

                if (refreshResult.success) {
                    // Update the connection's token in storage
                    await updateConnectionToken(request.connectionId, refreshResult.accessToken);

                    // Retry with new token
                    response = await fetch(request.url, {
                        ...request.options,
                        headers: {
                            ...request.options.headers,
                            Authorization: `Bearer ${refreshResult.accessToken}`
                        }
                    });
                } else {
                    return {
                        success: false,
                        status: 401,
                        statusText: 'Unauthorized',
                        authExpired: true,
                        connectionId: request.connectionId,
                        error: refreshResult.error
                    };
                }
            } else {
                return {
                    success: false,
                    status: 401,
                    statusText: 'Unauthorized',
                    authExpired: true,
                    connectionId: request.connectionId,
                    error: 'Session expired'
                };
            }
        }

        const headers = {};
        response.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });

        return {
            success: response.ok,
            status: response.status,
            statusText: response.statusText,
            headers,
            data: await response.text()
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============================================================================
// Auto-connect to Proxy on Startup (if enabled)
// ============================================================================

chrome.storage.local.get(['proxyEnabled']).then(({ proxyEnabled }) => {
    if (proxyEnabled) {
        connectNative()
            .then(result => { if (result.success) console.log('Auto-connected to proxy'); })
            .catch(() => {});
    }
});
