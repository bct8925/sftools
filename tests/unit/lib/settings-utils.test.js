/**
 * Tests for src/lib/settings-utils.js
 *
 * Test IDs:
 * - S-U-003: createConnectionCardData() - Renders connection details
 * - S-U-004: getProxyStatusText() - Shows connected status
 * - S-U-005: getProxyStatusText() - Shows disconnected status
 *
 * Note: S-U-001 and S-U-002 (applyTheme tests) are in theme.test.js
 */

import { describe, it, expect } from 'vitest';
import { createConnectionCardData, getProxyStatusText } from '../../../src/lib/settings-utils.js';

describe('settings-utils', () => {
    describe('createConnectionCardData', () => {
        it('S-U-003: renders connection details with all badges', () => {
            const connection = {
                id: 'conn-123',
                label: 'Production Org',
                refreshToken: 'refresh_token_abc',
                clientId: 'custom_client_id'
            };

            const result = createConnectionCardData(connection, 'conn-123');

            expect(result.isActive).toBe(true);
            expect(result.escapedLabel).toBe('Production Org');
            expect(result.refreshBadge).toContain('Auto-refresh');
            expect(result.refreshBadge).toContain('refresh-enabled');
            expect(result.customAppBadge).toContain('Custom App');
        });

        it('renders inactive connection without badges', () => {
            const connection = {
                id: 'conn-456',
                label: 'Sandbox Org',
                refreshToken: null,
                clientId: null
            };

            const result = createConnectionCardData(connection, 'conn-123');

            expect(result.isActive).toBe(false);
            expect(result.escapedLabel).toBe('Sandbox Org');
            expect(result.refreshBadge).toBe('');
            expect(result.customAppBadge).toBe('');
        });

        it('escapes HTML in connection label', () => {
            const connection = {
                id: 'conn-789',
                label: '<script>alert("XSS")</script>',
                refreshToken: null,
                clientId: null
            };

            const result = createConnectionCardData(connection);

            // escapeHtml escapes < > & but not quotes (use escapeAttr for attributes)
            expect(result.escapedLabel).toBe('&lt;script&gt;alert("XSS")&lt;/script&gt;');
            expect(result.escapedLabel).not.toContain('<script>');
        });

        it('handles connection with refresh token but no custom client ID', () => {
            const connection = {
                id: 'conn-101',
                label: 'Test Org',
                refreshToken: 'refresh_abc',
                clientId: null
            };

            const result = createConnectionCardData(connection);

            expect(result.refreshBadge).toContain('Auto-refresh');
            expect(result.customAppBadge).toBe('');
        });

        it('handles connection with custom client ID but no refresh token', () => {
            const connection = {
                id: 'conn-102',
                label: 'Test Org',
                refreshToken: null,
                clientId: 'custom_id'
            };

            const result = createConnectionCardData(connection);

            expect(result.refreshBadge).toBe('');
            expect(result.customAppBadge).toContain('Custom App');
        });

        it('defaults activeId to null when not provided', () => {
            const connection = {
                id: 'conn-103',
                label: 'Test Org',
                refreshToken: null,
                clientId: null
            };

            const result = createConnectionCardData(connection);

            expect(result.isActive).toBe(false);
        });
    });

    describe('getProxyStatusText', () => {
        it('S-U-004: returns connected status text', () => {
            const result = getProxyStatusText(true);

            expect(result.label).toBe('Connected');
            expect(result.detail).toBe('HTTP server on port');
        });

        it('S-U-005: returns disconnected status text', () => {
            const result = getProxyStatusText(false);

            expect(result.label).toBe('Not Connected');
            expect(result.detail).toBe('');
        });
    });
});
