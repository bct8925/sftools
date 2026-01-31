import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { chromeMock } from '../mocks/chrome';
import { createMockConnection } from '../mocks/salesforce';

Object.assign(globalThis, { chrome: chromeMock });

// Mock chrome APIs not in chromeMock
(chrome as Record<string, unknown>).action = { onClicked: { addListener: vi.fn() } };
(chrome as Record<string, unknown>).sidePanel = { open: vi.fn() };
(chrome as Record<string, unknown>).notifications = { create: vi.fn() };
(chrome.contextMenus as Record<string, unknown>).onClicked = { addListener: vi.fn() };
(chrome.runtime as Record<string, unknown>).onInstalled = { addListener: vi.fn() };

// crypto.randomUUID is used by subscribe handler — no need to mock, we use expect.any(String)

// Helper to create real Response objects for fetch mocking
function mockResponse(
    status: number,
    body: string,
    headers: Record<string, string> = {}
): Response {
    return new Response(body, { status, headers });
}

// Mock dependencies
vi.mock('../../../src/background/native-messaging', () => ({
    connectNative: vi.fn().mockResolvedValue({ success: true }),
    disconnectNative: vi.fn(),
    sendProxyRequest: vi.fn(),
    isProxyConnected: vi.fn().mockReturnValue(false),
    getProxyInfo: vi.fn().mockReturnValue({ connected: false, httpPort: null, hasSecret: false }),
}));

vi.mock('../../../src/background/auth', () => ({
    exchangeCodeForTokens: vi.fn(),
    refreshAccessToken: vi.fn(),
    updateConnectionToken: vi.fn(),
}));

vi.mock('../../../src/background/debug', () => ({
    debugInfo: vi.fn(),
}));

vi.mock('../../../src/lib/background-utils', () => ({
    parseLightningUrl: vi.fn(),
    findConnectionByDomain: vi.fn(),
}));

import {
    connectNative,
    disconnectNative,
    sendProxyRequest,
    isProxyConnected,
    getProxyInfo,
} from '../../../src/background/native-messaging';
import {
    exchangeCodeForTokens,
    refreshAccessToken,
    updateConnectionToken,
} from '../../../src/background/auth';
import { parseLightningUrl, findConnectionByDomain } from '../../../src/lib/background-utils';

// Capture the message listener registered by background.ts
let messageListener: (
    request: Record<string, unknown>,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
) => boolean | void;

// Override addListener to capture the handler
const origAddListener = chrome.runtime.onMessage.addListener;
(chrome.runtime.onMessage as Record<string, unknown>).addListener = vi.fn(
    (fn: typeof messageListener) => {
        messageListener = fn;
    }
);

// Import background module — this registers the listener
await import('../../../src/background/background');

// Helper to send a message and get the response
function sendMessage(request: Record<string, unknown>): Promise<unknown> {
    return new Promise(resolve => {
        messageListener(request, {}, resolve);
    });
}

