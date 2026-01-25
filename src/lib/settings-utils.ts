/**
 * Utility functions for Settings Tab
 * Extracted for testability
 */

import type { SalesforceConnection } from '../types/salesforce';
import { icons } from './icons.js';
import { escapeHtml } from './text-utils.js';

export interface ConnectionCardData {
    isActive: boolean;
    refreshBadge: string;
    customAppBadge: string;
    escapedLabel: string;
}

export interface ProxyStatusText {
    label: string;
    detail: string;
}

/**
 * Prepares connection data for display in the settings UI
 * @param connection - Connection object
 * @param activeId - Currently active connection ID
 * @returns Display data with isActive, refreshBadge, customAppBadge, escapedLabel
 */
export function createConnectionCardData(
    connection: SalesforceConnection,
    activeId: string | null = null
): ConnectionCardData {
    const isActive = connection.id === activeId;

    const refreshBadge = connection.refreshToken
        ? `<span class="settings-connection-badge refresh-enabled" title="Auto-refresh enabled">${icons.refreshSmall} Auto-refresh</span>`
        : '';

    const customAppBadge = connection.clientId
        ? '<span class="settings-connection-badge">Custom App</span>'
        : '';

    return {
        isActive,
        refreshBadge,
        customAppBadge,
        escapedLabel: escapeHtml(connection.label),
    };
}

/**
 * Returns status text for proxy connection state
 * @param isConnected - Whether proxy is connected
 * @returns Status text with label and detail
 */
export function getProxyStatusText(isConnected: boolean): ProxyStatusText {
    if (isConnected) {
        return {
            label: 'Connected',
            detail: 'HTTP server on port',
        };
    }
    return {
        label: 'Not Connected',
        detail: '',
    };
}
