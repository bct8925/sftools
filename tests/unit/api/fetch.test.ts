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
        authModule = await import('../../../src/auth/auth.js');
        fetchModule = await import('../../../src/api/fetch.js');

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

        it('FE-U-020: returns false when chrome.runtime is undefined', async () => {
            // Temporarily remove chrome.runtime
            const originalRuntime = chrome.runtime;
            (chrome as { runtime: unknown }).runtime = undefined;

            const result = await fetchModule.checkProxyStatus();

            expect(result).toBe(false);

            // Restore chrome.runtime
            (chrome as { runtime: unknown }).runtime = originalRuntime;
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
        const originalRuntimeId = 'test-extension-id';

        beforeEach(() => {
            authModule.setActiveConnection(createMockConnection({ id: 'active-conn' }));
            // Override runtime.id to simulate real extension context
            // This makes isExtensionContext() return true so smartFetch uses extension/proxy fetch
            (chrome.runtime as { id: string }).id = 'real-extension-id-abc123';
        });

        afterEach(() => {
            // Restore original test extension ID
            (chrome.runtime as { id: string }).id = originalRuntimeId;
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

        it('FE-U-022: triggers auth expired with connectionId from response', async () => {
            const callback = vi.fn();
            authModule.onAuthExpired(callback);

            chrome.runtime.sendMessage.mockResolvedValueOnce({
                ok: false,
                authExpired: true,
                connectionId: 'response-conn-id',
                error: 'Session expired',
            });

            await fetchModule.extensionFetch('https://api.salesforce.com/test');

            expect(callback).toHaveBeenCalledWith('response-conn-id', undefined);
        });

        it('FE-U-023: triggers auth expired with provided connectionId when response lacks it', async () => {
            const callback = vi.fn();
            authModule.onAuthExpired(callback);

            chrome.runtime.sendMessage.mockResolvedValueOnce({
                ok: false,
                authExpired: true,
                error: 'Session expired',
            });

            await fetchModule.extensionFetch(
                'https://api.salesforce.com/test',
                {},
                'provided-conn-id'
            );

            expect(callback).toHaveBeenCalledWith('provided-conn-id', undefined);
        });

        it('FE-U-024: triggers auth expired with active connectionId when no connectionId available', async () => {
            const callback = vi.fn();
            authModule.onAuthExpired(callback);

            chrome.runtime.sendMessage.mockResolvedValueOnce({
                ok: false,
                authExpired: true,
                error: 'Session expired',
            });

            await fetchModule.extensionFetch('https://api.salesforce.com/test');

            // Uses active connection ID from getActiveConnectionId()
            expect(callback).toHaveBeenCalledWith('active-conn', undefined);
        });
    });

    describe('directFetch (headless test mode)', () => {
        const originalRuntimeId = 'test-extension-id';

        beforeEach(() => {
            // Set runtime.id to TEST_EXTENSION_ID to simulate headless test mode
            // This makes isExtensionContext() return false
            (chrome.runtime as { id: string }).id = 'test-extension-id';
        });

        afterEach(() => {
            // Restore original runtime.id
            (chrome.runtime as { id: string }).id = originalRuntimeId;
        });

        it('FE-U-021: uses directFetch when chrome is undefined', async () => {
            // Temporarily remove chrome object
            const originalChrome = global.chrome;
            (global as { chrome: unknown }).chrome = undefined;

            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                text: async () => '{"success":true}',
            });

            const result = await fetchModule.smartFetch('https://api.salesforce.com/test');

            expect(result).toEqual({
                success: true,
                status: 200,
                statusText: 'OK',
                data: '{"success":true}',
            });

            // Restore chrome object
            (global as { chrome: unknown }).chrome = originalChrome;
        });

        it('FE-U-014: uses directFetch when not in extension context (success)', async () => {
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                status: 200,
                statusText: 'OK',
                text: async () => '{"records":[]}',
            });

            const result = await fetchModule.smartFetch('https://api.salesforce.com/test', {
                method: 'GET',
            });

            expect(global.fetch).toHaveBeenCalledWith('https://api.salesforce.com/test', {
                method: 'GET',
                headers: undefined,
                body: undefined,
            });

            expect(result).toEqual({
                success: true,
                status: 200,
                statusText: 'OK',
                data: '{"records":[]}',
            });
        });

        it('FE-U-015: uses directFetch when not in extension context (network error)', async () => {
            global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

            const result = await fetchModule.smartFetch('https://api.salesforce.com/test');

            expect(result).toEqual({
                success: false,
                status: 0,
                error: 'Network error',
            });
        });

        it('FE-U-016: uses directFetch with POST method and body', async () => {
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                status: 201,
                statusText: 'Created',
                text: async () => '{"id":"001xxx"}',
            });

            const result = await fetchModule.smartFetch('https://api.salesforce.com/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{"name":"Test"}',
            });

            expect(global.fetch).toHaveBeenCalledWith('https://api.salesforce.com/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{"name":"Test"}',
            });

            expect(result).toEqual({
                success: true,
                status: 201,
                statusText: 'Created',
                data: '{"id":"001xxx"}',
            });
        });

        it('FE-U-017: uses directFetch with HTTP error (non-ok response)', async () => {
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                text: async () => '{"error":"Resource not found"}',
            });

            const result = await fetchModule.smartFetch('https://api.salesforce.com/test');

            expect(result).toEqual({
                success: false,
                status: 404,
                statusText: 'Not Found',
                data: '{"error":"Resource not found"}',
            });
        });

        it('FE-U-018: uses directFetch when fetch throws non-Error object', async () => {
            global.fetch = vi.fn().mockRejectedValueOnce('Unknown error');

            const result = await fetchModule.smartFetch('https://api.salesforce.com/test');

            expect(result).toEqual({
                success: false,
                status: 0,
                error: 'Network error',
            });
        });
    });

    describe('proxyFetch error handling', () => {
        beforeEach(() => {
            authModule.setActiveConnection(createMockConnection({ id: 'active-conn' }));
        });

        it('FE-U-019: throws error when chrome.runtime is not available', async () => {
            // Temporarily remove chrome.runtime
            const originalRuntime = chrome.runtime;
            (chrome as { runtime: unknown }).runtime = undefined;

            await expect(fetchModule.proxyFetch('https://api.salesforce.com/test')).rejects.toThrow(
                'Proxy fetch requires extension context'
            );

            // Restore chrome.runtime
            (chrome as { runtime: unknown }).runtime = originalRuntime;
        });
    });
});