describe('background service worker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        chromeMock._reset();
        vi.mocked(isProxyConnected).mockReturnValue(false);
        vi.mocked(getProxyInfo).mockReturnValue({
            connected: false,
            httpPort: null,
            version: undefined,
            hasSecret: false,
        });
        globalThis.fetch = vi.fn();
    });

    describe('message routing', () => {
        it('routes fetch to handler', async () => {
            vi.mocked(globalThis.fetch).mockResolvedValue(
                mockResponse(200, '{"ok":true}', { 'content-type': 'application/json' })
            );

            const res = await sendMessage({
                type: 'fetch',
                url: 'https://org.sf.com/api',
                options: { method: 'GET', headers: {} },
            });

            expect(res).toMatchObject({ success: true, status: 200 });
        });

        it('routes connectProxy to native messaging', async () => {
            vi.mocked(connectNative).mockResolvedValue({ success: true, version: '1.0' });

            const res = await sendMessage({ type: 'connectProxy' });

            expect(res).toMatchObject({ success: true });
            expect(connectNative).toHaveBeenCalled();
        });

        it('routes disconnectProxy', async () => {
            const res = await sendMessage({ type: 'disconnectProxy' });

            expect(res).toEqual({ success: true });
            expect(disconnectNative).toHaveBeenCalled();
        });

        it('routes checkProxyConnection', async () => {
            vi.mocked(getProxyInfo).mockReturnValue({
                connected: true,
                httpPort: 8080,
                version: '1.0',
                hasSecret: true,
            });

            const res = await sendMessage({ type: 'checkProxyConnection' });

            expect(res).toMatchObject({ success: true, connected: true, httpPort: 8080 });
        });

        it('routes getProxyInfo', async () => {
            const res = await sendMessage({ type: 'getProxyInfo' });
            expect(res).toMatchObject({ success: true });
            expect(getProxyInfo).toHaveBeenCalled();
        });

        it('routes tokenExchange', async () => {
            vi.mocked(exchangeCodeForTokens).mockResolvedValue({
                success: true,
                accessToken: 'at',
                refreshToken: 'rt',
                instanceUrl: 'https://org.sf.com',
                loginDomain: 'https://login.salesforce.com',
            });

            const res = await sendMessage({
                type: 'tokenExchange',
                code: 'code',
                redirectUri: 'redir',
                loginDomain: 'https://login.salesforce.com',
                clientId: 'cid',
            });

            expect(res).toMatchObject({ success: true, accessToken: 'at' });
            expect(exchangeCodeForTokens).toHaveBeenCalledWith(
                'code',
                'redir',
                'https://login.salesforce.com',
                'cid'
            );
        });

        it('returns false for unknown message type', () => {
            const result = messageListener({ type: 'unknown' }, {}, () => {});
            expect(result).toBe(false);
        });
    });

    describe('proxyRequired wrapper', () => {
        it('returns error when proxy not connected', async () => {
            vi.mocked(isProxyConnected).mockReturnValue(false);

            const res = await sendMessage({
                type: 'subscribe',
                accessToken: 'tok',
                instanceUrl: 'https://org.sf.com',
                channel: '/event/Evt__e',
            });

            expect(res).toEqual({ success: false, error: 'Proxy not connected' });
        });

        it('calls handler when proxy connected', async () => {
            vi.mocked(isProxyConnected).mockReturnValue(true);
            vi.mocked(sendProxyRequest).mockResolvedValue({ success: true });

            const res = await sendMessage({
                type: 'unsubscribe',
                subscriptionId: 'sub-1',
            });

            expect(res).toMatchObject({ success: true });
            expect(sendProxyRequest).toHaveBeenCalledWith({
                type: 'unsubscribe',
                subscriptionId: 'sub-1',
            });
        });

        it('catches handler errors', async () => {
            vi.mocked(isProxyConnected).mockReturnValue(true);
            vi.mocked(sendProxyRequest).mockRejectedValue(new Error('Timeout'));

            const res = await sendMessage({
                type: 'unsubscribe',
                subscriptionId: 'sub-1',
            });

            expect(res).toEqual({ success: false, error: 'Timeout' });
        });
    });

    describe('fetch handler', () => {
        it('converts response headers', async () => {
            vi.mocked(globalThis.fetch).mockResolvedValue(
                mockResponse(200, '{}', { 'Content-Type': 'application/json', 'X-Custom': 'val' })
            );

            const res = (await sendMessage({
                type: 'fetch',
                url: 'https://org.sf.com/api',
                options: { method: 'GET', headers: {} },
            })) as Record<string, unknown>;

            expect((res.headers as Record<string, string>)['content-type']).toBe(
                'application/json'
            );
        });

        it('handles network error with status 0', async () => {
            vi.mocked(globalThis.fetch).mockRejectedValue(new Error('Network error'));

            const res = await sendMessage({
                type: 'fetch',
                url: 'https://org.sf.com/api',
                options: { method: 'GET', headers: {} },
            });

            expect(res).toMatchObject({ success: false, status: 0, error: 'Network error' });
        });

        it('returns non-ok response', async () => {
            vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse(500, 'error'));

            const res = await sendMessage({
                type: 'fetch',
                url: 'https://org.sf.com/api',
                options: { method: 'GET', headers: {} },
            });

            expect(res).toMatchObject({ success: false, status: 500, data: 'error' });
        });
    });

    describe('401 handling', () => {
        it('retries after successful token refresh', async () => {
            const conn = createMockConnection({ id: 'c1', refreshToken: 'rt' });
            chromeMock._setStorageData({ connections: [conn] });
            vi.mocked(isProxyConnected).mockReturnValue(true);
            vi.mocked(refreshAccessToken).mockResolvedValue({
                success: true,
                accessToken: 'new-tok',
            });

            vi.mocked(globalThis.fetch)
                .mockResolvedValueOnce(mockResponse(401, ''))
                .mockResolvedValueOnce(mockResponse(200, '{"ok":true}'));

            const res = await sendMessage({
                type: 'fetch',
                url: 'https://org.sf.com/api',
                options: { method: 'GET', headers: { Authorization: 'Bearer old' } },
                connectionId: 'c1',
            });

            expect(res).toMatchObject({ success: true, status: 200 });
            expect(refreshAccessToken).toHaveBeenCalled();
            expect(updateConnectionToken).toHaveBeenCalledWith('c1', 'new-tok');
            expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        });

        it('returns authExpired when refresh fails', async () => {
            const conn = createMockConnection({ id: 'c1', refreshToken: 'rt' });
            chromeMock._setStorageData({ connections: [conn] });
            vi.mocked(isProxyConnected).mockReturnValue(true);
            vi.mocked(refreshAccessToken).mockResolvedValue({ success: false, error: 'Revoked' });

            vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse(401, ''));

            const res = await sendMessage({
                type: 'fetch',
                url: 'https://org.sf.com/api',
                options: { method: 'GET', headers: { Authorization: 'Bearer old' } },
                connectionId: 'c1',
            });

            expect(res).toMatchObject({
                success: false,
                status: 401,
                authExpired: true,
                connectionId: 'c1',
                error: 'Revoked',
            });
        });

        it('skips refresh when no refresh token', async () => {
            const conn = createMockConnection({ id: 'c1', refreshToken: null });
            chromeMock._setStorageData({ connections: [conn] });

            vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse(401, ''));

            const res = await sendMessage({
                type: 'fetch',
                url: 'https://org.sf.com/api',
                options: { method: 'GET', headers: { Authorization: 'Bearer tok' } },
                connectionId: 'c1',
            });

            expect(res).toMatchObject({ authExpired: true, error: 'Session expired' });
            expect(refreshAccessToken).not.toHaveBeenCalled();
        });

        it('skips refresh when proxy not connected', async () => {
            const conn = createMockConnection({ id: 'c1', refreshToken: 'rt' });
            chromeMock._setStorageData({ connections: [conn] });
            vi.mocked(isProxyConnected).mockReturnValue(false);

            vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse(401, ''));

            const res = await sendMessage({
                type: 'fetch',
                url: 'https://org.sf.com/api',
                options: { method: 'GET', headers: { Authorization: 'Bearer tok' } },
                connectionId: 'c1',
            });

            expect(res).toMatchObject({ authExpired: true, error: 'Session expired' });
            expect(refreshAccessToken).not.toHaveBeenCalled();
        });

        it('skips refresh when no Authorization header', async () => {
            vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse(401, ''));

            const res = await sendMessage({
                type: 'fetch',
                url: 'https://org.sf.com/api',
                options: { method: 'GET', headers: {} },
                connectionId: 'c1',
            });

            expect(res).toMatchObject({ success: false, status: 401 });
            expect(refreshAccessToken).not.toHaveBeenCalled();
        });

        it('skips refresh when no connectionId', async () => {
            vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse(401, ''));

            const res = await sendMessage({
                type: 'fetch',
                url: 'https://org.sf.com/api',
                options: { method: 'GET', headers: { Authorization: 'Bearer tok' } },
            });

            expect(res).toMatchObject({ success: false, status: 401 });
            expect(refreshAccessToken).not.toHaveBeenCalled();
        });
    });

    describe('proxyFetch handler', () => {
        it('routes through proxy', async () => {
            vi.mocked(isProxyConnected).mockReturnValue(true);
            vi.mocked(sendProxyRequest).mockResolvedValue({ success: true, data: '{}' });

            const res = await sendMessage({
                type: 'proxyFetch',
                url: 'https://org.sf.com/api',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{"a":1}',
            });

            expect(res).toMatchObject({ success: true });
            expect(sendProxyRequest).toHaveBeenCalledWith({
                type: 'rest',
                url: 'https://org.sf.com/api',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{"a":1}',
            });
        });
    });

    describe('streaming handlers', () => {
        beforeEach(() => {
            vi.mocked(isProxyConnected).mockReturnValue(true);
            vi.mocked(sendProxyRequest).mockResolvedValue({ success: true });
        });

        it('subscribe generates subscriptionId', async () => {
            const res = await sendMessage({
                type: 'subscribe',
                accessToken: 'tok',
                instanceUrl: 'https://org.sf.com',
                channel: '/event/Evt__e',
                replayPreset: 'LATEST',
            });

            expect(res).toMatchObject({ success: true, subscriptionId: expect.any(String) });
            expect(sendProxyRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'subscribe',
                    subscriptionId: expect.any(String),
                    channel: '/event/Evt__e',
                })
            );
        });

        it('getTopic forwards request', async () => {
            await sendMessage({
                type: 'getTopic',
                accessToken: 'tok',
                instanceUrl: 'https://org.sf.com',
                topicName: 'MyTopic',
                tenantId: 'tenant-1',
            });

            expect(sendProxyRequest).toHaveBeenCalledWith({
                type: 'getTopic',
                accessToken: 'tok',
                instanceUrl: 'https://org.sf.com',
                topicName: 'MyTopic',
                tenantId: 'tenant-1',
            });
        });

        it('getSchema forwards request', async () => {
            await sendMessage({
                type: 'getSchema',
                accessToken: 'tok',
                instanceUrl: 'https://org.sf.com',
                schemaId: 'schema-1',
                tenantId: 'tenant-1',
            });

            expect(sendProxyRequest).toHaveBeenCalledWith({
                type: 'getSchema',
                accessToken: 'tok',
                instanceUrl: 'https://org.sf.com',
                schemaId: 'schema-1',
                tenantId: 'tenant-1',
            });
        });
    });

    describe('error handling', () => {
        it('catches handler errors and returns error response', async () => {
            vi.mocked(connectNative).mockRejectedValue(new Error('Connection failed'));

            const res = await sendMessage({ type: 'connectProxy' });

            expect(res).toEqual({ success: false, error: 'Connection failed' });
        });
    });
});
