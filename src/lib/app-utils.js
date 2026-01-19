/**
 * Pure utility functions for the App Shell
 * Extracted for testability
 */

/**
 * Detects Salesforce login domain from a URL
 * @param {string} url - The URL to parse
 * @returns {string|null} - The login domain or null if not a Salesforce URL
 */
export function detectLoginDomain(url) {
    try {
        const urlObj = new URL(url);

        if (urlObj.hostname.includes('.my.salesforce.com')) {
            return urlObj.origin;
        }

        if (urlObj.hostname.includes('.lightning.force.com')) {
            return urlObj.origin.replace('.lightning.force.com', '.my.salesforce.com');
        }

        if (urlObj.hostname.includes('.salesforce-setup.com')) {
            return urlObj.origin.replace('.salesforce-setup.com', '.salesforce.com');
        }

        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Builds OAuth authorization URL
 * @param {string} loginDomain - The Salesforce login domain
 * @param {string} clientId - OAuth client ID
 * @param {string} redirectUri - OAuth redirect URI
 * @param {string} state - CSRF state parameter
 * @param {boolean} useCodeFlow - Use authorization code flow instead of implicit
 * @returns {string} - The complete OAuth authorization URL
 */
export function buildOAuthUrl(loginDomain, clientId, redirectUri, state, useCodeFlow = false) {
    const responseType = useCodeFlow ? 'code' : 'token';
    return `${loginDomain}/services/oauth2/authorize` +
        `?client_id=${clientId}` +
        `&response_type=${responseType}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&state=${encodeURIComponent(state)}`;
}
