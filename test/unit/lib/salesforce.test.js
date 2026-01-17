// Tests for src/lib/salesforce.js
// Focuses on cache functions, simple API wrappers, and batch operations
// Defers complex async flows (executeAnonymousApex, ensureTraceFlag, executeBulkQueryExport)

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockConnection } from '../../mocks/salesforce.js';

// Mock dependencies
vi.mock('../../../src/lib/salesforce-request.js', () => ({
    salesforceRequest: vi.fn()
}));

vi.mock('../../../src/lib/fetch.js', () => ({
    smartFetch: vi.fn()
}));

vi.mock('../../../src/lib/auth.js', () => ({
    getAccessToken: vi.fn(),
    getInstanceUrl: vi.fn(),
    getActiveConnectionId: vi.fn()
}));

// Import after mocking
import {
    clearDescribeCache,
    getCurrentUserId,
    getGlobalDescribe,
    getObjectDescribe,
    getRecord,
    updateRecord,
    searchUsers,
    searchFlows,
    getFlowVersions,
    deleteAllDebugLogs,
    deleteInactiveFlowVersions,
    executeQueryWithColumns
} from '../../../src/lib/salesforce.js';
import { salesforceRequest } from '../../../src/lib/salesforce-request.js';
import { smartFetch } from '../../../src/lib/fetch.js';
import { getAccessToken, getInstanceUrl, getActiveConnectionId } from '../../../src/lib/auth.js';

