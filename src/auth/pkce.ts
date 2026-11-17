// PKCE (RFC 7636) for the OAuth authorization code flow
// Salesforce requires PKCE for connected apps. Each authorization attempt gets a fresh
// random verifier; /authorize gets its S256 challenge and the token exchange sends the
// verifier, so an intercepted authorization code can't be redeemed by anyone else.

export interface PkcePair {
    codeVerifier: string;
    codeChallenge: string;
}

function base64Url(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** S256 code challenge: base64url(SHA-256(verifier)) */
export async function createCodeChallenge(codeVerifier: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
    return base64Url(new Uint8Array(digest));
}

/** Generate a verifier (43 chars from 32 random bytes) and its S256 challenge */
export async function generatePkcePair(): Promise<PkcePair> {
    const codeVerifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
    return { codeVerifier, codeChallenge: await createCodeChallenge(codeVerifier) };
}
