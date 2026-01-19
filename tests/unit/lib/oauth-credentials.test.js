/**
 * Tests for src/lib/oauth-credentials.js
 *
 * Test IDs: UT-U-007, UT-U-008
 * - UT-U-007: getOAuthCredentials() - Returns connection client ID
 * - UT-U-008: getOAuthCredentials() - Returns manifest default
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockConnection } from '../mocks/salesforce.js';
import { getOAuthCredentials } from '../../../src/lib/oauth-credentials.js';

describe('oauth-credentials', () => {
    describe('getOAuthCredentials', () => {
        it('returns manifest clientId when connectionId is null', async () => {
            const result = await getOAuthCredentials(null);

            expect(result.clientId).toBe('test-client-id');
            expect(result.isCustom).toBe(false);
        });

        it('returns manifest clientId when connectionId is undefined', async () => {
            const result = await getOAuthCredentials();

            expect(result.clientId).toBe('test-client-id');
            expect(result.isCustom).toBe(false);
        });

        it('returns manifest clientId when connection not found', async () => {
            chrome._setStorageData({
                connections: [createMockConnection({ id: 'conn-1' })]
            });

            const result = await getOAuthCredentials('non-existent-connection');

            expect(result.clientId).toBe('test-client-id');
            expect(result.isCustom).toBe(false);
        });

        it('returns manifest clientId when connection has no clientId', async () => {
            chrome._setStorageData({
                connections: [createMockConnection({ id: 'conn-1', clientId: null })]
            });

            const result = await getOAuthCredentials('conn-1');

            expect(result.clientId).toBe('test-client-id');
            expect(result.isCustom).toBe(false);
        });

        it('returns connection clientId when available', async () => {
            chrome._setStorageData({
                connections: [createMockConnection({ id: 'conn-1', clientId: 'custom-client-id' })]
            });

            const result = await getOAuthCredentials('conn-1');

            expect(result.clientId).toBe('custom-client-id');
            expect(result.isCustom).toBe(true);
        });

        it('handles empty connections array', async () => {
            chrome._setStorageData({ connections: [] });

            const result = await getOAuthCredentials('conn-1');

            expect(result.clientId).toBe('test-client-id');
            expect(result.isCustom).toBe(false);
        });

        it('handles missing connections in storage', async () => {
            chrome._setStorageData({});

            const result = await getOAuthCredentials('conn-1');

            expect(result.clientId).toBe('test-client-id');
            expect(result.isCustom).toBe(false);
        });

        it('finds correct connection among multiple connections', async () => {
            chrome._setStorageData({
                connections: [
                    createMockConnection({ id: 'conn-1', clientId: 'client-1' }),
                    createMockConnection({ id: 'conn-2', clientId: 'client-2' }),
                    createMockConnection({ id: 'conn-3', clientId: null })
                ]
            });

            const result = await getOAuthCredentials('conn-2');

            expect(result.clientId).toBe('client-2');
            expect(result.isCustom).toBe(true);
        });

        it('returns isCustom false for manifest default, true for connection clientId', async () => {
            chrome._setStorageData({
                connections: [createMockConnection({ id: 'custom-conn', clientId: 'custom-id' })]
            });

            const defaultResult = await getOAuthCredentials(null);
            expect(defaultResult.isCustom).toBe(false);

            const customResult = await getOAuthCredentials('custom-conn');
            expect(customResult.isCustom).toBe(true);
        });
    });
});
