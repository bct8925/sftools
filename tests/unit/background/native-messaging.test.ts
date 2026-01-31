import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { chromeMock } from '../mocks/chrome';

// Assign chrome mock globally
Object.assign(globalThis, { chrome: chromeMock });

// Mock debug module
vi.mock('../../../src/background/debug', () => ({
    debugInfo: vi.fn(),
}));

// Types for the module under test
type NativeMessagingModule = typeof import('../../../src/background/native-messaging');

// Helper to build a mock port
function createMockPort() {
    const messageListeners: ((msg: unknown) => void)[] = [];
    const disconnectListeners: (() => void)[] = [];

    return {
        port: {
            postMessage: vi.fn(),
            disconnect: vi.fn(),
            onMessage: {
                addListener: vi.fn((fn: (msg: unknown) => void) => messageListeners.push(fn)),
                removeListener: vi.fn(),
            },
            onDisconnect: {
                addListener: vi.fn((fn: () => void) => disconnectListeners.push(fn)),
                removeListener: vi.fn(),
            },
        },
        simulateMessage(msg: unknown) {
            for (const listener of messageListeners) listener(msg);
        },
        simulateDisconnect() {
            for (const listener of disconnectListeners) listener();
        },
    };
}

describe('native-messaging', () => {
    let mod: NativeMessagingModule;
    let mockPort: ReturnType<typeof createMockPort>;

    beforeEach(async () => {
        vi.resetModules();
        chromeMock._reset();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        (chrome.runtime as Record<string, unknown>).lastError = null;

        mockPort = createMockPort();
        (chrome.runtime as Record<string, unknown>).connectNative = vi
            .fn()
            .mockReturnValue(mockPort.port);

        mod = await import('../../../src/background/native-messaging');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('connectNative', () => {
        it('performs init handshake and returns version/port', async () => {
            const promise = mod.connectNative();

            // Respond to init
            await vi.waitFor(() => {
                expect(mockPort.port.postMessage).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'init' })
                );
            });

            const initId = mockPort.port.postMessage.mock.calls[0][0].id;
            mockPort.simulateMessage({
                id: initId,
                success: true,
                version: '2.0.0',
                httpPort: 9000,
                secret: 'sec123',
            });

            const result = await promise;

            expect(result.success).toBe(true);
            expect(result.version).toBe('2.0.0');
            expect(result.httpPort).toBe(9000);
        });

        it('returns immediately when already connected', async () => {
            const promise = mod.connectNative();
            await vi.waitFor(() => {
                expect(mockPort.port.postMessage).toHaveBeenCalled();
            });
            const initId = mockPort.port.postMessage.mock.calls[0][0].id;
            mockPort.simulateMessage({
                id: initId,
                success: true,
                version: '1.0.0',
                httpPort: 8000,
            });
            await promise;

            const second = await mod.connectNative();
            expect(second.success).toBe(true);
            expect(second.version).toBe('connected');
        });

        it('returns failure on init error', async () => {
            const promise = mod.connectNative();
            await vi.waitFor(() => {
                expect(mockPort.port.postMessage).toHaveBeenCalled();
            });
            const initId = mockPort.port.postMessage.mock.calls[0][0].id;
            mockPort.simulateMessage({
                id: initId,
                success: false,
                error: 'Bad version',
            });

            const result = await promise;
            expect(result.success).toBe(false);
            expect(result.error).toBe('Bad version');
        });

        it('returns failure when connectNative throws', async () => {
            (chrome.runtime as Record<string, unknown>).connectNative = vi.fn(() => {
                throw new Error('Host not found');
            });

            // Re-import to pick up new mock
            vi.resetModules();
            const freshMod: NativeMessagingModule =
                await import('../../../src/background/native-messaging');
            const result = await freshMod.connectNative();

            expect(result.success).toBe(false);
            expect(result.error).toBe('Host not found');
        });

        it('stores proxyConnected in chrome storage', async () => {
            const promise = mod.connectNative();
            await vi.waitFor(() => {
                expect(mockPort.port.postMessage).toHaveBeenCalled();
            });
            const initId = mockPort.port.postMessage.mock.calls[0][0].id;
            mockPort.simulateMessage({
                id: initId,
                success: true,
                version: '1.0.0',
                httpPort: 8000,
            });
            await promise;

            const data = chromeMock._getStorageData();
            expect(data.proxyConnected).toBe(true);
        });
    });

    async function connectHelper() {
        const promise = mod.connectNative();
        await vi.waitFor(() => {
            expect(mockPort.port.postMessage).toHaveBeenCalled();
        });
        const initId = mockPort.port.postMessage.mock.calls[0][0].id;
        mockPort.simulateMessage({
            id: initId,
            success: true,
            version: '1.0.0',
            httpPort: 8000,
            secret: 'sec',
        });
        await promise;
        mockPort.port.postMessage.mockClear();
    }

    describe('disconnectNative', () => {
        it('disconnects and resets state', async () => {
            await connectHelper();
            expect(mod.isProxyConnected()).toBe(true);

            mod.disconnectNative();

            expect(mockPort.port.disconnect).toHaveBeenCalled();
            expect(mod.isProxyConnected()).toBe(false);
        });

        it('sets proxyConnected false in storage', async () => {
            await connectHelper();
            mod.disconnectNative();

            const data = chromeMock._getStorageData();
            expect(data.proxyConnected).toBe(false);
        });

        it('does nothing when not connected', () => {
            mod.disconnectNative(); // should not throw
            expect(mockPort.port.disconnect).not.toHaveBeenCalled();
        });
    });

    describe('sendProxyRequest', () => {
        beforeEach(async () => {
            await connectHelper();
        });

        it('sends request and receives response', async () => {
            const promise = mod.sendProxyRequest({ type: 'fetch', url: 'https://example.com' });

            await vi.waitFor(() => {
                expect(mockPort.port.postMessage).toHaveBeenCalled();
            });
            const reqId = mockPort.port.postMessage.mock.calls[0][0].id;
            mockPort.simulateMessage({ id: reqId, success: true, data: '{"ok":true}' });

            const result = await promise;
            expect(result.success).toBe(true);
            expect(result.data).toBe('{"ok":true}');
        });

        it('handles large payload via HTTP fetch', async () => {
            const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
                ok: true,
                text: async () => '{"success":true,"data":"big"}',
            } as Response);

            const promise = mod.sendProxyRequest({ type: 'fetch', url: 'https://example.com' });

            await vi.waitFor(() => {
                expect(mockPort.port.postMessage).toHaveBeenCalled();
            });
            const reqId = mockPort.port.postMessage.mock.calls[0][0].id;
            mockPort.simulateMessage({ id: reqId, success: true, largePayload: 'pay-1' });

            const result = await promise;
            expect(fetchSpy).toHaveBeenCalledWith('http://127.0.0.1:8000/payload/pay-1', {
                headers: { 'X-Proxy-Secret': 'sec' },
            });
            expect(result.data).toBe('big');
            fetchSpy.mockRestore();
        });

        it('throws on large payload fetch failure', async () => {
            const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
                ok: false,
                status: 404,
            } as Response);

            const promise = mod.sendProxyRequest({ type: 'fetch', url: 'https://example.com' });

            await vi.waitFor(() => {
                expect(mockPort.port.postMessage).toHaveBeenCalled();
            });
            const reqId = mockPort.port.postMessage.mock.calls[0][0].id;
            mockPort.simulateMessage({ id: reqId, success: true, largePayload: 'pay-2' });

            await expect(promise).rejects.toThrow('Failed to fetch payload: 404');
            fetchSpy.mockRestore();
        });

        it('rejects when not connected', async () => {
            mod.disconnectNative();

            await expect(
                mod.sendProxyRequest({ type: 'fetch', url: 'https://example.com' })
            ).rejects.toThrow('Native host not connected');
        });

        it('rejects on timeout', async () => {
            vi.useFakeTimers();

            const promise = mod.sendProxyRequest({ type: 'fetch', url: 'https://example.com' });

            vi.advanceTimersByTime(30000);

            await expect(promise).rejects.toThrow('Request timeout');

            vi.useRealTimers();
        });
    });

    describe('streaming events', () => {
        beforeEach(async () => {
            await connectHelper();
        });

        it('forwards streamEvent to runtime', () => {
            mockPort.simulateMessage({
                type: 'streamEvent',
                subscriptionId: 's1',
                event: { data: 'test' },
            });

            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
                type: 'streamEvent',
                subscriptionId: 's1',
                event: { data: 'test' },
            });
        });

        it('forwards streamError to runtime', () => {
            mockPort.simulateMessage({
                type: 'streamError',
                subscriptionId: 's1',
                error: 'fail',
            });

            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'streamError', subscriptionId: 's1' })
            );
        });

        it('forwards streamEnd to runtime', () => {
            mockPort.simulateMessage({ type: 'streamEnd', subscriptionId: 's1' });

            expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'streamEnd' })
            );
        });

        it('ignores errors when forwarding', () => {
            chromeMock.runtime.sendMessage.mockRejectedValue(new Error('context invalidated'));

            // Should not throw
            mockPort.simulateMessage({
                type: 'streamEvent',
                subscriptionId: 's1',
                event: {},
            });
        });
    });

    describe('onDisconnect handler', () => {
        it('rejects pending requests on disconnect', async () => {
            await connectHelper();

            const promise = mod.sendProxyRequest({ type: 'fetch', url: 'test' });

            mockPort.simulateDisconnect();

            await expect(promise).rejects.toThrow('Native host disconnected');
        });

        it('resets connection state', async () => {
            await connectHelper();
            expect(mod.isProxyConnected()).toBe(true);

            mockPort.simulateDisconnect();

            expect(mod.isProxyConnected()).toBe(false);
        });
    });

    describe('isProxyConnected', () => {
        it('returns false initially', () => {
            expect(mod.isProxyConnected()).toBe(false);
        });

        it('returns true after successful connect', async () => {
            await connectHelper();
            expect(mod.isProxyConnected()).toBe(true);
        });
    });

    describe('getProxyInfo', () => {
        it('returns disconnected state initially', () => {
            const info = mod.getProxyInfo();
            expect(info.connected).toBe(false);
            expect(info.httpPort).toBeNull();
            expect(info.hasSecret).toBe(false);
        });

        it('returns full info when connected', async () => {
            await connectHelper();
            const info = mod.getProxyInfo();
            expect(info.connected).toBe(true);
            expect(info.httpPort).toBe(8000);
            expect(info.version).toBe('1.0.0');
            expect(info.hasSecret).toBe(true);
        });

        it('clears info after disconnect', async () => {
            await connectHelper();
            mod.disconnectNative();
            const info = mod.getProxyInfo();
            expect(info.connected).toBe(false);
            expect(info.httpPort).toBeNull();
            expect(info.hasSecret).toBe(false);
        });
    });
});
