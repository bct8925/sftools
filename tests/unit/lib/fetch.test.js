/**
 * Tests for src/lib/fetch.js
 *
 * Test IDs: FE-U-001 through FE-U-013
 * - FE-U-001: isProxyConnected() - Returns cached status
 * - FE-U-002: checkProxyStatus() - Queries background
 * - FE-U-003: extensionFetch() - Routes via background
 * - FE-U-004: proxyFetch() - Routes via proxy
 * - FE-U-005: smartFetch() - Uses proxy if connected
 * - FE-U-006: smartFetch() - Falls back to extension
 * - FE-U-007: checkProxyStatus() - Returns false when proxy is not connected
 * - FE-U-008: checkProxyStatus() - Returns false on error
 * - FE-U-009: checkProxyStatus() - Sends checkProxyConnection message
 * - FE-U-010: extensionFetch() - Uses provided connectionId over active connection
 * - FE-U-011: extensionFetch() - Returns response from background
 * - FE-U-012: proxyFetch() - Returns response from background
 * - FE-U-013: Auth expiration handling - Triggers auth expired when response has authExpired flag
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockConnection } from '../mocks/salesforce.js';

// We need to reimport both auth and fetch modules after reset to ensure
// they share the same module instance
let fetchModule;
let authModule;

describe('fetch', () => {
    beforeEach(async () => {
        // Reset modules to clear PROXY_CONNECTED state
        vi.resetModules();

        // Reimport both modules so they share the same auth state
        authModule = await import('../../../src/lib/auth.js');
        fetchModule = await import('../../../src/lib/fetch.js');

        // Clear active connection
        authModule.setActiveConnection(null);
    });

    describe('isProxyConnected', () => {
        it('FE-U-001: returns false by default', () => {
            expect(fetchModule.isProxyConnected()).toBe(false);
        });
    });

    describe('checkProxyStatus', () => {
        it('FE-U-002: returns true when proxy is connected', async () => {
            chrome.runtime.sendMessage.mockResolvedValueOnce({ connected: true });

            const result = await fetchModule.checkProxyStatus();

            expect(result).toBe(true);
            expect(fetchModule.isProxyConnected()).toBe(true);
        });

        it('FE-U-007: returns false when proxy is not connected', async () => {
            chrome.runtime.sendMessage.mockResolvedValueOnce({ connected: false });

            const result = await fetchModule.checkProxyStatus();

            expect(result).toBe(false);
            expect(fetchModule.isProxyConnected()).toBe(false);
        });

        it('FE-U-008: returns false on error', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            chrome.runtime.sendMessage.mockRejectedValueOnce(new Error('Connection failed'));

            const result = await fetchModule.checkProxyStatus();

            expect(result).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith(
                'Error checking proxy status:',
                expect.any(Error)
            );
            consoleSpy.mockRestore();
        });

        it('FE-U-009: sends checkProxyConnection message', async () => {
            chrome.runtime.sendMessage.mockResolvedValueOnce({ connected: false });

            await fetchModule.checkProxyStatus();

            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
                type: 'checkProxyConnection',
            });
        });
    });

    describe('extensionFetch', () => {
        beforeEach(() => {
            authModule.setActiveConnection(createMockConnection({ id: 'active-conn' }));
        });

        it('FE-U-003: sends fetch message to background', async () => {
            chrome.runtime.sendMessage.mockResolvedValueOnce({ ok: true, data: {} });

            await fetchModule.extensionFetch('https://api.salesforce.com/test', { method: 'GET' });

            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
                type: 'fetch',
                url: 'https://api.salesforce.com/test',
                options: { method: 'GET' },
                connectionId: 'active-conn',
            });
        });

        it('FE-U-010: uses provided connectionId over active connection', async () => {
            chrome.runtime.sendMessage.mockResolvedValueOnce({ ok: true, data: {} });

            await fetchModule.extensionFetch(
                'https://api.salesforce.com/test',
                {},
                'specific-conn'
            );

            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({ connectionId: 'specific-conn' })
            );
        });

        it('FE-U-011: returns response from background', async () => {
            const mockResponse = { ok: true, status: 200, data: { records: [] } };
            chrome.runtime.sendMessage.mockResolvedValueOnce(mockResponse);

            const result = await fetchModule.extensionFetch('https://api.salesforce.com/test');

            expect(result).toEqual(mockResponse);
        });
    });

    describe('proxyFetch', () => {
        beforeEach(() => {
            authModule.setActiveConnection(createMockConnection({ id: 'active-conn' }));
        });

        it('FE-U-004: sends proxyFetch message to background', async () => {
            chrome.runtime.sendMessage.mockResolvedValueOnce({ ok: true, data: {} });

            await fetchModule.proxyFetch('https://api.salesforce.com/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{"test": true}',
            });

            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
                type: 'proxyFetch',
                url: 'https://api.salesforce.com/test',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{"test": true}',
                connectionId: 'active-conn',
            });
        });

        it('FE-U-012: returns response from background', async () => {
            const mockResponse = { ok: true, status: 200, data: { success: true } };
            chrome.runtime.sendMessage.mockResolvedValueOnce(mockResponse);

            const result = await fetchModule.proxyFetch('https://api.salesforce.com/test');

            expect(result).toEqual(mockResponse);
        });
    });

    describe('smartFetch', () => {
        beforeEach(() => {
            authModule.setActiveConnection(createMockConnection({ id: 'active-conn' }));
        });

        it('FE-U-006: uses extensionFetch when proxy is not connected', async () => {
            chrome.runtime.sendMessage.mockResolvedValue({ ok: true, data: {} });

            await fetchModule.smartFetch('https://api.salesforce.com/test');

            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'fetch' })
            );
        });

        it('FE-U-005: uses proxyFetch when proxy is connected', async () => {
            // First connect the proxy
            chrome.runtime.sendMessage.mockResolvedValueOnce({ connected: true });
            await fetchModule.checkProxyStatus();

            // Then make a smartFetch call
            chrome.runtime.sendMessage.mockResolvedValueOnce({ ok: true, data: {} });
            await fetchModule.smartFetch('https://api.salesforce.com/test');

            expect(chrome.runtime.sendMessage).toHaveBeenLastCalledWith(
                expect.objectContaining({ type: 'proxyFetch' })
            );
        });
    });

    describe('auth expiration handling', () => {
        beforeEach(() => {
            authModule.setActiveConnection(createMockConnection({ id: 'active-conn' }));
        });

        it('FE-U-013: triggers auth expired when response has authExpired flag', async () => {
            const callback = vi.fn();
            authModule.onAuthExpired(callback);

            chrome.runtime.sendMessage.mockResolvedValueOnce({
                ok: false,
                authExpired: true,
                error: 'Session expired',
            });

            await fetchModule.extensionFetch('https://api.salesforce.com/test');

            expect(callback).toHaveBeenCalled();
        });
    });
});
