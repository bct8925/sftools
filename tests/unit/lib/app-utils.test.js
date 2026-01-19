/**
 * Tests for src/lib/app-utils.js
 *
 * Test IDs:
 * - AS-U-001: buildOAuthUrl() - Builds OAuth authorization URLs
 * - AS-U-002: detectLoginDomain() - Extracts Salesforce login domain from URL
 * - AS-U-003: parseLightningUrl() - Parses Lightning record URLs
 * - AS-U-004: findConnectionByDomain() - Finds connection matching URL domain
 * - AS-U-005: getActiveTab() - Gets current active Chrome tab
 */

import { describe, it, expect } from 'vitest';
import { detectLoginDomain, buildOAuthUrl } from '../../../src/lib/app-utils.js';

describe('app-utils', () => {
    describe('detectLoginDomain', () => {
        it('AS-U-002.1: extracts domain from my.salesforce.com URL', () => {
            const url = 'https://example.my.salesforce.com/lightning/r/Account/001.../view';
            const result = detectLoginDomain(url);
            expect(result).toBe('https://example.my.salesforce.com');
        });

        it('AS-U-002.2: converts lightning.force.com to my.salesforce.com', () => {
            const url = 'https://example.lightning.force.com/lightning/r/Account/001.../view';
            const result = detectLoginDomain(url);
            expect(result).toBe('https://example.my.salesforce.com');
        });

        it('AS-U-002.3: converts salesforce-setup.com to salesforce.com', () => {
            const url = 'https://example.salesforce-setup.com/setup/home';
            const result = detectLoginDomain(url);
            expect(result).toBe('https://example.salesforce.com');
        });

        it('AS-U-002.4: returns null for non-Salesforce URL', () => {
            const url = 'https://google.com/search';
            const result = detectLoginDomain(url);
            expect(result).toBeNull();
        });

        it('AS-U-002.5: returns null for invalid URL', () => {
            const url = 'not-a-valid-url';
            const result = detectLoginDomain(url);
            expect(result).toBeNull();
        });

        it('AS-U-002.6: handles URLs with non-standard ports', () => {
            const url = 'https://example.my.salesforce.com:8443/lightning/r/Account/001.../view';
            const result = detectLoginDomain(url);
            expect(result).toBe('https://example.my.salesforce.com:8443');
        });

        it('AS-U-002.7: preserves protocol', () => {
            const url = 'http://example.my.salesforce.com/lightning/r/Account/001.../view';
            const result = detectLoginDomain(url);
            expect(result).toBe('http://example.my.salesforce.com');
        });
    });

    describe('buildOAuthUrl', () => {
        const loginDomain = 'https://login.salesforce.com';
        const clientId = '3MVG9...test_client_id';
        const redirectUri = 'https://sftools.dev/sftools-callback';
        const state = 'random-state-string';

        it('AS-U-001.1: builds OAuth URL with implicit flow', () => {
            const result = buildOAuthUrl(loginDomain, clientId, redirectUri, state, false);

            expect(result).toContain('https://login.salesforce.com/services/oauth2/authorize');
            expect(result).toContain(`client_id=${clientId}`);
            expect(result).toContain('response_type=token');
            expect(result).toContain(`redirect_uri=${encodeURIComponent(redirectUri)}`);
            expect(result).toContain(`state=${encodeURIComponent(state)}`);
        });

        it('AS-U-001.2: builds OAuth URL with authorization code flow', () => {
            const result = buildOAuthUrl(loginDomain, clientId, redirectUri, state, true);

            expect(result).toContain('https://login.salesforce.com/services/oauth2/authorize');
            expect(result).toContain(`client_id=${clientId}`);
            expect(result).toContain('response_type=code');
            expect(result).toContain(`redirect_uri=${encodeURIComponent(redirectUri)}`);
            expect(result).toContain(`state=${encodeURIComponent(state)}`);
        });

        it('AS-U-001.3: encodes redirect URI correctly', () => {
            const result = buildOAuthUrl(loginDomain, clientId, redirectUri, state);

            // URL should contain encoded redirect URI
            expect(result).toContain('redirect_uri=https%3A%2F%2Fsftools.dev%2Fsftools-callback');
        });

        it('AS-U-001.4: encodes state parameter correctly', () => {
            const specialState = 'state-with-special-chars-!@#$%^&*()';
            const result = buildOAuthUrl(loginDomain, clientId, redirectUri, specialState);

            expect(result).toContain(`state=${encodeURIComponent(specialState)}`);
        });

        it('AS-U-001.5: handles custom login domain', () => {
            const customDomain = 'https://mycompany.my.salesforce.com';
            const result = buildOAuthUrl(customDomain, clientId, redirectUri, state);

            expect(result).toContain('https://mycompany.my.salesforce.com/services/oauth2/authorize');
        });

        it('AS-U-001.6: defaults to implicit flow when useCodeFlow not provided', () => {
            const result = buildOAuthUrl(loginDomain, clientId, redirectUri, state);

            expect(result).toContain('response_type=token');
            expect(result).not.toContain('response_type=code');
        });

        it('AS-U-001.7: builds complete URL with all parameters', () => {
            const result = buildOAuthUrl(loginDomain, clientId, redirectUri, state);

            // URL should have all required OAuth parameters
            const url = new URL(result);
            expect(url.hostname).toBe('login.salesforce.com');
            expect(url.pathname).toBe('/services/oauth2/authorize');
            expect(url.searchParams.get('client_id')).toBe(clientId);
            expect(url.searchParams.get('response_type')).toBe('token');
            expect(url.searchParams.get('redirect_uri')).toBe(redirectUri);
            expect(url.searchParams.get('state')).toBe(state);
        });
    });
});
