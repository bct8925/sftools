/**
 * Tests for src/contexts/ProxyContext.tsx
 *
 * Test IDs: PC-U-001 through PC-U-008
 * - PC-U-001: useProxy throws when used outside ProxyProvider
 * - PC-U-002: Starts disconnected by default
 * - PC-U-003: connect() sets isConnected and syncs fetch routing flag
 * - PC-U-004: disconnect() clears isConnected and syncs fetch routing flag
 * - PC-U-005: connect() failure sets error and keeps fetch routing flag false
 * - PC-U-006: checkStatus() syncs connected state to fetch routing flag
 * - PC-U-007: smartFetch routes through proxyFetch after ProxyContext connect
 * - PC-U-008: smartFetch routes through extensionFetch after ProxyContext disconnect
 */

import { createElement, type ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

let ProxyProvider: typeof import('../../../src/contexts/ProxyContext').ProxyProvider;
let useProxy: typeof import('../../../src/contexts/ProxyContext').useProxy;
let fetchModule: typeof import('../../../src/api/fetch');

describe('ProxyContext', () => {
    beforeEach(async () => {
        // Reset modules so PROXY_CONNECTED starts fresh
        vi.resetModules();

        const contextModule = await import('../../../src/contexts/ProxyContext');
        ProxyProvider = contextModule.ProxyProvider;
        useProxy = contextModule.useProxy;
        fetchModule = await import('../../../src/api/fetch');

        // Default: checkStatus on mount returns disconnected
        chrome.runtime.sendMessage.mockResolvedValue({
            success: true,
            connected: false,
        });
    });

    function wrapper({ children }: { children: ReactNode }) {
        return createElement(ProxyProvider, null, children);
    }

    it('PC-U-001: useProxy throws when used outside ProxyProvider', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => renderHook(() => useProxy())).toThrow(
            'useProxy must be used within ProxyProvider'
        );
        spy.mockRestore();
    });

    it('PC-U-002: starts disconnected and fetch routing flag is false', async () => {
        const { result } = renderHook(() => useProxy(), { wrapper });

        await act(async () => {});

        expect(result.current.isConnected).toBe(false);
        expect(fetchModule.isProxyConnected()).toBe(false);
    });

    it('PC-U-003: connect() sets isConnected and syncs fetch routing flag', async () => {
        const { result } = renderHook(() => useProxy(), { wrapper });
        await act(async () => {});

        chrome.runtime.sendMessage.mockResolvedValueOnce({
            success: true,
            httpPort: 3000,
            version: '1.0.0',
        });

        await act(async () => {
            await result.current.connect();
        });

        expect(result.current.isConnected).toBe(true);
        expect(result.current.httpPort).toBe(3000);
        expect(result.current.version).toBe('1.0.0');
        expect(fetchModule.isProxyConnected()).toBe(true);
    });

    it('PC-U-004: disconnect() clears isConnected and syncs fetch routing flag', async () => {
        const { result } = renderHook(() => useProxy(), { wrapper });
        await act(async () => {});

        // Connect first
        chrome.runtime.sendMessage.mockResolvedValueOnce({
            success: true,
            httpPort: 3000,
            version: '1.0.0',
        });
        await act(async () => {
            await result.current.connect();
        });
        expect(fetchModule.isProxyConnected()).toBe(true);

        // Now disconnect
        chrome.runtime.sendMessage.mockResolvedValueOnce({ success: true });
        await act(async () => {
            await result.current.disconnect();
        });

        expect(result.current.isConnected).toBe(false);
        expect(fetchModule.isProxyConnected()).toBe(false);
    });

    it('PC-U-005: connect() failure sets error and keeps fetch routing flag false', async () => {
        const { result } = renderHook(() => useProxy(), { wrapper });
        await act(async () => {});

        chrome.runtime.sendMessage.mockResolvedValueOnce({
            success: false,
            error: 'Native host not found',
        });

        await act(async () => {
            await result.current.connect();
        });

        expect(result.current.isConnected).toBe(false);
        expect(result.current.error).toBe('Native host not found');
        expect(fetchModule.isProxyConnected()).toBe(false);
    });

    it('PC-U-006: checkStatus() syncs connected state to fetch routing flag', async () => {
        const { result } = renderHook(() => useProxy(), { wrapper });
        await act(async () => {});

        expect(fetchModule.isProxyConnected()).toBe(false);

        // Proxy connected externally (e.g. auto-connect on startup)
        chrome.runtime.sendMessage.mockResolvedValueOnce({
            success: true,
            connected: true,
            httpPort: 3000,
            version: '1.0.0',
        });

        await act(async () => {
            await result.current.checkStatus();
        });

        expect(result.current.isConnected).toBe(true);
        expect(fetchModule.isProxyConnected()).toBe(true);
    });

    describe('fetch routing integration', () => {
        const originalRuntimeId = chrome.runtime.id;

        beforeEach(async () => {
            // Override runtime.id so isExtensionContext() returns true
            // (the mock default is 'test-extension-id' which triggers directFetch)
            (chrome.runtime as { id: string }).id = 'real-extension-id';

            // Set up an active connection for fetch to use
            const authModule = await import('../../../src/auth/auth');
            const { createMockConnection } = await import('../mocks/salesforce');
            authModule.setActiveConnection(createMockConnection({ id: 'test-conn' }));
        });

        afterEach(() => {
            (chrome.runtime as { id: string }).id = originalRuntimeId;
        });

        it('PC-U-007: smartFetch routes through proxyFetch after ProxyContext connect', async () => {
            const { result } = renderHook(() => useProxy(), { wrapper });
            await act(async () => {});

            // Connect proxy
            chrome.runtime.sendMessage.mockResolvedValueOnce({
                success: true,
                httpPort: 3000,
                version: '1.0.0',
            });
            await act(async () => {
                await result.current.connect();
            });

            // Now smartFetch should route through proxyFetch
            chrome.runtime.sendMessage.mockResolvedValueOnce({
                success: true,
                status: 200,
                data: '{}',
            });
            await fetchModule.smartFetch('https://org.salesforce.com/services/data/v62.0/query');

            expect(chrome.runtime.sendMessage).toHaveBeenLastCalledWith(
                expect.objectContaining({ type: 'proxyFetch' })
            );
        });

        it('PC-U-008: smartFetch routes through extensionFetch after ProxyContext disconnect', async () => {
            const { result } = renderHook(() => useProxy(), { wrapper });
            await act(async () => {});

            // Connect then disconnect
            chrome.runtime.sendMessage.mockResolvedValueOnce({
                success: true,
                httpPort: 3000,
                version: '1.0.0',
            });
            await act(async () => {
                await result.current.connect();
            });

            chrome.runtime.sendMessage.mockResolvedValueOnce({ success: true });
            await act(async () => {
                await result.current.disconnect();
            });

            // Now smartFetch should route through extensionFetch
            chrome.runtime.sendMessage.mockResolvedValueOnce({
                success: true,
                status: 200,
                data: '{}',
            });
            await fetchModule.smartFetch('https://org.salesforce.com/services/data/v62.0/query');

            expect(chrome.runtime.sendMessage).toHaveBeenLastCalledWith(
                expect.objectContaining({ type: 'fetch' })
            );
        });
    });
});
