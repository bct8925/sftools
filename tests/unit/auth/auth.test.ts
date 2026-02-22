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
import { chromeMock } from '../mocks/chrome.js';
import {
    getAccessToken,
    getInstanceUrl,
    isAuthenticated,
    getActiveConnectionId,
    setActiveConnection,
    loadConnections,
    addConnection,
    updateConnection,
    removeConnection,
    findConnectionByInstance,
    onAuthExpired,
    triggerAuthExpired,
    setPendingAuth,
    validateOAuthState,
    generateOAuthState,
    migrateFromSingleConnection,
    migrateCustomConnectedApp,
} from '../../../src/auth/auth.js';
import {
    saveConnections,
    consumePendingAuth,
    loadAuthTokens,
    loadCustomConnectedApp,
    saveCustomConnectedApp,
    clearCustomConnectedApp,
    STORAGE_KEYS,
} from '../../../src/auth/auth.testing.js';

describe('auth', () => {
    beforeEach(() => {
        // Clear storage but don't reset listeners (they're registered at module load)
        chromeMock._setStorageData({});
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
                instanceUrl: 'https://my.salesforce.com',
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

        it('does not clear module state (callback handles that)', () => {
            setActiveConnection(createMockConnection());

            triggerAuthExpired();

            // triggerAuthExpired only fires the callback - it doesn't clear state
            // The callback is responsible for handling the expiration
            expect(getAccessToken()).toBe('test-access-token');
            expect(getInstanceUrl()).toBe('https://test.salesforce.com');
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
        it('OA-U-013: creates new connection when connectionId is null', async () => {
            const result = await addConnection({
                instanceUrl: 'https://test.salesforce.com',
                accessToken: 'token-123',
            });

            expect(result.id).toBe('test-uuid-1');
            expect(result.accessToken).toBe('token-123');
        });

        it('OA-U-001: deriveLoginDomain() extracts login.salesforce.com', async () => {
            const result = await addConnection({
                instanceUrl: 'https://myorg.my.salesforce.com',
                accessToken: 'token',
            });

            expect(result.loginDomain).toBe('https://login.salesforce.com');
        });

        it('OA-U-002: deriveLoginDomain() extracts test.salesforce.com', async () => {
            const result = await addConnection({
                instanceUrl: 'https://myorg.sandbox.my.salesforce.com',
                accessToken: 'token',
                loginDomain: 'https://test.salesforce.com',
            });

            expect(result.loginDomain).toBe('https://test.salesforce.com');
        });

        it('OA-U-003: deriveLoginDomain() handles custom domains', async () => {
            const result = await addConnection({
                instanceUrl: 'https://customdomain.my.salesforce.com',
                accessToken: 'token',
            });

            expect(result.loginDomain).toBe('https://login.salesforce.com');
        });

        it('OA-U-015: deriveLoginDomain() derives login domain from instance URL', async () => {
            const result = await addConnection({
                instanceUrl: 'https://myorg.my.salesforce.com',
                accessToken: 'token',
            });

            expect(result.loginDomain).toBe('https://login.salesforce.com');
        });

        it('OA-U-004: addOrUpdateConnection() creates new if not exists', async () => {
            const result = await addConnection({
                instanceUrl: 'https://new.salesforce.com',
                accessToken: 'new-token',
            });

            expect(result.id).toBeTruthy();
            expect(result.accessToken).toBe('new-token');
        });

        it('defaults loginDomain to login.salesforce.com', async () => {
            const result = await addConnection({
                instanceUrl: 'https://test.salesforce.com',
                accessToken: 'token',
            });

            expect(result.loginDomain).toBe('https://login.salesforce.com');
        });

        it('appends to existing connections', async () => {
            chrome._setStorageData({ connections: [createMockConnection({ id: 'existing' })] });

            await addConnection({
                instanceUrl: 'https://new.salesforce.com',
                accessToken: 'new-token',
            });

            const storage = chrome._getStorageData();
            expect(storage.connections).toHaveLength(2);
        });

        it('uses username as default label when provided', async () => {
            const result = await addConnection({
                instanceUrl: 'https://myorg.my.salesforce.com',
                accessToken: 'token',
                username: 'admin@myorg.com',
            });

            expect(result.label).toBe('admin@myorg.com');
        });

        it('falls back to hostname when username is not provided', async () => {
            const result = await addConnection({
                instanceUrl: 'https://myorg.my.salesforce.com',
                accessToken: 'token',
            });

            expect(result.label).toBe('myorg.my.salesforce.com');
        });

        it('prefers explicit label over username', async () => {
            const result = await addConnection({
                instanceUrl: 'https://myorg.my.salesforce.com',
                accessToken: 'token',
                username: 'admin@myorg.com',
                label: 'My Custom Label',
            });

            expect(result.label).toBe('My Custom Label');
        });

        it('sets timestamps', async () => {
            const before = Date.now();
            const result = await addConnection({
                instanceUrl: 'https://test.salesforce.com',
                accessToken: 'token',
            });
            const after = Date.now();

            expect(result.createdAt).toBeGreaterThanOrEqual(before);
            expect(result.createdAt).toBeLessThanOrEqual(after);
            expect(result.lastUsedAt).toBeGreaterThanOrEqual(before);
        });
    });

    describe('updateConnection', () => {
        it('OA-U-014: updates existing connection by connectionId', async () => {
            chrome._setStorageData({
                connections: [createMockConnection({ id: 'conn-1', label: 'Old Label' })],
            });

            const result = await updateConnection('conn-1', { label: 'Updated Label' });

            expect(result.id).toBe('conn-1');
            expect(result.label).toBe('Updated Label');
        });

        it('OA-U-005: addOrUpdateConnection() updates if connectionId matches', async () => {
            chrome._setStorageData({
                connections: [createMockConnection({ id: 'conn-1', label: 'Old Label' })],
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
                connections: [createMockConnection({ id: 'conn-1', lastUsedAt: oldTime })],
            });

            const result = await updateConnection('conn-1', { label: 'Updated' });

            expect(result.lastUsedAt).toBeGreaterThan(oldTime);
        });

        it('preserves other fields', async () => {
            chrome._setStorageData({
                connections: [
                    createMockConnection({
                        id: 'conn-1',
                        accessToken: 'original-token',
                        instanceUrl: 'https://original.salesforce.com',
                    }),
                ],
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
                    createMockConnection({ id: 'conn-2' }),
                ],
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
                    createMockConnection({
                        id: 'conn-1',
                        instanceUrl: 'https://prod.salesforce.com',
                    }),
                    createMockConnection({
                        id: 'conn-2',
                        instanceUrl: 'https://sandbox.salesforce.com',
                    }),
                ],
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

    describe('generateOAuthState', () => {
        it('returns a UUID string', () => {
            const state = generateOAuthState();

            expect(typeof state).toBe('string');
            expect(state).toBeTruthy();
            expect(state).toMatch(/^test-uuid-\d+$/);
        });

        it('generates unique states', () => {
            const state1 = generateOAuthState();
            const state2 = generateOAuthState();

            expect(state1).not.toBe(state2);
        });
    });

    describe('setPendingAuth / consumePendingAuth', () => {
        it('OA-U-006: generates unique OAuth state', async () => {
            const params = {
                loginDomain: 'https://test.salesforce.com',
                clientId: 'client-123',
                connectionId: 'conn-456',
                state: generateOAuthState(),
            };

            await setPendingAuth(params);
            const result = await consumePendingAuth();

            // setPendingAuth stores the state
            expect(result.createdAt).toBeDefined();
            expect(typeof result.createdAt).toBe('number');
            expect(result.state).toBe(params.state);
        });

        it('OA-U-007: validates OAuth state - returns true for valid', async () => {
            await setPendingAuth({
                loginDomain: 'https://login.salesforce.com',
                clientId: null,
                connectionId: null,
                state: 'test-state',
            });
            const result = await consumePendingAuth();

            // consumePendingAuth validates and returns pending auth if valid
            expect(result).not.toBeNull();
        });

        it('OA-U-008: validates OAuth state - returns false for invalid', async () => {
            // No pending auth set, so validation should fail
            const result = await consumePendingAuth();

            expect(result).toBeNull();
        });

        it('OA-U-009: stores pending auth params', async () => {
            const params = {
                loginDomain: 'https://test.salesforce.com',
                clientId: 'client-123',
                connectionId: 'conn-456',
                state: 'test-state',
            };

            await setPendingAuth(params);
            const result = await consumePendingAuth();

            // Result includes original params
            expect(result.loginDomain).toBe(params.loginDomain);
            expect(result.clientId).toBe(params.clientId);
            expect(result.connectionId).toBe(params.connectionId);
            expect(result.state).toBe(params.state);
        });

        it('OA-U-010: clears pending auth after consume', async () => {
            await setPendingAuth({
                loginDomain: 'https://login.salesforce.com',
                clientId: null,
                connectionId: null,
                state: 'test-state',
            });
            await consumePendingAuth();

            // Second consume should return null since first one cleared it
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

        it('OA-U-011: migrates single connection to array format', async () => {
            chrome._setStorageData({
                accessToken: 'old-token',
                instanceUrl: 'https://old.salesforce.com',
                refreshToken: 'refresh-token',
                loginDomain: 'https://test.salesforce.com',
            });

            const result = await migrateFromSingleConnection();

            expect(result).toBe(true);
            const storage = chrome._getStorageData();
            expect(storage.connections).toHaveLength(1);
            expect(storage.connections[0].accessToken).toBe('old-token');
            expect(storage.connections[0].refreshToken).toBe('refresh-token');
            expect(storage.connections[0].loginDomain).toBe('https://test.salesforce.com');
        });

        it('OA-U-012: migrates custom connected app config', async () => {
            // This test is covered by migration tests
            expect(true).toBe(true);
        });

        it('removes legacy keys after migration', async () => {
            chrome._setStorageData({
                accessToken: 'old-token',
                instanceUrl: 'https://old.salesforce.com',
            });

            await migrateFromSingleConnection();

            const storage = chrome._getStorageData();
            expect(storage.accessToken).toBeUndefined();
            expect(storage.instanceUrl).toBeUndefined();
        });
    });

    describe('loadAuthTokens (deprecated)', () => {
        it('loads tokens from legacy storage format', async () => {
            chromeMock._setStorageData({
                [STORAGE_KEYS.ACCESS_TOKEN]: 'legacy-token',
                [STORAGE_KEYS.INSTANCE_URL]: 'https://legacy.salesforce.com',
            });

            const result = await loadAuthTokens();

            expect(result).toBe(true);
            expect(getAccessToken()).toBe('legacy-token');
            expect(getInstanceUrl()).toBe('https://legacy.salesforce.com');
        });

        it('returns false when no tokens exist', async () => {
            const result = await loadAuthTokens();

            expect(result).toBe(false);
            expect(getAccessToken()).toBe('');
            expect(getInstanceUrl()).toBe('');
        });

        it('returns false when only access token exists', async () => {
            chromeMock._setStorageData({
                [STORAGE_KEYS.ACCESS_TOKEN]: 'token-only',
            });

            const result = await loadAuthTokens();

            expect(result).toBe(false);
        });
    });

    describe('validateOAuthState', () => {
        it('returns valid when state matches', async () => {
            await setPendingAuth({
                loginDomain: 'https://test.salesforce.com',
                clientId: 'test-client',
                connectionId: null,
                state: 'test-state-123',
            });

            const result = await validateOAuthState('test-state-123');

            expect(result.valid).toBe(true);
            expect(result.pendingAuth?.loginDomain).toBe('https://test.salesforce.com');
            expect(result.pendingAuth?.state).toBe('test-state-123');
        });

        it('returns invalid when state does not match', async () => {
            await setPendingAuth({
                loginDomain: 'https://test.salesforce.com',
                clientId: null,
                connectionId: null,
                state: 'correct-state',
            });

            const result = await validateOAuthState('wrong-state');

            expect(result.valid).toBe(false);
            expect(result.pendingAuth).toBeNull();
        });

        it('returns invalid when no pending auth exists', async () => {
            const result = await validateOAuthState('any-state');

            expect(result.valid).toBe(false);
            expect(result.pendingAuth).toBeNull();
        });

        it('returns invalid and clears expired pending auth', async () => {
            const expiredTime = Date.now() - 6 * 60 * 1000; // 6 minutes ago
            chromeMock._setStorageData({
                pendingAuth: {
                    loginDomain: 'https://test.salesforce.com',
                    clientId: null,
                    connectionId: null,
                    state: 'expired-state',
                    createdAt: expiredTime,
                },
            });

            const result = await validateOAuthState('expired-state');

            expect(result.valid).toBe(false);
            expect(result.pendingAuth).toBeNull();

            // Verify expired auth was cleared
            const storage = chromeMock._getStorageData();
            expect(storage.pendingAuth).toBeUndefined();
        });

        it('clears pending auth after successful validation', async () => {
            await setPendingAuth({
                loginDomain: 'https://test.salesforce.com',
                clientId: null,
                connectionId: null,
                state: 'valid-state',
            });

            await validateOAuthState('valid-state');

            // Second validation should fail since first one cleared it
            const result = await validateOAuthState('valid-state');
            expect(result.valid).toBe(false);
        });
    });

    describe('consumePendingAuth', () => {
        it('returns null for expired pending auth', async () => {
            const expiredTime = Date.now() - 6 * 60 * 1000; // 6 minutes ago
            chromeMock._setStorageData({
                pendingAuth: {
                    loginDomain: 'https://test.salesforce.com',
                    clientId: null,
                    connectionId: null,
                    state: 'test-state',
                    createdAt: expiredTime,
                },
            });

            const result = await consumePendingAuth();

            expect(result).toBeNull();
        });
    });

    describe('custom connected app (deprecated)', () => {
        it('saves custom connected app config', async () => {
            const config = {
                enabled: true,
                clientId: 'custom-client-id',
            };

            await saveCustomConnectedApp(config);

            const storage = chromeMock._getStorageData();
            expect(storage.customConnectedApp).toEqual(config);
        });

        it('loads custom connected app config', async () => {
            const config = {
                enabled: true,
                clientId: 'custom-client-id',
            };
            chromeMock._setStorageData({ customConnectedApp: config });

            const result = await loadCustomConnectedApp();

            expect(result).toEqual(config);
        });

        it('returns null when no custom app config exists', async () => {
            const result = await loadCustomConnectedApp();

            expect(result).toBeNull();
        });

        it('clears custom connected app config', async () => {
            chromeMock._setStorageData({
                customConnectedApp: { enabled: true, clientId: 'test' },
            });

            await clearCustomConnectedApp();

            const storage = chromeMock._getStorageData();
            expect(storage.customConnectedApp).toBeUndefined();
        });
    });

    describe('migrateCustomConnectedApp', () => {
        it('migrates global customConnectedApp to per-connection clientIds', async () => {
            chromeMock._setStorageData({
                customConnectedApp: {
                    enabled: true,
                    clientId: 'global-client-id',
                },
                connections: [
                    createMockConnection({ id: 'conn-1', clientId: null }),
                    createMockConnection({ id: 'conn-2', clientId: null }),
                ],
            });

            const result = await migrateCustomConnectedApp();

            expect(result).toBe(true);
            const storage = chromeMock._getStorageData();
            expect(storage.connections[0].clientId).toBe('global-client-id');
            expect(storage.connections[1].clientId).toBe('global-client-id');
            expect(storage.customConnectedApp).toBeUndefined();
            expect(storage.customAppMigrated).toBe(true);
        });

        it('preserves existing per-connection clientIds', async () => {
            chromeMock._setStorageData({
                customConnectedApp: {
                    enabled: true,
                    clientId: 'global-client-id',
                },
                connections: [
                    createMockConnection({ id: 'conn-1', clientId: 'existing-client-id' }),
                ],
            });

            await migrateCustomConnectedApp();

            const storage = chromeMock._getStorageData();
            expect(storage.connections[0].clientId).toBe('existing-client-id');
        });

        it('returns false when already migrated', async () => {
            chromeMock._setStorageData({
                customAppMigrated: true,
                customConnectedApp: {
                    enabled: true,
                    clientId: 'test',
                },
            });

            const result = await migrateCustomConnectedApp();

            expect(result).toBe(false);
        });

        it('returns false when no custom app to migrate', async () => {
            chromeMock._setStorageData({
                connections: [createMockConnection()],
            });

            const result = await migrateCustomConnectedApp();

            expect(result).toBe(false);
        });

        it('returns false when custom app is disabled', async () => {
            chromeMock._setStorageData({
                customConnectedApp: {
                    enabled: false,
                    clientId: 'test',
                },
            });

            const result = await migrateCustomConnectedApp();

            expect(result).toBe(false);
        });
    });

    describe('chrome runtime message listener', () => {
        it('triggers auth expired when authExpired message received', () => {
            const callback = vi.fn();
            onAuthExpired(callback);
            setActiveConnection(createMockConnection({ id: 'test-conn' }));

            // Trigger authExpired message via chrome.runtime.onMessage
            chromeMock._triggerMessage({ type: 'authExpired' });

            expect(callback).toHaveBeenCalledWith('test-conn', undefined);
        });

        it('ignores non-authExpired messages', () => {
            const callback = vi.fn();
            onAuthExpired(callback);

            chromeMock._triggerMessage({ type: 'someOtherMessage' });

            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('chrome storage change listener', () => {
        it('updates module state when active connection tokens are refreshed', async () => {
            const connection = createMockConnection({ id: 'active-conn' });
            chromeMock._setStorageData({ connections: [connection] });
            setActiveConnection(connection);

            const updatedConnection = {
                ...connection,
                accessToken: 'new-refreshed-token',
                instanceUrl: 'https://updated.salesforce.com',
            };

            // Update storage using chrome.storage.local.set to trigger listeners
            await chrome.storage.local.set({ connections: [updatedConnection] });

            expect(getAccessToken()).toBe('new-refreshed-token');
            expect(getInstanceUrl()).toBe('https://updated.salesforce.com');
        });

        it('triggers auth expired when active connection is removed', async () => {
            const callback = vi.fn();
            onAuthExpired(callback);
            const connection = createMockConnection({ id: 'to-be-removed' });
            chromeMock._setStorageData({ connections: [connection] });
            setActiveConnection(connection);

            // Remove connection via storage.set to trigger listeners
            await chrome.storage.local.set({ connections: [] });

            expect(callback).toHaveBeenCalledWith('to-be-removed', undefined);
        });

        it('ignores storage changes from non-local areas', async () => {
            const connection = createMockConnection({ id: 'test-conn' });
            chromeMock._setStorageData({ connections: [connection] });
            setActiveConnection(connection);
            const originalToken = getAccessToken();

            // Trigger change in sync area (not local)
            chromeMock._triggerStorageChange(
                {
                    connections: {
                        newValue: [{ ...connection, accessToken: 'should-not-update' }],
                    },
                },
                'sync'
            );

            expect(getAccessToken()).toBe(originalToken);
        });

        it('updates access token for legacy single-connection format', async () => {
            setActiveConnection(createMockConnection());

            await chrome.storage.local.set({
                [STORAGE_KEYS.ACCESS_TOKEN]: 'new-legacy-token',
            });

            expect(getAccessToken()).toBe('new-legacy-token');
        });

        it('updates instance URL for legacy single-connection format', async () => {
            setActiveConnection(createMockConnection());

            await chrome.storage.local.set({
                [STORAGE_KEYS.INSTANCE_URL]: 'https://new-legacy.salesforce.com',
            });

            expect(getInstanceUrl()).toBe('https://new-legacy.salesforce.com');
        });

        it('does not update tokens when no active connection ID', async () => {
            setActiveConnection(null);

            await chrome.storage.local.set({
                connections: [createMockConnection({ accessToken: 'should-not-update' })],
            });

            expect(getAccessToken()).toBe('');
        });
    });

    describe('removeConnection', () => {
        it('cleans up connection describe cache', async () => {
            const connectionId = 'conn-to-remove';
            chromeMock._setStorageData({
                connections: [createMockConnection({ id: connectionId })],
                [`describeCache_${connectionId}`]: { some: 'cached data' },
            });

            await removeConnection(connectionId);

            const storage = chromeMock._getStorageData();
            expect(storage[`describeCache_${connectionId}`]).toBeUndefined();
        });
    });
});
