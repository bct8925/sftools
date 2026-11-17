import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chromeMock } from '../mocks/chrome';

Object.assign(globalThis, { chrome: chromeMock });

// Mock dependencies
vi.mock('../../../src/lib/app-utils', () => ({
    detectLoginDomain: vi.fn(),
    buildOAuthUrl: vi
        .fn()
        .mockReturnValue('https://login.salesforce.com/services/oauth2/authorize?mock'),
}));

vi.mock('../../../src/auth/auth', () => ({
    setPendingAuth: vi.fn().mockResolvedValue(undefined),
    generateOAuthState: vi.fn().mockReturnValue('mock-state-123'),
    getOAuthCredentials: vi
        .fn()
        .mockResolvedValue({ clientId: 'default-client-id', isCustom: false }),
    CALLBACK_URL: 'https://extension-id/callback',
}));

import { startAuthorization } from '../../../src/auth/start-authorization';
import { detectLoginDomain, buildOAuthUrl } from '../../../src/lib/app-utils';
import { setPendingAuth, generateOAuthState, getOAuthCredentials } from '../../../src/auth/auth';
import { createCodeChallenge } from '../../../src/auth/pkce';

describe('startAuthorization', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        chromeMock._reset();
    });

    describe('domain detection', () => {
        it('uses override domain when provided', async () => {
            await startAuthorization('https://test.salesforce.com', null, null);

            expect(vi.mocked(buildOAuthUrl).mock.calls[0].slice(0, 5)).toEqual([
                'https://test.salesforce.com',
                expect.any(String),
                expect.any(String),
                expect.any(String),
                expect.any(Boolean),
            ]);
            expect(detectLoginDomain).not.toHaveBeenCalled();
        });

        it('detects domain from current tab when no override', async () => {
            chromeMock.tabs.query.mockResolvedValue([
                { url: 'https://myorg.my.salesforce.com/page' },
            ]);
            vi.mocked(detectLoginDomain).mockReturnValue('https://myorg.my.salesforce.com');

            await startAuthorization(null, null, null);

            expect(detectLoginDomain).toHaveBeenCalledWith('https://myorg.my.salesforce.com/page');
            expect(vi.mocked(buildOAuthUrl).mock.calls[0].slice(0, 5)).toEqual([
                'https://myorg.my.salesforce.com',
                expect.any(String),
                expect.any(String),
                expect.any(String),
                expect.any(Boolean),
            ]);
        });

        it('falls back to login.salesforce.com when tab has no URL', async () => {
            chromeMock.tabs.query.mockResolvedValue([{ url: undefined }]);

            await startAuthorization(null, null, null);

            expect(vi.mocked(buildOAuthUrl).mock.calls[0].slice(0, 5)).toEqual([
                'https://login.salesforce.com',
                expect.any(String),
                expect.any(String),
                expect.any(String),
                expect.any(Boolean),
            ]);
        });

        it('falls back to login.salesforce.com when tab query fails', async () => {
            chromeMock.tabs.query.mockRejectedValue(new Error('No tabs'));

            await startAuthorization(null, null, null);

            expect(vi.mocked(buildOAuthUrl).mock.calls[0].slice(0, 5)).toEqual([
                'https://login.salesforce.com',
                expect.any(String),
                expect.any(String),
                expect.any(String),
                expect.any(Boolean),
            ]);
        });

        it('falls back when detectLoginDomain returns null', async () => {
            chromeMock.tabs.query.mockResolvedValue([{ url: 'https://google.com' }]);
            vi.mocked(detectLoginDomain).mockReturnValue(null as unknown as string);

            await startAuthorization(null, null, null);

            expect(vi.mocked(buildOAuthUrl).mock.calls[0].slice(0, 5)).toEqual([
                'https://login.salesforce.com',
                expect.any(String),
                expect.any(String),
                expect.any(String),
                expect.any(Boolean),
            ]);
        });
    });

    describe('flow selection', () => {
        it('uses code flow when proxy is connected', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ connected: true });

            await startAuthorization('https://login.salesforce.com', null, null);

            expect(buildOAuthUrl).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                expect.any(String),
                expect.any(String),
                true,
                expect.any(String) // PKCE code challenge
            );
        });

        it('uses implicit flow when proxy is not connected', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ connected: false });

            await startAuthorization('https://login.salesforce.com', null, null);

            expect(buildOAuthUrl).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                expect.any(String),
                expect.any(String),
                false,
                undefined
            );
        });

        it('uses implicit flow when proxy check fails', async () => {
            chromeMock.runtime.sendMessage.mockRejectedValue(new Error('No proxy'));

            await startAuthorization('https://login.salesforce.com', null, null);

            expect(buildOAuthUrl).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                expect.any(String),
                expect.any(String),
                false,
                undefined
            );
        });
    });

    describe('client ID', () => {
        it('uses override client ID when provided', async () => {
            await startAuthorization('https://login.salesforce.com', 'custom-id', null);

            expect(vi.mocked(buildOAuthUrl).mock.calls[0].slice(0, 5)).toEqual([
                expect.any(String),
                'custom-id',
                expect.any(String),
                expect.any(String),
                expect.any(Boolean),
            ]);
            expect(getOAuthCredentials).not.toHaveBeenCalled();
        });

        it('falls back to default client ID when no override', async () => {
            await startAuthorization('https://login.salesforce.com', null, null);

            expect(getOAuthCredentials).toHaveBeenCalled();
            expect(vi.mocked(buildOAuthUrl).mock.calls[0].slice(0, 5)).toEqual([
                expect.any(String),
                'default-client-id',
                expect.any(String),
                expect.any(String),
                expect.any(Boolean),
            ]);
        });
    });

    describe('state and pending auth', () => {
        it('generates state and stores pending auth', async () => {
            await startAuthorization('https://test.salesforce.com', 'cid', 'conn-1');

            expect(generateOAuthState).toHaveBeenCalled();
            expect(setPendingAuth).toHaveBeenCalledWith({
                loginDomain: 'https://test.salesforce.com',
                clientId: 'cid',
                connectionId: 'conn-1',
                state: 'mock-state-123',
                codeVerifier: null,
            });
        });

        it('stores null clientId when no override', async () => {
            await startAuthorization('https://login.salesforce.com', null, null);

            expect(setPendingAuth).toHaveBeenCalledWith(
                expect.objectContaining({ clientId: null, connectionId: null })
            );
        });
    });

    describe('tab creation', () => {
        it('opens OAuth URL in new tab', async () => {
            await startAuthorization('https://login.salesforce.com', null, null);

            expect(chromeMock.tabs.create).toHaveBeenCalledWith({
                url: 'https://login.salesforce.com/services/oauth2/authorize?mock',
            });
        });
    });

    describe('PKCE', () => {
        it('stores the verifier and sends its challenge in the code flow', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ connected: true });

            await startAuthorization('https://login.salesforce.com', null, null);

            const { codeVerifier } = vi.mocked(setPendingAuth).mock.calls[0][0];
            const challenge = vi.mocked(buildOAuthUrl).mock.calls[0][5];
            expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
            expect(challenge).toBe(await createCodeChallenge(codeVerifier!));
        });

        it('uses the code flow without the proxy once Salesforce site access is granted', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ connected: false });
            chromeMock.permissions.request.mockResolvedValue(true);

            await startAuthorization('https://login.salesforce.com', null, null);

            expect(chromeMock.permissions.request).toHaveBeenCalled();
            expect(vi.mocked(buildOAuthUrl).mock.calls[0][4]).toBe(true);
            expect(vi.mocked(setPendingAuth).mock.calls[0][0].codeVerifier).toMatch(
                /^[A-Za-z0-9_-]{43}$/
            );
        });

        it('does not ask for site access when the proxy is connected', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ connected: true });

            await startAuthorization('https://login.salesforce.com', null, null);

            expect(chromeMock.permissions.request).not.toHaveBeenCalled();
            expect(chromeMock.permissions.contains).not.toHaveBeenCalled();
        });

        it('falls back to the implicit flow when site access is declined', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ connected: false });
            chromeMock.permissions.request.mockResolvedValue(false);

            await startAuthorization('https://login.salesforce.com', null, null);

            expect(vi.mocked(buildOAuthUrl).mock.calls[0][4]).toBe(false);
        });

        it('stores no verifier in the implicit flow', async () => {
            chromeMock.runtime.sendMessage.mockResolvedValue({ connected: false });

            await startAuthorization('https://login.salesforce.com', null, null);

            expect(vi.mocked(setPendingAuth).mock.calls[0][0].codeVerifier).toBeNull();
            expect(vi.mocked(buildOAuthUrl).mock.calls[0][5]).toBeUndefined();
        });
    });
});
