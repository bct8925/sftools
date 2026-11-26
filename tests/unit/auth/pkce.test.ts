import { describe, it, expect } from 'vitest';
import { createCodeChallenge, generatePkcePair } from '../../../src/auth/pkce';

describe('auth/pkce', () => {
    it('matches the RFC 7636 appendix B example', async () => {
        expect(await createCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
            'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
        );
    });

    it('generates a 43-character base64url verifier with its S256 challenge', async () => {
        const { codeVerifier, codeChallenge } = await generatePkcePair();

        expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(codeChallenge).toBe(await createCodeChallenge(codeVerifier));
    });

    it('generates a new verifier each time', async () => {
        const a = await generatePkcePair();
        const b = await generatePkcePair();
        expect(a.codeVerifier).not.toBe(b.codeVerifier);
    });
});
