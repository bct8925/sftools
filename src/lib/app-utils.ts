/**
 * Pure utility functions for the App Shell
 * Extracted for testability
 */

/**
 * Detects Salesforce login domain from a URL
 * @param url - The URL to parse
 * @returns The login domain or null if not a Salesforce URL
 */
export function detectLoginDomain(url: string): string | null {
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
    } catch {
        return null;
    }
}

/**
 * Builds OAuth authorization URL
 * @param loginDomain - The Salesforce login domain
 * @param clientId - OAuth client ID
 * @param redirectUri - OAuth redirect URI
 * @param state - CSRF state parameter
 * @param useCodeFlow - Use authorization code flow instead of implicit
 * @returns The complete OAuth authorization URL
 */
export function buildOAuthUrl(
    loginDomain: string,
    clientId: string,
    redirectUri: string,
    state: string,
    useCodeFlow = false
): string {
    const responseType = useCodeFlow ? 'code' : 'token';
    return (
        `${loginDomain}/services/oauth2/authorize` +
        `?client_id=${clientId}` +
        `&response_type=${responseType}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&state=${encodeURIComponent(state)}`
    );
}
