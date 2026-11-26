import { describe, it, expect } from 'vitest';
import { supportsStreaming } from '../../../src/lib/streaming-support';

describe('supportsStreaming', () => {
    it('is false for DPoP-bound connections', () => {
        expect(supportsStreaming({ tokenType: 'DPoP' })).toBe(false);
    });

    it('is true for Bearer connections', () => {
        expect(supportsStreaming({ tokenType: 'Bearer' })).toBe(true);
    });

    it('is true for connections made before DPoP (no token type)', () => {
        expect(supportsStreaming({})).toBe(true);
    });

    it('is true when there is no connection (other checks handle that)', () => {
        expect(supportsStreaming(null)).toBe(true);
        expect(supportsStreaming(undefined)).toBe(true);
    });
});
