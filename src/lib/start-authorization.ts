/**
 * OAuth Authorization Flow
 * Shared utility for starting the Salesforce OAuth authorization flow
 */

import { setPendingAuth, generateOAuthState, getOAuthCredentials, CALLBACK_URL } from './auth.js';
import { detectLoginDomain, buildOAuthUrl } from './app-utils.js';

/**
 * Start OAuth authorization flow
 * @param overrideLoginDomain - Login domain to use, or null to auto-detect from current tab
 * @param overrideClientId - Custom client ID, or null to use default
 * @param connectionId - Connection ID if re-authorizing existing connection
 */
export async function startAuthorization(
    overrideLoginDomain: string | null,
    overrideClientId: string | null,
    connectionId: string | null
): Promise<void> {
    // Use provided domain or detect from current tab
    let loginDomain = overrideLoginDomain;
    if (!loginDomain) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.url) {
                loginDomain = detectLoginDomain(tab.url);
            }
        } catch {
            // Ignore tab query errors
        }
        // Fall back to standard login if detection fails
        if (!loginDomain) {
            loginDomain = 'https://login.salesforce.com';
        }
    }

    // Check proxy for code flow vs implicit flow
    let useCodeFlow = false;
    try {
        const proxyStatus = await chrome.runtime.sendMessage({ type: 'checkProxyConnection' });
        useCodeFlow = proxyStatus?.connected ?? false;
    } catch {
        // Proxy not available, use implicit flow
    }

    // Get client ID - use override, or fall back to default
    const clientId = overrideClientId ?? (await getOAuthCredentials()).clientId;

    // Generate state parameter for CSRF protection
    const state = generateOAuthState();

    // Store pending auth state for callback to use
    await setPendingAuth({
        loginDomain,
        clientId: overrideClientId, // Store only if custom (null means use default)
        connectionId, // Set if re-authorizing existing connection
        state, // For CSRF validation
    });

    // Build OAuth URL and open in new tab
    const authUrl = buildOAuthUrl(loginDomain, clientId, CALLBACK_URL, state, useCodeFlow);
    chrome.tabs.create({ url: authUrl });
}
