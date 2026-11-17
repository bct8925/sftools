// In-memory DPoP key store (jsdom has no IndexedDB)
import type { DpopKeyStore } from '../../../src/background/dpop.testing';

export function createMemoryKeyStore(): DpopKeyStore & { saved: CryptoKeyPair | null } {
    const store = {
        saved: null as CryptoKeyPair | null,
        load: () => Promise.resolve(store.saved),
        save: (keyPair: CryptoKeyPair) => {
            store.saved = keyPair;
            return Promise.resolve();
        },
    };
    return store;
}

function fromBase64Url(value: string): Uint8Array {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    return Uint8Array.from(binary, c => c.charCodeAt(0));
}

export interface DecodedProof {
    header: { typ: string; alg: string; jwk: JsonWebKey };
    payload: Record<string, unknown>;
    signatureValid: boolean;
}

/** Decode a DPoP proof and verify its signature with the embedded public key */
export async function decodeProof(proof: string): Promise<DecodedProof> {
    const [h, p, sig] = proof.split('.');
    const header = JSON.parse(new TextDecoder().decode(fromBase64Url(h)));
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(p)));
    const key = await crypto.subtle.importKey(
        'jwk',
        header.jwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
    );
    const signatureValid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        fromBase64Url(sig),
        new TextEncoder().encode(`${h}.${p}`)
    );
    return { header, payload, signatureValid };
}

/** base64url(SHA-256(value)), the DPoP ath claim */
export async function sha256Base64Url(value: string): Promise<string> {
    const digest = new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
    );
    return btoa(String.fromCharCode(...digest))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}
