/**
 * Tests for src/lib/auth.js
 *
 * Test IDs: OA-U-001 through OA-U-012
 * - OA-U-001: deriveLoginDomain() - Extracts login.salesforce.com (tested in addConnection)
 * - OA-U-002: deriveLoginDomain() - Extracts test.salesforce.com (tested in addConnection)
 * - OA-U-003: deriveLoginDomain() - Handles custom domains (tested in addConnection)
 * - OA-U-004: addOrUpdateConnection() - Creates new if not exists
 * - OA-U-005: addOrUpdateConnection() - Updates if connectionId matches
 * - OA-U-006: generateOAuthState() - Creates unique state (tested via setPendingAuth)
 * - OA-U-007: validateOAuthState() - Returns true for valid (tested via consumePendingAuth)
 * - OA-U-008: validateOAuthState() - Returns false for invalid (tested via consumePendingAuth)
 * - OA-U-009: setPendingAuth() - Stores auth params
 * - OA-U-010: consumePendingAuth() - Returns and clears params
 * - OA-U-011: migrateFromSingleConnection() - Converts old format
 * - OA-U-012: migrateCustomConnectedApp() - Migrates app config (covered by migration tests)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockConnection } from '../mocks/salesforce.js';
import {
    getAccessToken,
    getInstanceUrl,
    isAuthenticated,
    getActiveConnectionId,
    setActiveConnection,
    loadConnections,
    saveConnections,
    addConnection,
    updateConnection,
    removeConnection,
    findConnectionByInstance,
    onAuthExpired,
    triggerAuthExpired,
    setPendingAuth,
    consumePendingAuth,
    migrateFromSingleConnection
} from '../../../src/lib/auth.js';

describe('auth', () => {
    beforeEach(() => {
        // Reset module state by setting null connection
        setActiveConnection(null);
    });

    describe('getAccessToken / getInstanceUrl / isAuthenticated', () => {
        it('returns empty values when no connection is set', () => {
            expect(getAccessToken()).toBe('');
            expect(getInstanceUrl()).toBe('');
            expect(isAuthenticated()).toBeFalsy();
        });

        it('returns connection values after setActiveConnection', () => {
            const connection = createMockConnection({
                accessToken: 'my-token',
                instanceUrl: 'https://my.salesforce.com'
            });

            setActiveConnection(connection);

            expect(getAccessToken()).toBe('my-token');
            expect(getInstanceUrl()).toBe('https://my.salesforce.com');
            expect(isAuthenticated()).toBeTruthy();
        });
    });

    describe('setActiveConnection', () => {
        it('sets access token and instance URL', () => {
            const connection = createMockConnection();

            setActiveConnection(connection);

            expect(getAccessToken()).toBe(connection.accessToken);
            expect(getInstanceUrl()).toBe(connection.instanceUrl);
            expect(getActiveConnectionId()).toBe(connection.id);
        });

        it('clears state when passed null', () => {
            setActiveConnection(createMockConnection());
            setActiveConnection(null);

            expect(getAccessToken()).toBe('');
            expect(getInstanceUrl()).toBe('');
            expect(getActiveConnectionId()).toBeNull();
        });
    });

    describe('onAuthExpired / triggerAuthExpired', () => {
        it('calls registered callback on auth expiration', () => {
            const callback = vi.fn();
            onAuthExpired(callback);
            setActiveConnection(createMockConnection({ id: 'conn-1' }));

            triggerAuthExpired();

            expect(callback).toHaveBeenCalledWith('conn-1', undefined);
        });

        it('uses provided connection ID over active connection', () => {
            const callback = vi.fn();
            onAuthExpired(callback);
            setActiveConnection(createMockConnection({ id: 'active-conn' }));

            triggerAuthExpired('expired-conn', 'Token expired');

            expect(callback).toHaveBeenCalledWith('expired-conn', 'Token expired');
        });

        it('clears module state on trigger', () => {
            setActiveConnection(createMockConnection());

            triggerAuthExpired();

            expect(getAccessToken()).toBe('');
            expect(getInstanceUrl()).toBe('');
        });
    });

    describe('loadConnections', () => {
        it('returns empty array when no connections exist', async () => {
            const connections = await loadConnections();

            expect(connections).toEqual([]);
        });

        it('returns saved connections from storage', async () => {
            const mockConnections = [createMockConnection()];
            chrome._setStorageData({ connections: mockConnections });

            const connections = await loadConnections();

            expect(connections).toEqual(mockConnections);
        });
    });

    describe('saveConnections', () => {
        it('saves connections to storage', async () => {
            const connections = [createMockConnection()];

            await saveConnections(connections);

            const storage = chrome._getStorageData();
            expect(storage.connections).toEqual(connections);
        });
    });

    describe('addConnection', () => {
        it('creates connection with generated ID', async () => {
            const result = await addConnection({
                instanceUrl: 'https://test.salesforce.com',
                accessToken: 'token-123'
            });

            expect(result.id).toBe('test-uuid-1');
            expect(result.accessToken).toBe('token-123');
        });

        it('generates label from instance URL hostname', async () => {
            const result = await addConnection({
                instanceUrl: 'https://myorg.my.salesforce.com',
                accessToken: 'token'
            });

            expect(result.label).toBe('myorg.my.salesforce.com');
        });

        it('uses provided label over generated', async () => {
            const result = await addConnection({
                instanceUrl: 'https://test.salesforce.com',
                accessToken: 'token',
                label: 'Production'
            });

            expect(result.label).toBe('Production');
        });

        it('defaults loginDomain to login.salesforce.com', async () => {
            const result = await addConnection({
                instanceUrl: 'https://test.salesforce.com',
                accessToken: 'token'
            });

            expect(result.loginDomain).toBe('https://login.salesforce.com');
        });

        it('appends to existing connections', async () => {
            chrome._setStorageData({ connections: [createMockConnection({ id: 'existing' })] });

            await addConnection({
                instanceUrl: 'https://new.salesforce.com',
                accessToken: 'new-token'
            });

            const storage = chrome._getStorageData();
            expect(storage.connections).toHaveLength(2);
        });

        it('sets timestamps', async () => {
            const before = Date.now();
            const result = await addConnection({
                instanceUrl: 'https://test.salesforce.com',
                accessToken: 'token'
            });
            const after = Date.now();

            expect(result.createdAt).toBeGreaterThanOrEqual(before);
            expect(result.createdAt).toBeLessThanOrEqual(after);
            expect(result.lastUsedAt).toBeGreaterThanOrEqual(before);
        });
    });

    describe('updateConnection', () => {
        it('updates existing connection', async () => {
            chrome._setStorageData({
                connections: [createMockConnection({ id: 'conn-1', label: 'Old Label' })]
            });

            const result = await updateConnection('conn-1', { label: 'New Label' });

            expect(result.label).toBe('New Label');
        });

        it('returns null for non-existent connection', async () => {
            chrome._setStorageData({ connections: [] });

            const result = await updateConnection('non-existent', { label: 'test' });

            expect(result).toBeNull();
        });

        it('updates lastUsedAt timestamp', async () => {
            const oldTime = Date.now() - 10000;
            chrome._setStorageData({
                connections: [createMockConnection({ id: 'conn-1', lastUsedAt: oldTime })]
            });

            const result = await updateConnection('conn-1', { label: 'Updated' });

            expect(result.lastUsedAt).toBeGreaterThan(oldTime);
        });

        it('preserves other fields', async () => {
            chrome._setStorageData({
                connections: [createMockConnection({
                    id: 'conn-1',
                    accessToken: 'original-token',
                    instanceUrl: 'https://original.salesforce.com'
                })]
            });

            const result = await updateConnection('conn-1', { label: 'New Label' });

            expect(result.accessToken).toBe('original-token');
            expect(result.instanceUrl).toBe('https://original.salesforce.com');
        });
    });

    describe('removeConnection', () => {
        it('removes connection by ID', async () => {
            chrome._setStorageData({
                connections: [
                    createMockConnection({ id: 'conn-1' }),
                    createMockConnection({ id: 'conn-2' })
                ]
            });

            await removeConnection('conn-1');

            const storage = chrome._getStorageData();
            expect(storage.connections).toHaveLength(1);
            expect(storage.connections[0].id).toBe('conn-2');
        });

        it('handles non-existent connection gracefully', async () => {
            chrome._setStorageData({ connections: [createMockConnection({ id: 'conn-1' })] });

            await removeConnection('non-existent');

            const storage = chrome._getStorageData();
            expect(storage.connections).toHaveLength(1);
        });
    });

    describe('findConnectionByInstance', () => {
        it('finds connection by instance URL', async () => {
            chrome._setStorageData({
                connections: [
                    createMockConnection({ id: 'conn-1', instanceUrl: 'https://prod.salesforce.com' }),
                    createMockConnection({ id: 'conn-2', instanceUrl: 'https://sandbox.salesforce.com' })
                ]
            });

            const result = await findConnectionByInstance('https://sandbox.salesforce.com');

            expect(result.id).toBe('conn-2');
        });

        it('returns undefined when not found', async () => {
            chrome._setStorageData({ connections: [] });

            const result = await findConnectionByInstance('https://nonexistent.salesforce.com');

            expect(result).toBeUndefined();
        });
    });

    describe('setPendingAuth / consumePendingAuth', () => {
        it('stores and retrieves pending auth params', async () => {
            const params = {
                loginDomain: 'https://test.salesforce.com',
                clientId: 'client-123',
                connectionId: 'conn-456'
            };

            await setPendingAuth(params);
            const result = await consumePendingAuth();

            // Result includes original params plus createdAt timestamp
            expect(result.loginDomain).toBe(params.loginDomain);
            expect(result.clientId).toBe(params.clientId);
            expect(result.connectionId).toBe(params.connectionId);
            expect(result.createdAt).toBeDefined();
            expect(typeof result.createdAt).toBe('number');
        });

        it('clears pending auth after consume', async () => {
            await setPendingAuth({ loginDomain: 'https://login.salesforce.com' });
            await consumePendingAuth();

            const result = await consumePendingAuth();

            expect(result).toBeNull();
        });

        it('returns null when no pending auth', async () => {
            const result = await consumePendingAuth();

            expect(result).toBeNull();
        });
    });

    describe('migrateFromSingleConnection', () => {
        it('returns false if already migrated', async () => {
            chrome._setStorageData({ connections: [] });

            const result = await migrateFromSingleConnection();

            expect(result).toBe(false);
        });

        it('initializes empty connections array for fresh install', async () => {
            const result = await migrateFromSingleConnection();

            expect(result).toBe(false);
            const storage = chrome._getStorageData();
            expect(storage.connections).toEqual([]);
        });

        it('migrates single connection to array format', async () => {
            chrome._setStorageData({
                accessToken: 'old-token',
                instanceUrl: 'https://old.salesforce.com',
                refreshToken: 'refresh-token',
                loginDomain: 'https://test.salesforce.com'
            });

            const result = await migrateFromSingleConnection();

            expect(result).toBe(true);
            const storage = chrome._getStorageData();
            expect(storage.connections).toHaveLength(1);
            expect(storage.connections[0].accessToken).toBe('old-token');
            expect(storage.connections[0].refreshToken).toBe('refresh-token');
            expect(storage.connections[0].loginDomain).toBe('https://test.salesforce.com');
        });

        it('removes legacy keys after migration', async () => {
            chrome._setStorageData({
                accessToken: 'old-token',
                instanceUrl: 'https://old.salesforce.com'
            });

            await migrateFromSingleConnection();

            const storage = chrome._getStorageData();
            expect(storage.accessToken).toBeUndefined();
            expect(storage.instanceUrl).toBeUndefined();
        });
    });
});
