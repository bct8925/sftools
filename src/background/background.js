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
    refreshAccessToken
} from './auth.js';

// ============================================================================
// Extension Action Handler
// ============================================================================

chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: 'dist/app.html' });
});

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

    tokenExchange: (req) => exchangeCodeForTokens(req.code, req.redirectUri),

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

        if (response.status === 401 && request.options?.headers?.Authorization) {
            const { refreshToken } = await chrome.storage.local.get(['refreshToken']);

            if (refreshToken && isProxyConnected()) {
                console.log('Got 401, attempting token refresh...');
                const refreshResult = await refreshAccessToken();

                if (refreshResult.success) {
                    response = await fetch(request.url, {
                        ...request.options,
                        headers: {
                            ...request.options.headers,
                            Authorization: `Bearer ${refreshResult.accessToken}`
                        }
                    });
                } else {
                    return { success: false, status: 401, statusText: 'Unauthorized', authExpired: true, error: refreshResult.error };
                }
            } else {
                return { success: false, status: 401, statusText: 'Unauthorized', authExpired: true, error: 'Session expired' };
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
// Auto-connect to Proxy on Startup
// ============================================================================

connectNative()
    .then(result => { if (result.success) console.log('Auto-connected to proxy'); })
    .catch(() => {});
