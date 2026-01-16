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
    // Order matters - more specific patterns first
    const patterns = [
        // Developer Edition orgs (e.g., orgname.develop.my.salesforce.com)
        /^([^.]+)\.develop\.lightning\.force\.com$/,
        /^([^.]+)\.develop\.my\.salesforce\.com$/,
        // Sandbox orgs
        /^([^.]+)\.sandbox\.lightning\.force\.com$/,
        /^([^.]+)\.sandbox\.my\.salesforce\.com$/,
        // Scratch orgs
        /^([^.]+)\.scratch\.lightning\.force\.com$/,
        /^([^.]+)\.scratch\.my\.salesforce\.com$/,
        // Demo orgs
        /^([^.]+)\.demo\.lightning\.force\.com$/,
        /^([^.]+)\.demo\.my\.salesforce\.com$/,
        // Trailhead playgrounds
        /^([^.]+)\.trailblaze\.lightning\.force\.com$/,
        /^([^.]+)\.trailblaze\.my\.salesforce\.com$/,
        // Standard production/enterprise orgs (most common - check last)
        /^([^.]+)\.lightning\.force\.com$/,
        /^([^.]+)\.my\.salesforce\.com$/
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

/**
 * Generic fetch wrapper with 401 retry logic
 * @param {Function} fetchFn - Function that makes the request, receives headers
 * @param {Function} convertFn - Function to convert response to standard format (async)
 * @param {object} headers - Request headers (may include Authorization)
 * @param {string|null} connectionId - Connection ID
 * @returns {Promise<object>} - Response with 401 retry handling
 */
async function fetchWithRetry(fetchFn, convertFn, headers, connectionId) {
    const hasAuth = !!headers?.Authorization;

    try {
        const response = await fetchFn(headers);
        const converted = await convertFn(response);

        return await handle401WithRefresh(
            converted,
            connectionId,
            hasAuth,
            async (newAccessToken) => {
                const retryResponse = await fetchFn({
                    ...headers,
                    Authorization: `Bearer ${newAccessToken}`
                });
                return await convertFn(retryResponse);
            }
        );
    } catch (error) {
        // CORS errors manifest as network failures with status 0
        // Include status: 0 so CORS detection logic can identify these errors
        return { success: false, status: 0, error: error.message };
    }
}

/**
 * Handle 401 response with automatic token refresh
 * Generic wrapper that attempts refresh and retries the request
 * @param {object} response - The response object with status 401
 * @param {string|null} connectionId - Connection ID for the request
 * @param {boolean} hasAuth - Whether the request had Authorization header
 * @param {Function} retryFn - Function to retry the request with new token (receives newAccessToken)
 * @returns {Promise<object>} - Updated response or authExpired response
 */
async function handle401WithRefresh(response, connectionId, hasAuth, retryFn) {
    if (response.status !== 401 || !connectionId || !hasAuth) {
        return response;
    }

    const { connections } = await chrome.storage.local.get(['connections']);
    const connection = connections?.find(c => c.id === connectionId);

    if (connection?.refreshToken && isProxyConnected()) {
        console.log('Got 401, attempting token refresh for connection:', connectionId);
        const refreshResult = await refreshAccessToken(connection);

        if (refreshResult.success) {
            console.log('Token refresh succeeded, retrying request');
            await updateConnectionToken(connectionId, refreshResult.accessToken);
            return await retryFn(refreshResult.accessToken);
        } else {
            console.log('Token refresh failed:', refreshResult.error);
            return {
                success: false,
                status: 401,
                statusText: 'Unauthorized',
                authExpired: true,
                connectionId: connectionId,
                error: refreshResult.error
            };
        }
    } else {
        console.log('Cannot refresh - refreshToken:', !!connection?.refreshToken, 'proxy:', isProxyConnected());
        return {
            success: false,
            status: 401,
            statusText: 'Unauthorized',
            authExpired: true,
            connectionId: connectionId,
            error: 'Session expired'
        };
    }
}

// ============================================================================
// Message Handlers
// ============================================================================

const handlers = {
    fetch: async (request) => {
        return await fetchWithRetry(
            (headers) => fetch(request.url, {
                ...request.options,
                headers
            }),
            async (response) => {
                const headers = {};
                response.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });
                return {
                    success: response.ok,
                    status: response.status,
                    statusText: response.statusText,
                    headers,
                    data: await response.text()
                };
            },
            request.options.headers,
            request.connectionId
        );
    },

    connectProxy: () => connectNative(),

    disconnectProxy: () => { disconnectNative(); return { success: true }; },

    checkProxyConnection: () => ({ connected: isProxyConnected(), ...getProxyInfo() }),

    getProxyInfo: () => getProxyInfo(),

    tokenExchange: (req) => exchangeCodeForTokens(req.code, req.redirectUri, req.loginDomain, req.clientId),

    proxyFetch: proxyRequired(async (req) => {
        return await fetchWithRetry(
            (headers) => sendProxyRequest({
                type: 'rest',
                url: req.url,
                method: req.method,
                headers,
                body: req.body
            }),
            (response) => response,
            req.headers,
            req.connectionId
        );
    }),

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
// Auto-connect to Proxy on Startup (if enabled)
// ============================================================================

chrome.storage.local.get(['proxyEnabled']).then(({ proxyEnabled }) => {
    if (proxyEnabled) {
        connectNative()
            .then(result => { if (result.success) console.log('Auto-connected to proxy'); })
            .catch(() => {});
    }
});
