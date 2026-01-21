/**
 * Content Script Token Refresh Module
 *
 * Provides fallback token refresh via content scripts when proxy is unavailable.
 * Content scripts run in Salesforce page context, bypassing CORS restrictions.
 */

import { getOAuthCredentials } from '../lib/oauth-credentials.js';
import { debugInfo } from './debug.js';
import { extractOrgIdentifier } from '../lib/background-utils.js';

/**
 * Find an active Salesforce tab with content script loaded
 * @param {string} [targetInstanceUrl] - Optional: prefer tabs matching this instance URL
 * @returns {Promise<{tabId: number, url: string} | null>}
 */
async function findSalesforceTab(targetInstanceUrl = null) {
    const tabs = await chrome.tabs.query({});
    debugInfo('[ContentScriptRefresh] Searching', tabs.length, 'tabs', targetInstanceUrl ? `for ${targetInstanceUrl}` : '');

    // Extract target org identifier if provided
    let targetOrgId = null;
    if (targetInstanceUrl) {
        try {
            const targetHostname = new URL(targetInstanceUrl).hostname;
            targetOrgId = extractOrgIdentifier(targetHostname);
            debugInfo('[ContentScriptRefresh] Target org ID:', targetOrgId);
        } catch (err) {
            debugInfo('[ContentScriptRefresh] Failed to extract org ID from target URL:', err.message);
        }
    }

    const salesforceDomains = [
        '.salesforce.com',
        '.salesforce-setup.com',
        '.force.com',
        '.lightning.force.com',
        '.my.salesforce.com',
        '.visualforce.com',
        '.salesforce-sites.com'
    ];

    const matchingTabs = [];
    const otherSfTabs = [];

    for (const tab of tabs) {
        if (!tab.url || !tab.id) continue;

        try {
            const url = new URL(tab.url);
            const isSalesforce = salesforceDomains.some(d =>
                url.hostname.endsWith(d) || url.hostname === d.slice(1)
            );

            if (!isSalesforce) continue;

            debugInfo('[ContentScriptRefresh] Found SF tab:', tab.id, url.hostname, '- testing ping...');
            // Verify content script is ready via ping test
            const response = await chrome.tabs.sendMessage(tab.id, { type: 'ping' });
            debugInfo('[ContentScriptRefresh] Ping response:', response);

            if (!response?.success) continue;

            // Check if this tab matches target org
            if (targetOrgId) {
                const tabOrgId = extractOrgIdentifier(url.hostname);
                debugInfo('[ContentScriptRefresh] Tab hostname:', url.hostname, '-> org ID:', tabOrgId, 'vs target:', targetOrgId);

                // Try org ID matching first
                if (tabOrgId && tabOrgId === targetOrgId) {
                    matchingTabs.push({ tabId: tab.id, url: tab.url });
                }
                // Fallback: direct hostname comparison (for URLs that don't match known patterns)
                else if (url.hostname === new URL(targetInstanceUrl).hostname) {
                    debugInfo('[ContentScriptRefresh] Matched by exact hostname');
                    matchingTabs.push({ tabId: tab.id, url: tab.url });
                }
                else {
                    otherSfTabs.push({ tabId: tab.id, url: tab.url });
                }
            } else {
                otherSfTabs.push({ tabId: tab.id, url: tab.url });
            }
        } catch (err) {
            // Tab closed or content script not ready, continue to next tab
            debugInfo('[ContentScriptRefresh] Ping failed for tab', tab.id, ':', err.message);
            continue;
        }
    }

    // Prefer matching tabs, fall back to any SF tab for token refresh
    if (matchingTabs.length > 0) {
        debugInfo('[ContentScriptRefresh] Found matching tab:', matchingTabs[0]);
        return matchingTabs[0];
    }

    // For contentFetch, we should NOT fall back to non-matching tabs
    // because the request needs to go to the correct org
    if (targetInstanceUrl) {
        debugInfo('[ContentScriptRefresh] No matching tab for:', targetInstanceUrl);
        return null;
    }

    // For token refresh (no target), any SF tab works
    if (otherSfTabs.length > 0) {
        debugInfo('[ContentScriptRefresh] Using any SF tab for token refresh:', otherSfTabs[0]);
        return otherSfTabs[0];
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

/**
 * Make a fetch request via content script in a Salesforce tab
 * @param {string} url - Full URL to fetch (must be Salesforce API)
 * @param {object} options - Fetch options (method, headers, body)
 * @param {string} instanceUrl - Connection instance URL to find matching tab
 * @returns {Promise<object>} - Response in same format as extensionFetch
 */
export async function fetchViaContentScript(url, options, instanceUrl) {
    const tab = await findSalesforceTab(instanceUrl);
    if (!tab) {
        return {
            success: false,
            error: 'No matching Salesforce tab available',
            noTab: true  // Flag for fallback logic
        };
    }

    try {
        debugInfo('[ContentScriptFetch] Sending request via tab:', tab.tabId, url);

        const response = await chrome.tabs.sendMessage(tab.tabId, {
            type: 'contentFetch',
            url,
            method: options.method,
            headers: options.headers,
            body: options.body
        });

        return response;
    } catch (err) {
        debugInfo('[ContentScriptFetch] Error:', err.message);
        return { success: false, error: err.message, noTab: true };
    }
}
