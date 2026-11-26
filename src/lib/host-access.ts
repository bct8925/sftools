// Optional Salesforce host access
// Without the proxy, the extension can't reach the OAuth token endpoint because of CORS.
// The user can grant optional host access to Salesforce sites once; requests from the
// service worker to those hosts then skip CORS, so the code flow (PKCE, DPoP, refresh)
// works without the proxy. The patterns must match optional_host_permissions in manifest.json.

export const SALESFORCE_HOST_PATTERNS = ['https://*.salesforce.com/*', 'https://*.force.com/*'];

/** True when the URL is on a host covered by SALESFORCE_HOST_PATTERNS */
export function isSalesforceHost(url: string): boolean {
    try {
        const { protocol, hostname } = new URL(url);
        return (
            protocol === 'https:' &&
            (hostname.endsWith('.salesforce.com') || hostname.endsWith('.force.com'))
        );
    } catch {
        return false;
    }
}

/** True when the extension may call this URL without CORS (granted host access) */
export async function hasHostAccess(url: string): Promise<boolean> {
    if (!isSalesforceHost(url)) return false;
    try {
        return await chrome.permissions.contains({ origins: [`${new URL(url).origin}/*`] });
    } catch {
        return false;
    }
}

/**
 * Make sure the extension has Salesforce host access, asking the user if needed.
 * Must run from a user gesture (a click). Returns false when the URL isn't a Salesforce
 * host, the user declines, or Chrome refuses the request.
 */
export async function ensureSalesforceHostAccess(url: string): Promise<boolean> {
    if (!isSalesforceHost(url)) return false;
    try {
        const origins = SALESFORCE_HOST_PATTERNS;
        if (await chrome.permissions.contains({ origins })) return true;
        return await chrome.permissions.request({ origins });
    } catch {
        return false;
    }
}
