/**
 * Utility functions for Settings Tab
 * Extracted for testability
 */

import { icons } from './icons.js';
import { escapeHtml } from './text-utils.js';

/**
 * Prepares connection data for display in the settings UI
 * @param {Object} connection - Connection object
 * @param {string} connection.id - Connection ID
 * @param {string} connection.label - Connection label
 * @param {string|null} connection.refreshToken - Refresh token (if available)
 * @param {string|null} connection.clientId - Custom client ID (if set)
 * @param {string|null} activeId - Currently active connection ID
 * @returns {Object} Display data with isActive, refreshBadge, customAppBadge, escapedLabel
 */
export function createConnectionCardData(connection, activeId = null) {
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
        escapedLabel: escapeHtml(connection.label)
    };
}

/**
 * Returns status text for proxy connection state
 * @param {boolean} isConnected - Whether proxy is connected
 * @returns {Object} Status text with label and detail
 */
export function getProxyStatusText(isConnected) {
    if (isConnected) {
        return {
            label: 'Connected',
            detail: 'HTTP server on port'
        };
    } else {
        return {
            label: 'Not Connected',
            detail: ''
        };
    }
}
