import { describe, it, expect, beforeEach } from 'vitest';
import {
    createDpopProof,
    getTokenScheme,
    handleDpopNonce,
    normalizeTokenType,
    withDpopProof,
} from '../../../src/background/dpop';
import { setDpopKeyStore, dpopTargetUri } from '../../../src/background/dpop.testing';
import { createMemoryKeyStore, decodeProof, sha256Base64Url } from '../mocks/dpop';

describe('background/dpop', () => {
    let store: ReturnType<typeof createMemoryKeyStore>;

    beforeEach(() => {
        store = createMemoryKeyStore();
        setDpopKeyStore(store);
    });

    describe('createDpopProof', () => {
        it('signs an ES256 proof with the public key in the header', async () => {
            const proof = await createDpopProof({
                method: 'post',
                url: 'https://login.salesforce.com/services/oauth2/token',
            });
            const { header, payload, signatureValid } = await decodeProof(proof);

            expect(signatureValid).toBe(true);
            expect(header.typ).toBe('dpop+jwt');
            expect(header.alg).toBe('ES256');
            expect(header.jwk).toEqual({
                kty: 'EC',
                crv: 'P-256',
                x: expect.any(String),
                y: expect.any(String),
            });
            expect(payload).toMatchObject({
                htm: 'POST',
                htu: 'https://login.salesforce.com/services/oauth2/token',
                jti: expect.any(String),
                iat: expect.any(Number),
            });
            expect(payload.ath).toBeUndefined();
            expect(payload.nonce).toBeUndefined();
        });

        it('keeps the private key non-extractable', async () => {
            await createDpopProof({ method: 'GET', url: 'https://org.my.salesforce.com/x' });
            expect(store.saved?.privateKey.extractable).toBe(false);
        });

        it('reuses the stored key and uses a new jti for every proof', async () => {
            const a = await decodeProof(
                await createDpopProof({ method: 'GET', url: 'https://a.com/x' })
            );
            setDpopKeyStore(store); // forget the cached key, keep the store
            const b = await decodeProof(
                await createDpopProof({ method: 'GET', url: 'https://a.com/x' })
            );

            expect(b.header.jwk).toEqual(a.header.jwk);
            expect(b.payload.jti).not.toBe(a.payload.jti);
        });

        it('adds the access token hash for resource requests', async () => {
            const { payload } = await decodeProof(
                await createDpopProof({
                    method: 'GET',
                    url: 'https://org.my.salesforce.com/services/data/v62.0/query?q=SELECT+Id',
                    accessToken: '00D!token',
                })
            );

            expect(payload.ath).toBe(await sha256Base64Url('00D!token'));
            expect(payload.htu).toBe('https://org.my.salesforce.com/services/data/v62.0/query');
        });
    });

    describe('dpopTargetUri', () => {
        it('drops query and fragment', () => {
            expect(dpopTargetUri('https://x.com/a/b?c=1#d')).toBe('https://x.com/a/b');
        });
    });

    describe('handleDpopNonce', () => {
        it('asks for a retry on a token endpoint use_dpop_nonce error and uses the nonce', async () => {
            const retry = handleDpopNonce(
                'https://login.salesforce.com/services/oauth2/token',
                400,
                { 'DPoP-Nonce': 'n-1' },
                '{"error":"use_dpop_nonce"}'
            );
            expect(retry).toBe(true);

            const { payload } = await decodeProof(
                await createDpopProof({
                    method: 'POST',
                    url: 'https://login.salesforce.com/services/oauth2/token',
                })
            );
            expect(payload.nonce).toBe('n-1');
        });

        it('asks for a retry on a resource 401 challenge', () => {
            expect(
                handleDpopNonce('https://org.my.salesforce.com/x', 401, {
                    'www-authenticate': 'DPoP error="use_dpop_nonce"',
                    'dpop-nonce': 'n-2',
                })
            ).toBe(true);
        });

        it('stores a nonce from a success without asking for a retry', async () => {
            expect(handleDpopNonce('https://a.com/x', 200, { 'dpop-nonce': 'n-3' })).toBe(false);
            const { payload } = await decodeProof(
                await createDpopProof({ method: 'GET', url: 'https://a.com/y' })
            );
            expect(payload.nonce).toBe('n-3');
        });

        it('ignores a 401 that is not a nonce challenge', () => {
            expect(handleDpopNonce('https://a.com/x', 401, { 'dpop-nonce': 'n' })).toBe(false);
            expect(handleDpopNonce('https://a.com/x', 401, {})).toBe(false);
        });
    });

    describe('withDpopProof', () => {
        it('leaves Bearer requests unchanged', async () => {
            const headers = { Authorization: 'Bearer tok', Accept: 'application/json' };
            expect(await withDpopProof(headers, 'GET', 'https://a.com/x')).toBe(headers);
        });

        it('adds a proof bound to the DPoP token', async () => {
            const headers = await withDpopProof(
                { Authorization: 'DPoP tok' },
                'PATCH',
                'https://a.com/x'
            );
            const { payload } = await decodeProof(headers.DPoP);

            expect(headers.Authorization).toBe('DPoP tok');
            expect(payload).toMatchObject({ htm: 'PATCH', ath: await sha256Base64Url('tok') });
        });
    });

    it('getTokenScheme reads the Authorization scheme', () => {
        expect(getTokenScheme({ authorization: 'DPoP x' })).toBe('DPoP');
        expect(getTokenScheme({ Authorization: 'Bearer x' })).toBe('Bearer');
        expect(getTokenScheme({})).toBeNull();
    });

    it('normalizeTokenType maps token_type values', () => {
        expect(normalizeTokenType('DPoP')).toBe('DPoP');
        expect(normalizeTokenType('dpop')).toBe('DPoP');
        expect(normalizeTokenType('Bearer')).toBe('Bearer');
        expect(normalizeTokenType(undefined)).toBe('Bearer');
    });
});
