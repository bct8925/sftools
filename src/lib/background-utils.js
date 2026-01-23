/**
 * Pure utility functions extracted from background.js
 * These functions have no side effects and can be unit tested
 */

/**
 * Parse Lightning record page URL to extract objectType and recordId
 * @param {string} url - Full URL or pathname
 * @returns {object|null} - { objectType, recordId } or null if not a Lightning record URL
 */
export function parseLightningUrl(url) {
    // Match Lightning record page URLs: /lightning/r/{SObjectType}/{RecordId}/view
    const regex = /\/lightning\/r\/([^/]+)\/([a-zA-Z0-9]{15,18})\/view/;
    const match = url.match(regex);
    return match ? { objectType: match[1], recordId: match[2] } : null;
}

/**
 * Extract org-specific identifier from Salesforce hostname
 * Handles various domain formats (sandbox, scratch, trailhead, etc.)
 * @param {string} hostname - Domain hostname (e.g., orgname.sandbox.my.salesforce.com)
 * @returns {string|null} - Org identifier (e.g., "orgname") or null if not recognized
 */
export function extractOrgIdentifier(hostname) {
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
        /^([^.]+)\.my\.salesforce\.com$/,
    ];

    for (const pattern of patterns) {
        const match = hostname.match(pattern);
        if (match) {
            return match[1].toLowerCase();
        }
    }
    return null;
}

/**
 * Find connection matching a Salesforce domain
 * Matches by exact hostname or org identifier
 * @param {Array} connections - Array of connection objects with instanceUrl
 * @param {string} domain - Domain to match against (hostname or full URL)
 * @returns {object|null} - Matching connection or null
 */
export function findConnectionByDomain(connections, domain) {
    if (!connections || connections.length === 0) {
        return null;
    }

    // Extract hostname if full URL provided
    let targetHostname;
    try {
        targetHostname = domain.includes('://') ? new URL(domain).hostname : domain;
    } catch {
        return null;
    }

    const targetOrgId = extractOrgIdentifier(targetHostname);

    for (const connection of connections) {
        try {
            const connHostname = new URL(connection.instanceUrl).hostname;

            // Direct hostname match
            if (targetHostname === connHostname) {
                return connection;
            }

            // Match by org identifier (handles lightning vs my.salesforce domain differences)
            const connOrgId = extractOrgIdentifier(connHostname);
            if (targetOrgId && connOrgId && targetOrgId === connOrgId) {
                return connection;
            }
        } catch {
            continue;
        }
    }

    return null;
}