describe('salesforce', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        getAccessToken.mockReturnValue('test-token');
        getInstanceUrl.mockReturnValue('https://test.salesforce.com');
        getActiveConnectionId.mockReturnValue('conn-123');

        // Clear cache before each test
        await clearDescribeCache();
    });

    describe('clearDescribeCache', () => {
        it('clears cache for current connection', async () => {
            // Set up cache first
            chrome._setStorageData({
                describeCache: {
                    'conn-123': { global: { sobjects: [] }, objects: {} }
                }
            });

            await clearDescribeCache();

            const storage = chrome._getStorageData();
            expect(storage.describeCache['conn-123']).toBeUndefined();
        });

        it('does nothing when no active connection', async () => {
            getActiveConnectionId.mockReturnValue(null);

            // Should not throw
            await clearDescribeCache();
        });

        it('preserves other connections cache', async () => {
            chrome._setStorageData({
                describeCache: {
                    'conn-123': { global: { sobjects: [] }, objects: {} },
                    'other-conn': { global: { sobjects: ['Account'] }, objects: {} }
                }
            });

            await clearDescribeCache();

            const storage = chrome._getStorageData();
            expect(storage.describeCache['other-conn']).toBeDefined();
        });
    });

    describe('getCurrentUserId', () => {
        it('extracts id from chatter response', async () => {
            salesforceRequest.mockResolvedValue({
                json: { id: '005XXXXXXXXXXXXXXX', name: 'Test User' }
            });

            const userId = await getCurrentUserId();

            expect(userId).toBe('005XXXXXXXXXXXXXXX');
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/chatter/users/me')
            );
        });
    });

    describe('getGlobalDescribe', () => {
        it('returns cached data when available', async () => {
            chrome._setStorageData({
                describeCache: {
                    'conn-123': {
                        global: { sobjects: [{ name: 'CachedObject' }] },
                        objects: {}
                    }
                }
            });

            const result = await getGlobalDescribe();

            expect(result.sobjects[0].name).toBe('CachedObject');
            expect(salesforceRequest).not.toHaveBeenCalled();
        });

        it('fetches and caches when no cache exists', async () => {
            salesforceRequest.mockResolvedValue({
                json: { sobjects: [{ name: 'Account' }, { name: 'Contact' }] }
            });

            const result = await getGlobalDescribe();

            expect(result.sobjects).toHaveLength(2);
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/sobjects')
            );

            // Verify it was cached
            const storage = chrome._getStorageData();
            expect(storage.describeCache['conn-123'].global.sobjects).toHaveLength(2);
        });

        it('bypasses cache when bypassCache is true', async () => {
            chrome._setStorageData({
                describeCache: {
                    'conn-123': {
                        global: { sobjects: [{ name: 'CachedObject' }] },
                        objects: {}
                    }
                }
            });
            salesforceRequest.mockResolvedValue({
                json: { sobjects: [{ name: 'FreshObject' }] }
            });

            const result = await getGlobalDescribe(true);

            expect(result.sobjects[0].name).toBe('FreshObject');
            expect(salesforceRequest).toHaveBeenCalled();
        });
    });

    describe('getObjectDescribe', () => {
        it('returns cached data when available', async () => {
            chrome._setStorageData({
                describeCache: {
                    'conn-123': {
                        global: null,
                        objects: {
                            'Account': { name: 'Account', fields: [{ name: 'Id' }] }
                        }
                    }
                }
            });

            const result = await getObjectDescribe('Account');

            expect(result.name).toBe('Account');
            expect(salesforceRequest).not.toHaveBeenCalled();
        });

        it('fetches and caches when no cache exists', async () => {
            salesforceRequest.mockResolvedValue({
                json: { name: 'Contact', fields: [{ name: 'Id' }, { name: 'Name' }] }
            });

            const result = await getObjectDescribe('Contact');

            expect(result.name).toBe('Contact');
            expect(result.fields).toHaveLength(2);
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/sobjects/Contact/describe')
            );

            // Verify it was cached
            const storage = chrome._getStorageData();
            expect(storage.describeCache['conn-123'].objects['Contact']).toBeDefined();
        });

        it('bypasses cache when bypassCache is true', async () => {
            chrome._setStorageData({
                describeCache: {
                    'conn-123': {
                        global: null,
                        objects: { 'Account': { name: 'Account', fields: [] } }
                    }
                }
            });
            salesforceRequest.mockResolvedValue({
                json: { name: 'Account', fields: [{ name: 'NewField' }] }
            });

            const result = await getObjectDescribe('Account', true);

            expect(result.fields[0].name).toBe('NewField');
            expect(salesforceRequest).toHaveBeenCalled();
        });
    });

    describe('getRecord', () => {
        it('fetches record by objectType and recordId', async () => {
            salesforceRequest.mockResolvedValue({
                json: { Id: '001abc', Name: 'Test Account' }
            });

            const result = await getRecord('Account', '001abc');

            expect(result.Id).toBe('001abc');
            expect(result.Name).toBe('Test Account');
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/sobjects/Account/001abc')
            );
        });
    });

    describe('updateRecord', () => {
        it('sends PATCH request with fields', async () => {
            salesforceRequest.mockResolvedValue({ json: null });

            await updateRecord('Account', '001abc', { Name: 'Updated Name' });

            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/sobjects/Account/001abc'),
                expect.objectContaining({
                    method: 'PATCH',
                    body: JSON.stringify({ Name: 'Updated Name' })
                })
            );
        });
    });

    describe('searchUsers', () => {
        it('returns matching users', async () => {
            salesforceRequest.mockResolvedValue({
                json: {
                    records: [
                        { Id: '005abc', Name: 'John Doe', Username: 'john@test.com' }
                    ]
                }
            });

            const result = await searchUsers('john');

            expect(result).toHaveLength(1);
            expect(result[0].Name).toBe('John Doe');
        });

        it('escapes single quotes in search term', async () => {
            salesforceRequest.mockResolvedValue({ json: { records: [] } });

            await searchUsers("O'Brien");

            // The escaped quote is URL encoded: \' becomes %5C'
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining("O%5C'Brien")
            );
        });

        it('returns empty array when no matches', async () => {
            salesforceRequest.mockResolvedValue({ json: { records: null } });

            const result = await searchUsers('nonexistent');

            expect(result).toEqual([]);
        });
    });

    describe('searchFlows', () => {
        it('returns matching flows', async () => {
            salesforceRequest.mockResolvedValue({
                json: {
                    records: [
                        { Id: '300abc', DeveloperName: 'My_Flow', ActiveVersionId: '301abc' }
                    ]
                }
            });

            const result = await searchFlows('My_Flow');

            expect(result).toHaveLength(1);
            expect(result[0].DeveloperName).toBe('My_Flow');
        });

        it('escapes single quotes in search term', async () => {
            salesforceRequest.mockResolvedValue({ json: { records: [] } });

            await searchFlows("Test's_Flow");

            // The escaped quote is URL encoded: \' becomes %5C'
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining("Test%5C's_Flow")
            );
        });
    });

    describe('getFlowVersions', () => {
        it('returns all versions for a flow definition', async () => {
            salesforceRequest.mockResolvedValue({
                json: {
                    records: [
                        { Id: '301v3', VersionNumber: 3, Status: 'Active' },
                        { Id: '301v2', VersionNumber: 2, Status: 'Obsolete' },
                        { Id: '301v1', VersionNumber: 1, Status: 'Obsolete' }
                    ]
                }
            });

            const result = await getFlowVersions('300abc');

            expect(result).toHaveLength(3);
            expect(result[0].VersionNumber).toBe(3);
        });
    });

    describe('deleteAllDebugLogs', () => {
        it('returns 0 when no logs exist', async () => {
            salesforceRequest.mockResolvedValue({ json: { records: [] } });

            const result = await deleteAllDebugLogs();

            expect(result.deletedCount).toBe(0);
        });

        it('deletes logs in batches of 25', async () => {
            // First call returns log IDs
            salesforceRequest.mockResolvedValueOnce({
                json: {
                    records: Array.from({ length: 30 }, (_, i) => ({ Id: `07L${i}` }))
                }
            });
            // Subsequent calls are composite deletes
            salesforceRequest.mockResolvedValue({ json: { compositeResponse: [] } });

            const result = await deleteAllDebugLogs();

            expect(result.deletedCount).toBe(30);
            // 1 query + 2 composite delete calls (25 + 5)
            expect(salesforceRequest).toHaveBeenCalledTimes(3);
        });

        it('handles null records gracefully', async () => {
            salesforceRequest.mockResolvedValue({ json: { records: null } });

            const result = await deleteAllDebugLogs();

            expect(result.deletedCount).toBe(0);
        });
    });

    describe('deleteInactiveFlowVersions', () => {
        it('returns 0 for empty array', async () => {
            const result = await deleteInactiveFlowVersions([]);

            expect(result.deletedCount).toBe(0);
            expect(salesforceRequest).not.toHaveBeenCalled();
        });

        it('deletes flow versions', async () => {
            salesforceRequest.mockResolvedValue({ json: { compositeResponse: [] } });

            const result = await deleteInactiveFlowVersions(['301v1', '301v2']);

            expect(result.deletedCount).toBe(2);
        });

        it('batches large deletes', async () => {
            salesforceRequest.mockResolvedValue({ json: { compositeResponse: [] } });
            const ids = Array.from({ length: 50 }, (_, i) => `301v${i}`);

            const result = await deleteInactiveFlowVersions(ids);

            expect(result.deletedCount).toBe(50);
            // 2 composite delete calls (25 + 25)
            expect(salesforceRequest).toHaveBeenCalledTimes(2);
        });
    });

    describe('executeQueryWithColumns', () => {
        it('makes parallel requests for columns and data', async () => {
            salesforceRequest
                .mockResolvedValueOnce({
                    json: {
                        columnMetadata: [{ columnName: 'Id' }, { columnName: 'Name' }],
                        entityName: 'Account'
                    }
                })
                .mockResolvedValueOnce({
                    json: {
                        records: [{ Id: '001abc', Name: 'Test' }],
                        totalSize: 1
                    }
                });

            const result = await executeQueryWithColumns('SELECT Id, Name FROM Account');

            expect(salesforceRequest).toHaveBeenCalledTimes(2);
            expect(result.records).toHaveLength(1);
            expect(result.columnMetadata).toHaveLength(2);
            expect(result.entityName).toBe('Account');
        });

        it('uses tooling API when specified', async () => {
            salesforceRequest
                .mockResolvedValueOnce({ json: { columnMetadata: [] } })
                .mockResolvedValueOnce({ json: { records: [], totalSize: 0 } });

            await executeQueryWithColumns('SELECT Id FROM ApexClass', true);

            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/tooling/query/')
            );
        });

        it('handles missing response data gracefully', async () => {
            salesforceRequest
                .mockResolvedValueOnce({ json: null })
                .mockResolvedValueOnce({ json: null });

            const result = await executeQueryWithColumns('SELECT Id FROM Account');

            expect(result.records).toEqual([]);
            expect(result.totalSize).toBe(0);
            expect(result.columnMetadata).toEqual([]);
            expect(result.entityName).toBeNull();
        });
    });
});
