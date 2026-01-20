/**
 * Content Script Token Refresh Module
 *
 * Provides fallback token refresh via content scripts when proxy is unavailable.
 * Content scripts run in Salesforce page context, bypassing CORS restrictions.
 */

import { getOAuthCredentials } from '../lib/oauth-credentials.js';
import { debugInfo } from './debug.js';

/**
 * Find an active Salesforce tab with content script loaded
 * @returns {Promise<{tabId: number, url: string} | null>}
 */
async function findSalesforceTab() {
    const tabs = await chrome.tabs.query({});
    debugInfo('[ContentScriptRefresh] Searching', tabs.length, 'tabs');

    const salesforceDomains = [
        '.salesforce.com',
        '.salesforce-setup.com',
        '.force.com',
        '.lightning.force.com',
        '.my.salesforce.com',
        '.visualforce.com',
        '.salesforce-sites.com'
    ];

    for (const tab of tabs) {
        if (!tab.url || !tab.id) continue;

        try {
            const url = new URL(tab.url);
            const isSalesforce = salesforceDomains.some(d =>
                url.hostname.endsWith(d) || url.hostname === d.slice(1)
            );

            if (isSalesforce) {
                debugInfo('[ContentScriptRefresh] Found SF tab:', tab.id, url.hostname, '- testing ping...');
                // Verify content script is ready via ping test
                const response = await chrome.tabs.sendMessage(tab.id, { type: 'ping' });
                debugInfo('[ContentScriptRefresh] Ping response:', response);
                if (response?.success) {
                    debugInfo('[ContentScriptRefresh] Found active Salesforce tab:', tab.id, url.hostname);
                    return { tabId: tab.id, url: tab.url };
                }
            }
        } catch (err) {
            // Tab closed or content script not ready, continue to next tab
            debugInfo('[ContentScriptRefresh] Ping failed for tab', tab.id, ':', err.message);
            continue;
        }
    }

    debugInfo('[ContentScriptRefresh] No Salesforce tabs with content script found');
    return null;
}

/**
 * Refresh access token via content script in Salesforce tab
 * @param {object} connection - Connection object with refreshToken and loginDomain
 * @returns {Promise<{success: boolean, accessToken?: string, error?: string}>}
 */
export async function refreshViaContentScript(connection) {
    if (!connection?.refreshToken) {
        return { success: false, error: 'No refresh token' };
    }

    const tab = await findSalesforceTab();
    if (!tab) {
        return { success: false, error: 'No Salesforce tab available' };
    }

    const loginDomain = connection.instanceUrl || 'https://login.salesforce.com';
    const { clientId } = await getOAuthCredentials(connection.id);

    try {
        debugInfo('[ContentScriptRefresh] Sending refresh request to tab:', tab.tabId);

        const response = await chrome.tabs.sendMessage(tab.tabId, {
            type: 'refreshToken',
            loginDomain,
            clientId,
            refreshToken: connection.refreshToken
        });

        if (response?.success) {
            debugInfo('[ContentScriptRefresh] Token refresh successful');
            return { success: true, accessToken: response.accessToken };
        } else {
            debugInfo('[ContentScriptRefresh] Token refresh failed:', response?.error);
            return { success: false, error: response?.error || 'Content script refresh failed' };
        }
    } catch (err) {
        debugInfo('[ContentScriptRefresh] Error communicating with content script:', err.message);
        return { success: false, error: err.message };
    }
}
