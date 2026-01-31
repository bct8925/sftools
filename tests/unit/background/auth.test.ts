import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chromeMock } from '../mocks/chrome';
import { createMockConnection } from '../mocks/salesforce';

Object.assign(globalThis, { chrome: chromeMock });

vi.mock('../../../src/auth/oauth-credentials', () => ({
    getOAuthCredentials: vi.fn().mockResolvedValue({ clientId: 'default-client-id' }),
}));

vi.mock('../../../src/background/native-messaging', () => ({
    isProxyConnected: vi.fn().mockReturnValue(true),
    sendProxyRequest: vi.fn(),
}));

vi.mock('../../../src/background/debug', () => ({
    debugInfo: vi.fn(),
}));

import {
    exchangeCodeForTokens,
    refreshAccessToken,
    updateConnectionToken,
    clearAuthTokens,
} from '../../../src/background/auth';
import { isProxyConnected, sendProxyRequest } from '../../../src/background/native-messaging';

const mockIsProxyConnected = vi.mocked(isProxyConnected);
const mockSendProxyRequest = vi.mocked(sendProxyRequest);

describe('background/auth', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        chromeMock._reset();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mockIsProxyConnected.mockReturnValue(true);
    });

    describe('exchangeCodeForTokens', () => {
        it('returns error when proxy not connected', async () => {
            mockIsProxyConnected.mockReturnValue(false);

            const result = await exchangeCodeForTokens(
                'code',
                'redirect',
                'https://login.salesforce.com',
                'cid'
            );

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error).toBe('Proxy not connected');
        });

        it('sends correct OAuth request', async () => {
            mockSendProxyRequest.mockResolvedValue({
                success: true,
                data: JSON.stringify({
                    access_token: 'at',
                    refresh_token: 'rt',
                    instance_url: 'https://org.sf.com',
                }),
            });

            await exchangeCodeForTokens(
                'the-code',
                'https://redir',
                'https://login.salesforce.com',
                'my-client'
            );

            expect(mockSendProxyRequest).toHaveBeenCalledWith({
                type: 'rest',
                url: 'https://login.salesforce.com/services/oauth2/token',
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'grant_type=authorization_code&client_id=my-client&code=the-code&redirect_uri=https%3A%2F%2Fredir',
            });
        });

        it('returns tokens on success', async () => {
            mockSendProxyRequest.mockResolvedValue({
                success: true,
                data: JSON.stringify({
                    access_token: 'at',
                    refresh_token: 'rt',
                    instance_url: 'https://org.sf.com',
                }),
            });

            const result = await exchangeCodeForTokens(
                'code',
                'redir',
                'https://login.salesforce.com',
                'cid'
            );

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.accessToken).toBe('at');
                expect(result.refreshToken).toBe('rt');
                expect(result.instanceUrl).toBe('https://org.sf.com');
            }
        });

        it('extracts error_description from failed response data', async () => {
            mockSendProxyRequest.mockResolvedValue({
                success: false,
                error: 'HTTP 400',
                data: JSON.stringify({ error_description: 'Invalid code', error: 'invalid_grant' }),
            });

            const result = await exchangeCodeForTokens(
                'bad',
                'redir',
                'https://login.salesforce.com',
                'cid'
            );

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error).toBe('Invalid code');
        });

        it('falls back to error field when no error_description', async () => {
            mockSendProxyRequest.mockResolvedValue({
                success: false,
                error: 'HTTP 400',
                data: JSON.stringify({ error: 'invalid_client' }),
            });

            const result = await exchangeCodeForTokens(
                'code',
                'redir',
                'https://login.salesforce.com',
                'cid'
            );

            if (!result.success) expect(result.error).toBe('invalid_client');
        });

        it('handles unparseable data in error response', async () => {
            mockSendProxyRequest.mockResolvedValue({
                success: false,
                error: 'Server error',
                data: 'Not JSON',
            });

            const result = await exchangeCodeForTokens(
                'code',
                'redir',
                'https://login.salesforce.com',
                'cid'
            );

            if (!result.success) expect(result.error).toBe('Not JSON');
        });

        it('returns error when success but no access_token', async () => {
            mockSendProxyRequest.mockResolvedValue({
                success: true,
                data: JSON.stringify({ error_description: 'Something wrong' }),
            });

            const result = await exchangeCodeForTokens(
                'code',
                'redir',
                'https://login.salesforce.com',
                'cid'
            );

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error).toBe('Something wrong');
        });

        it('normalizes empty loginDomain to default', async () => {
            mockSendProxyRequest.mockResolvedValue({
                success: true,
                data: JSON.stringify({
                    access_token: 'at',
                    refresh_token: 'rt',
                    instance_url: 'https://org.sf.com',
                }),
            });

            const result = await exchangeCodeForTokens('code', 'redir', '', 'cid');

            if (result.success) expect(result.loginDomain).toBe('https://login.salesforce.com');
        });

        it('handles network error', async () => {
            mockSendProxyRequest.mockRejectedValue(new Error('Network timeout'));

            const result = await exchangeCodeForTokens(
                'code',
                'redir',
                'https://login.salesforce.com',
                'cid'
            );

            expect(result.success).toBe(false);
            if (!result.success) expect(result.error).toBe('Network timeout');
        });
    });

    describe('refreshAccessToken', () => {
        // Helper to create typed connection
        const mockConn = (overrides = {}) =>
            createMockConnection(
                overrides
            ) as unknown as import('../../../src/types/salesforce').SalesforceConnection;

        it('returns error when no connection', async () => {
            const result = await refreshAccessToken(
                null as unknown as import('../../../src/types/salesforce').SalesforceConnection
            );
            expect(result.success).toBe(false);
            if (!result.success) expect(result.error).toBe('No connection provided');
        });

        it('returns error when no refresh token', async () => {
            const result = await refreshAccessToken(mockConn({ id: 'no-rt', refreshToken: null }));
            if (!result.success) expect(result.error).toBe('No refresh token available');
        });

        it('returns error when proxy not connected', async () => {
            mockIsProxyConnected.mockReturnValue(false);
            const result = await refreshAccessToken(
                mockConn({ id: 'no-proxy', refreshToken: 'rt' })
            );
            if (!result.success) expect(result.error).toBe('Proxy not connected for token refresh');
        });

        it('refreshes token successfully', async () => {
            mockSendProxyRequest.mockResolvedValue({
                success: true,
                data: JSON.stringify({ access_token: 'new-token' }),
            });

            const result = await refreshAccessToken(
                mockConn({ id: 'success-test', refreshToken: 'rt' })
            );

            expect(result.success).toBe(true);
            if (result.success) expect(result.accessToken).toBe('new-token');
        });

        it('prevents concurrent refreshes with mutex', async () => {
            let resolveFirst: (v: unknown) => void = () => {};
            const blockedPromise = new Promise(r => {
                resolveFirst = r;
            });
            mockSendProxyRequest.mockReturnValueOnce(blockedPromise);

            const conn = mockConn({ id: 'mutex-test', refreshToken: 'rt' });

            const p1 = refreshAccessToken(conn);
            // Allow microtasks to run so p1 registers in the mutex map
            await new Promise(r => setTimeout(r, 0));
            const p2 = refreshAccessToken(conn);

            resolveFirst({ success: true, data: JSON.stringify({ access_token: 'tok' }) });

            const [r1, r2] = await Promise.all([p1, p2]);
            expect(r1).toBe(r2);
            expect(mockSendProxyRequest).toHaveBeenCalledTimes(1);
        });

        it('cleans up mutex after success allowing new refresh', async () => {
            mockSendProxyRequest.mockResolvedValue({
                success: true,
                data: JSON.stringify({ access_token: 'tok' }),
            });
            const conn = mockConn({ id: 'cleanup-test', refreshToken: 'rt' });

            await refreshAccessToken(conn);
            await refreshAccessToken(conn);

            expect(mockSendProxyRequest).toHaveBeenCalledTimes(2);
        });

        it('cleans up mutex after error allowing retry', async () => {
            mockSendProxyRequest.mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce({
                success: true,
                data: JSON.stringify({ access_token: 'tok' }),
            });
            const conn = mockConn({ id: 'err-cleanup', refreshToken: 'rt' });

            await refreshAccessToken(conn);
            const result = await refreshAccessToken(conn);

            expect(result.success).toBe(true);
            expect(mockSendProxyRequest).toHaveBeenCalledTimes(2);
        });

        it('uses connection loginDomain in request', async () => {
            mockSendProxyRequest.mockResolvedValue({
                success: true,
                data: JSON.stringify({ access_token: 'tok' }),
            });

            await refreshAccessToken(
                mockConn({
                    id: 'domain-test',
                    refreshToken: 'rt',
                    loginDomain: 'https://test.salesforce.com',
                })
            );

            expect(mockSendProxyRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: 'https://test.salesforce.com/services/oauth2/token',
                })
            );
        });
    });

    describe('updateConnectionToken', () => {
        it('updates token and lastUsedAt', async () => {
            const before = Date.now();
            chromeMock._setStorageData({
                connections: [createMockConnection({ id: 'c1', accessToken: 'old' })],
            });

            await updateConnectionToken('c1', 'new-token');

            const data = chromeMock._getStorageData();
            const connections = data.connections as Array<{
                accessToken: string;
                lastUsedAt: number;
            }>;
            expect(connections[0].accessToken).toBe('new-token');
            expect(connections[0].lastUsedAt).toBeGreaterThanOrEqual(before);
        });

        it('does nothing for non-existent connection', async () => {
            chromeMock._setStorageData({
                connections: [createMockConnection({ id: 'c1', accessToken: 'orig' })],
            });

            await updateConnectionToken('nonexistent', 'new');

            const data = chromeMock._getStorageData();
            const connections = data.connections as Array<{ accessToken: string }>;
            expect(connections[0].accessToken).toBe('orig');
        });
    });

    describe('clearAuthTokens', () => {
        it('removes legacy keys and broadcasts authExpired', async () => {
            chromeMock._setStorageData({
                accessToken: 'old',
                refreshToken: 'old',
                instanceUrl: 'https://old.sf.com',
                loginDomain: 'https://login.sf.com',
            });

            await clearAuthTokens();

            const data = chromeMock._getStorageData();
            expect(data.accessToken).toBeUndefined();
            expect(data.refreshToken).toBeUndefined();
            expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({ type: 'authExpired' });
        });

        it('handles sendMessage failure gracefully', async () => {
            chromeMock.runtime.sendMessage.mockRejectedValue(new Error('No receivers'));
            await expect(clearAuthTokens()).resolves.not.toThrow();
        });
    });
});
