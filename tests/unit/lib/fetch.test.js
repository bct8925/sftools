// Tests for src/lib/fetch.js

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
        it('returns false by default', () => {
            expect(fetchModule.isProxyConnected()).toBe(false);
        });
    });

    describe('checkProxyStatus', () => {
        it('returns true when proxy is connected', async () => {
            chrome.runtime.sendMessage.mockResolvedValueOnce({ connected: true });

            const result = await fetchModule.checkProxyStatus();

            expect(result).toBe(true);
            expect(fetchModule.isProxyConnected()).toBe(true);
        });

        it('returns false when proxy is not connected', async () => {
            chrome.runtime.sendMessage.mockResolvedValueOnce({ connected: false });

            const result = await fetchModule.checkProxyStatus();

            expect(result).toBe(false);
            expect(fetchModule.isProxyConnected()).toBe(false);
        });

        it('returns false on error', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            chrome.runtime.sendMessage.mockRejectedValueOnce(new Error('Connection failed'));

            const result = await fetchModule.checkProxyStatus();

            expect(result).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith('Error checking proxy status:', expect.any(Error));
            consoleSpy.mockRestore();
        });

        it('sends checkProxyConnection message', async () => {
            chrome.runtime.sendMessage.mockResolvedValueOnce({ connected: false });

            await fetchModule.checkProxyStatus();

            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'checkProxyConnection' });
        });
    });

    describe('extensionFetch', () => {
        beforeEach(() => {
            authModule.setActiveConnection(createMockConnection({ id: 'active-conn' }));
        });

        it('sends fetch message to background', async () => {
            chrome.runtime.sendMessage.mockResolvedValueOnce({ ok: true, data: {} });

            await fetchModule.extensionFetch('https://api.salesforce.com/test', { method: 'GET' });

            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
                type: 'fetch',
                url: 'https://api.salesforce.com/test',
                options: { method: 'GET' },
                connectionId: 'active-conn'
            });
        });

        it('uses provided connectionId over active connection', async () => {
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

        it('returns response from background', async () => {
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

        it('sends proxyFetch message to background', async () => {
            chrome.runtime.sendMessage.mockResolvedValueOnce({ ok: true, data: {} });

            await fetchModule.proxyFetch('https://api.salesforce.com/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{"test": true}'
            });

            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
                type: 'proxyFetch',
                url: 'https://api.salesforce.com/test',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{"test": true}',
                connectionId: 'active-conn'
            });
        });

        it('returns response from background', async () => {
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

        it('uses extensionFetch when proxy is not connected', async () => {
            chrome.runtime.sendMessage.mockResolvedValue({ ok: true, data: {} });

            await fetchModule.smartFetch('https://api.salesforce.com/test');

            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'fetch' })
            );
        });

        it('uses proxyFetch when proxy is connected', async () => {
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

        it('triggers auth expired when response has authExpired flag', async () => {
            const callback = vi.fn();
            authModule.onAuthExpired(callback);

            chrome.runtime.sendMessage.mockResolvedValueOnce({
                ok: false,
                authExpired: true,
                error: 'Session expired'
            });

            await fetchModule.extensionFetch('https://api.salesforce.com/test');

            expect(callback).toHaveBeenCalled();
        });
    });
});
