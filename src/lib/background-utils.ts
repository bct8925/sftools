/**
 * Pure utility functions extracted from background.js
 * These functions have no side effects and can be unit tested
 */

import type { SalesforceConnection } from '../types/salesforce';

// --- Types ---

export interface LightningUrlResult {
    objectType: string;
    recordId: string;
}

/**
 * Parse Lightning record page URL to extract objectType and recordId
 */
export function parseLightningUrl(url: string): LightningUrlResult | null {
    // Match Lightning record page URLs: /lightning/r/{SObjectType}/{RecordId}/view
    const regex = /\/lightning\/r\/([^/]+)\/([a-zA-Z0-9]{15,18})\/view/;
    const match = url.match(regex);
    return match ? { objectType: match[1], recordId: match[2] } : null;
}

/**
 * Extract org-specific identifier from Salesforce hostname
 * Handles various domain formats (sandbox, scratch, trailhead, etc.)
 */
export function extractOrgIdentifier(hostname: string): string | null {
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
 */
export function findConnectionByDomain(
    connections: SalesforceConnection[],
    domain: string
): SalesforceConnection | null {
    if (!connections || connections.length === 0) {
        return null;
    }

    // Extract hostname if full URL provided
    let targetHostname: string;
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
