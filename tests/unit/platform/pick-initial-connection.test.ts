/**
 * Tests for pickInitialConnection (which org a new panel starts on)
 */
import { describe, it, expect } from 'vitest';
import { pickInitialConnection } from '../../../src/contexts/ConnectionContext';
import type { SalesforceConnection } from '../../../src/types/salesforce';

const conn = (id: string, extra: Partial<SalesforceConnection> = {}) =>
    ({
        id,
        label: id,
        instanceUrl: 'https://x',
        accessToken: 't',
        ...extra,
    }) as SalesforceConnection;

describe('pickInitialConnection', () => {
    it('returns null with no connections', () => {
        expect(pickInitialConnection([])).toBeNull();
    });

    it("starts on the sf CLI's default org", () => {
        const picked = pickInitialConnection([
            conn('a', { lastUsedAt: 10 }),
            conn('b', { isDefault: true, lastUsedAt: 1 }),
        ]);
        expect(picked?.id).toBe('b');
    });

    it('otherwise starts on the most recently used connection (Chrome)', () => {
        const picked = pickInitialConnection([
            conn('a', { lastUsedAt: 1 }),
            conn('b', { lastUsedAt: 5 }),
        ]);
        expect(picked?.id).toBe('b');
    });
});
