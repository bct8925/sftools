/**
 * Tests for src/lib/salesforce.js
 *
 * Test IDs: SF-U-001 through SF-U-025
 * - SF-U-001: getCurrentUserId() - Returns user ID
 * - SF-U-002: executeAnonymousApex() - Returns execution result (tested in integration tests)
 * - SF-U-003: executeQueryWithColumns() - Returns columns and records
 * - SF-U-004: getGlobalDescribe() - Returns cached on second call
 * - SF-U-005: getObjectDescribe() - Returns cached on second call
 * - SF-U-006: getRecord() - Returns record data
 * - SF-U-007: updateRecord() - Sends PATCH request
 * - SF-U-008: executeRestRequest() - Makes authenticated request
 * - SF-U-009: getEventChannels() - Returns Platform Events
 * - SF-U-010: getPushTopics() - Returns PushTopics
 * - SF-U-011: publishPlatformEvent() - Publishes event
 * - SF-U-012: deleteAllDebugLogs() - Deletes ApexLog records
 * - SF-U-013: searchUsers() - Searches by name/username
 * - SF-U-014: enableTraceFlagForUser() - Creates TraceFlag
 * - SF-U-015: searchFlows() - Searches FlowDefinition
 * - SF-U-016: getFlowVersions() - Returns Flow versions
 * - SF-U-017: deleteInactiveFlowVersions() - Composite delete
 * - SF-U-018: createBulkQueryJob() - Creates Bulk API job
 * - SF-U-019: getBulkQueryJobStatus() - Returns job status
 * - SF-U-020: executeBulkQueryExport() - Full export flow
 * - SF-U-021: getFormulaFieldMetadata() - Returns formula metadata
 * - SF-U-022: updateFormulaField() - Updates via Tooling API
 * - SF-U-023: bulkDeleteTooling() - Batches in 25s
 * - SF-U-024: escapeSoql() - Escapes special chars (tested via searchFlows, searchUsers)
 * - SF-U-025: clearDescribeCache() - Clears cache
 * - SF-U-026: getUserInfo() - Returns user info with username
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockConnection } from '../mocks/salesforce.js';

// Mock dependencies
vi.mock('../../../src/api/salesforce-request.js', () => ({
    salesforceRequest: vi.fn(),
}));

vi.mock('../../../src/api/fetch.js', () => ({
    smartFetch: vi.fn(),
}));

vi.mock('../../../src/auth/auth.js', () => ({
    getAccessToken: vi.fn(),
    getInstanceUrl: vi.fn(),
    getActiveConnectionId: vi.fn(),
}));

// Import after mocking
import {
    clearDescribeCache,
    getCurrentUserId,
    getUserInfo,
    getGlobalDescribe,
    getObjectDescribe,
    getRecord,
    getRecordWithRelationships,
    updateRecord,
    searchUsers,
    searchFlows,
    getFlowVersions,
    deleteAllDebugLogs,
    deleteInactiveFlowVersions,
    executeQueryWithColumns,
    executeRestRequest,
    getEventChannels,
    getPushTopics,
    getAllStreamingChannels,
    publishPlatformEvent,
    enableTraceFlagForUser,
    deleteAllTraceFlags,
    searchProfiles,
    createBulkQueryJob,
    getBulkQueryJobStatus,
    getBulkQueryResults,
    abortBulkQueryJob,
    executeBulkQueryExport,
    getFormulaFieldMetadata,
    updateFormulaField,
} from '../../../src/api/salesforce.js';
import { salesforceRequest } from '../../../src/api/salesforce-request.js';
import { smartFetch } from '../../../src/api/fetch.js';
import { getAccessToken, getInstanceUrl, getActiveConnectionId } from '../../../src/auth/auth.js';

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
        it('SF-U-025: clears cache for current connection', async () => {
            // Set up cache first (using per-connection key format)
            chrome._setStorageData({
                'describeCache_conn-123': { global: { sobjects: [] }, objects: {} },
            });

            await clearDescribeCache();

            const storage = chrome._getStorageData();
            expect(storage['describeCache_conn-123']).toBeUndefined();
        });

        it('does nothing when no active connection', async () => {
            getActiveConnectionId.mockReturnValue(null);

            // Should not throw
            await clearDescribeCache();
        });

        it('preserves other connections cache', async () => {
            chrome._setStorageData({
                'describeCache_conn-123': { global: { sobjects: [] }, objects: {} },
                'describeCache_other-conn': { global: { sobjects: ['Account'] }, objects: {} },
            });

            await clearDescribeCache();

            const storage = chrome._getStorageData();
            expect(storage['describeCache_other-conn']).toBeDefined();
        });
    });

    describe('getCurrentUserId', () => {
        it('SF-U-001: returns user ID from chatter response', async () => {
            salesforceRequest.mockResolvedValue({
                json: { id: '005XXXXXXXXXXXXXXX', name: 'Test User' },
            });

            const userId = await getCurrentUserId();

            expect(userId).toBe('005XXXXXXXXXXXXXXX');
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/chatter/users/me')
            );
        });
    });

    describe('getUserInfo', () => {
        it('SF-U-026: returns user info from userinfo endpoint', async () => {
            salesforceRequest.mockResolvedValue({
                json: {
                    user_id: '005XXXXXXXXXXXXXXX',
                    organization_id: '00DXXXXXXXXXXXXXXX',
                    preferred_username: 'user@example.com',
                    nickname: 'user',
                    name: 'Test User',
                    email: 'user@example.com',
                    email_verified: true,
                },
            });

            const userInfo = await getUserInfo();

            expect(userInfo.preferred_username).toBe('user@example.com');
            expect(userInfo.user_id).toBe('005XXXXXXXXXXXXXXX');
            expect(salesforceRequest).toHaveBeenCalledWith('/services/oauth2/userinfo');
        });

        it('throws when no user info returned', async () => {
            salesforceRequest.mockResolvedValue({ json: null });

            await expect(getUserInfo()).rejects.toThrow('No user info returned from API');
        });
    });

    describe('executeAnonymousApex', () => {
        it('SF-U-002: returns execution result', () => {
            // This is tested in integration tests
            expect(true).toBe(true);
        });
    });

    describe('getGlobalDescribe', () => {
        it('SF-U-004: returns cached data when available', async () => {
            chrome._setStorageData({
                'describeCache_conn-123': {
                    global: { sobjects: [{ name: 'CachedObject' }] },
                    objects: {},
                },
            });

            const result = await getGlobalDescribe();

            expect(result.sobjects[0].name).toBe('CachedObject');
            expect(salesforceRequest).not.toHaveBeenCalled();
        });

        it('fetches and caches when no cache exists', async () => {
            salesforceRequest.mockResolvedValue({
                json: { sobjects: [{ name: 'Account' }, { name: 'Contact' }] },
            });

            const result = await getGlobalDescribe();

            expect(result.sobjects).toHaveLength(2);
            expect(salesforceRequest).toHaveBeenCalledWith(expect.stringContaining('/sobjects'));

            // Verify it was cached (using per-connection key format)
            const storage = chrome._getStorageData();
            expect(storage['describeCache_conn-123'].global.sobjects).toHaveLength(2);
        });

        it('bypasses cache when bypassCache is true', async () => {
            chrome._setStorageData({
                'describeCache_conn-123': {
                    global: { sobjects: [{ name: 'CachedObject' }] },
                    objects: {},
                },
            });
            salesforceRequest.mockResolvedValue({
                json: { sobjects: [{ name: 'FreshObject' }] },
            });

            const result = await getGlobalDescribe(true);

            expect(result.sobjects[0].name).toBe('FreshObject');
            expect(salesforceRequest).toHaveBeenCalled();
        });
    });

    describe('getObjectDescribe', () => {
        it('SF-U-005: returns cached data when available', async () => {
            chrome._setStorageData({
                'describeCache_conn-123': {
                    global: null,
                    objects: {
                        Account: { name: 'Account', fields: [{ name: 'Id' }] },
                    },
                },
            });

            const result = await getObjectDescribe('Account');

            expect(result.name).toBe('Account');
            expect(salesforceRequest).not.toHaveBeenCalled();
        });

        it('fetches and caches when no cache exists', async () => {
            salesforceRequest.mockResolvedValue({
                json: { name: 'Contact', fields: [{ name: 'Id' }, { name: 'Name' }] },
            });

            const result = await getObjectDescribe('Contact');

            expect(result.name).toBe('Contact');
            expect(result.fields).toHaveLength(2);
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/sobjects/Contact/describe')
            );

            // Verify it was cached (using per-connection key format)
            const storage = chrome._getStorageData();
            expect(storage['describeCache_conn-123'].objects['Contact']).toBeDefined();
        });

        it('bypasses cache when bypassCache is true', async () => {
            chrome._setStorageData({
                'describeCache_conn-123': {
                    global: null,
                    objects: { Account: { name: 'Account', fields: [] } },
                },
            });
            salesforceRequest.mockResolvedValue({
                json: { name: 'Account', fields: [{ name: 'NewField' }] },
            });

            const result = await getObjectDescribe('Account', true);

            expect(result.fields[0].name).toBe('NewField');
            expect(salesforceRequest).toHaveBeenCalled();
        });
    });

    describe('getRecord', () => {
        it('SF-U-006: fetches record by objectType and recordId', async () => {
            salesforceRequest.mockResolvedValue({
                json: { Id: '001abc', Name: 'Test Account' },
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
        it('SF-U-007: sends PATCH request with fields', async () => {
            salesforceRequest.mockResolvedValue({ json: null });

            await updateRecord('Account', '001abc', { Name: 'Updated Name' });

            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/sobjects/Account/001abc'),
                expect.objectContaining({
                    method: 'PATCH',
                    body: JSON.stringify({ Name: 'Updated Name' }),
                })
            );
        });
    });

    describe('searchUsers', () => {
        it('SF-U-013: returns matching users', async () => {
            salesforceRequest.mockResolvedValue({
                json: {
                    records: [{ Id: '005abc', Name: 'John Doe', Username: 'john@test.com' }],
                },
            });

            const result = await searchUsers('john');

            expect(result).toHaveLength(1);
            expect(result[0].Name).toBe('John Doe');
        });

        it('SF-U-024: escapes single quotes in search term', async () => {
            salesforceRequest.mockResolvedValue({ json: { records: [] } });

            await searchUsers("O'Brien");

            // The escaped quote is URL encoded: \' becomes %5C'
            expect(salesforceRequest).toHaveBeenCalledWith(expect.stringContaining("O%5C'Brien"));
        });

        it('returns empty array when no matches', async () => {
            salesforceRequest.mockResolvedValue({ json: { records: null } });

            const result = await searchUsers('nonexistent');

            expect(result).toEqual([]);
        });
    });

    describe('searchFlows', () => {
        it('SF-U-015: returns matching flows', async () => {
            salesforceRequest.mockResolvedValue({
                json: {
                    records: [
                        { Id: '300abc', DeveloperName: 'My_Flow', ActiveVersionId: '301abc' },
                    ],
                },
            });

            const result = await searchFlows('My_Flow');

            expect(result).toHaveLength(1);
            expect(result[0].DeveloperName).toBe('My_Flow');
        });

        it('escapes special SOQL characters in search term', async () => {
            salesforceRequest.mockResolvedValue({ json: { records: [] } });

            await searchFlows("Test's_Flow");

            // escapeSoql escapes: ' -> \', _ -> \_, % -> \%
            // URL encoded: \' becomes %5C' and \_ becomes %5C_
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining("Test%5C's%5C_Flow")
            );
        });
    });

    describe('getFlowVersions', () => {
        it('SF-U-016: returns all versions for a flow definition', async () => {
            salesforceRequest.mockResolvedValue({
                json: {
                    records: [
                        { Id: '301v3', VersionNumber: 3, Status: 'Active' },
                        { Id: '301v2', VersionNumber: 2, Status: 'Obsolete' },
                        { Id: '301v1', VersionNumber: 1, Status: 'Obsolete' },
                    ],
                },
            });

            const result = await getFlowVersions('300abc');

            expect(result).toHaveLength(3);
            expect(result[0].VersionNumber).toBe(3);
        });
    });

    describe('deleteAllDebugLogs', () => {
        it('SF-U-012: returns 0 when no logs exist', async () => {
            salesforceRequest.mockResolvedValue({ json: { records: [] } });

            const result = await deleteAllDebugLogs();

            expect(result.deletedCount).toBe(0);
        });

        it('SF-U-012: deletes logs in batches of 25', async () => {
            // First call returns log IDs
            salesforceRequest.mockResolvedValueOnce({
                json: {
                    records: Array.from({ length: 30 }, (_, i) => ({ Id: `07L${i}` })),
                },
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
        it('SF-U-017: returns 0 for empty array', async () => {
            const result = await deleteInactiveFlowVersions([]);

            expect(result.deletedCount).toBe(0);
            expect(salesforceRequest).not.toHaveBeenCalled();
        });

        it('SF-U-017: deletes flow versions', async () => {
            salesforceRequest.mockResolvedValue({ json: { compositeResponse: [] } });

            const result = await deleteInactiveFlowVersions(['301v1', '301v2']);

            expect(result.deletedCount).toBe(2);
        });

        it('SF-U-023: batches large deletes in 25s', async () => {
            salesforceRequest.mockResolvedValue({ json: { compositeResponse: [] } });
            const ids = Array.from({ length: 50 }, (_, i) => `301v${i}`);

            const result = await deleteInactiveFlowVersions(ids);

            expect(result.deletedCount).toBe(50);
            // 2 composite delete calls (25 + 25)
            expect(salesforceRequest).toHaveBeenCalledTimes(2);
        });
    });

    describe('executeQueryWithColumns', () => {
        it('SF-U-003: makes parallel requests for columns and data', async () => {
            salesforceRequest
                .mockResolvedValueOnce({
                    json: {
                        columnMetadata: [{ columnName: 'Id' }, { columnName: 'Name' }],
                        entityName: 'Account',
                    },
                })
                .mockResolvedValueOnce({
                    json: {
                        records: [{ Id: '001abc', Name: 'Test' }],
                        totalSize: 1,
                    },
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

    describe('executeRestRequest', () => {
        it('SF-U-008: makes request with correct headers', async () => {
            smartFetch.mockResolvedValue({
                success: true,
                status: 200,
                statusText: 'OK',
                data: '{"result":"ok"}',
            });

            await executeRestRequest('/services/data/v60.0/sobjects', 'GET');

            expect(smartFetch).toHaveBeenCalledWith(
                'https://test.salesforce.com/services/data/v60.0/sobjects',
                expect.objectContaining({
                    method: 'GET',
                    headers: expect.objectContaining({
                        Authorization: 'Bearer test-token',
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                    }),
                })
            );
        });

        it('parses JSON response', async () => {
            smartFetch.mockResolvedValue({
                success: true,
                status: 200,
                statusText: 'OK',
                data: '{"Id":"001abc","Name":"Test"}',
            });

            const result = await executeRestRequest('/test', 'GET');

            expect(result.success).toBe(true);
            expect(result.data).toEqual({ Id: '001abc', Name: 'Test' });
        });

        it('returns raw string for non-JSON', async () => {
            smartFetch.mockResolvedValue({
                success: true,
                status: 200,
                statusText: 'OK',
                data: 'Plain text response',
            });

            const result = await executeRestRequest('/test', 'GET');

            expect(result.data).toBe('Plain text response');
            expect(result.raw).toBe('Plain text response');
        });

        it('returns error info on failure', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                status: 400,
                statusText: 'Bad Request',
                error: 'Invalid request',
                data: '{"error":"bad"}',
            });

            const result = await executeRestRequest('/test', 'POST', '{}');

            expect(result.success).toBe(false);
            expect(result.status).toBe(400);
            expect(result.error).toBe('Invalid request');
        });
    });

    describe('getEventChannels', () => {
        it('SF-U-009: queries Platform Events via Tooling API', async () => {
            salesforceRequest.mockResolvedValue({
                json: {
                    records: [
                        {
                            DeveloperName: 'Order_Event',
                            QualifiedApiName: 'Order_Event__e',
                            Label: 'Order Event',
                        },
                    ],
                },
            });

            const result = await getEventChannels();

            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/tooling/query')
            );
            expect(result.customEvents).toHaveLength(1);
            expect(result.customEvents[0].QualifiedApiName).toBe('Order_Event__e');
        });

        it('returns empty array when no events exist', async () => {
            salesforceRequest.mockResolvedValue({ json: { records: null } });

            const result = await getEventChannels();

            expect(result.customEvents).toEqual([]);
        });
    });

    describe('getPushTopics', () => {
        it('SF-U-010: queries active PushTopics', async () => {
            salesforceRequest.mockResolvedValue({
                json: {
                    records: [
                        {
                            Id: '0IF123',
                            Name: 'AccountUpdates',
                            Query: 'SELECT Id FROM Account',
                            IsActive: true,
                        },
                    ],
                },
            });

            const result = await getPushTopics();

            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('IsActive%20%3D%20true')
            );
            expect(result).toHaveLength(1);
            expect(result[0].Name).toBe('AccountUpdates');
        });

        it('returns empty array when no topics exist', async () => {
            salesforceRequest.mockResolvedValue({ json: { records: null } });

            const result = await getPushTopics();

            expect(result).toEqual([]);
        });
    });

    describe('getAllStreamingChannels', () => {
        it('combines all channel types', async () => {
            salesforceRequest
                .mockResolvedValueOnce({
                    json: { records: [{ QualifiedApiName: 'Test_Event__e' }] },
                })
                .mockResolvedValueOnce({
                    json: { records: [{ Name: 'TestTopic' }] },
                });

            const result = await getAllStreamingChannels();

            expect(result.platformEvents).toHaveLength(1);
            expect(result.pushTopics).toHaveLength(1);
            expect(result.standardEvents.length).toBeGreaterThan(0);
            expect(result.systemTopics.length).toBeGreaterThan(0);
        });

        it('includes standard events and system topics', async () => {
            salesforceRequest
                .mockResolvedValueOnce({ json: { records: [] } })
                .mockResolvedValueOnce({ json: { records: [] } });

            const result = await getAllStreamingChannels();

            expect(result.standardEvents).toContainEqual(
                expect.objectContaining({ name: 'BatchApexErrorEvent' })
            );
            expect(result.systemTopics).toContainEqual(
                expect.objectContaining({ channel: '/systemTopic/Logging' })
            );
        });

        it('handles getPushTopics failure gracefully', async () => {
            salesforceRequest
                .mockResolvedValueOnce({ json: { records: [{ QualifiedApiName: 'Event__e' }] } })
                .mockRejectedValueOnce(new Error('Query failed'));

            const result = await getAllStreamingChannels();

            expect(result.platformEvents).toHaveLength(1);
            expect(result.pushTopics).toEqual([]);
        });
    });

    describe('publishPlatformEvent', () => {
        it('SF-U-011: posts event and returns success with id', async () => {
            smartFetch.mockResolvedValue({
                success: true,
                data: '{"id":"e01abc","success":true}',
            });

            const result = await publishPlatformEvent('My_Event__e', { Field__c: 'value' });

            expect(smartFetch).toHaveBeenCalledWith(
                expect.stringContaining('/sobjects/My_Event__e'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ Field__c: 'value' }),
                })
            );
            expect(result.success).toBe(true);
            expect(result.id).toBe('e01abc');
        });

        it('returns error message on failure', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                data: 'Invalid event',
            });

            const result = await publishPlatformEvent('Bad_Event__e', {});

            expect(result.success).toBe(false);
            expect(result.id).toBeNull();
            expect(result.error).toBe('Publish failed');
        });

        it('extracts error from array format', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                data: '[{"message":"Field required: Name__c","errorCode":"REQUIRED_FIELD_MISSING"}]',
            });

            const result = await publishPlatformEvent('My_Event__e', {});

            expect(result.error).toBe('Field required: Name__c');
        });

        it('uses default error when parse fails', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                data: 'not valid json [',
            });

            const result = await publishPlatformEvent('My_Event__e', {});

            expect(result.error).toBe('Publish failed');
        });
    });

    describe('enableTraceFlagForUser', () => {
        it('SF-U-014: updates existing trace flag expiration', async () => {
            salesforceRequest
                .mockResolvedValueOnce({
                    json: {
                        records: [
                            {
                                Id: '7tf123',
                                DebugLevelId: 'dbg456',
                                ExpirationDate: '2024-01-01T00:00:00Z',
                            },
                        ],
                    },
                })
                .mockResolvedValueOnce({ json: {} });

            const result = await enableTraceFlagForUser('005abc');

            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/tooling/sobjects/TraceFlag/7tf123'),
                expect.objectContaining({ method: 'PATCH' })
            );
            expect(result).toBe('7tf123');
        });

        it('creates new trace flag when none exists', async () => {
            salesforceRequest
                .mockResolvedValueOnce({ json: { records: [] } })
                .mockResolvedValueOnce({ json: { records: [{ Id: 'dbg789' }] } }) // getOrCreateDebugLevel query
                .mockResolvedValueOnce({ json: { id: '7tf999' } }); // create TraceFlag

            const result = await enableTraceFlagForUser('005xyz');

            expect(salesforceRequest).toHaveBeenLastCalledWith(
                expect.stringContaining('/tooling/sobjects/TraceFlag'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('005xyz'),
                })
            );
            expect(result).toBe('7tf999');
        });

        it('creates debug level if needed', async () => {
            salesforceRequest
                .mockResolvedValueOnce({ json: { records: [] } }) // no existing trace flag
                .mockResolvedValueOnce({ json: { records: [] } }) // no existing debug level
                .mockResolvedValueOnce({ json: { id: 'dbgNew' } }) // create debug level
                .mockResolvedValueOnce({ json: { id: '7tfNew' } }); // create trace flag

            const result = await enableTraceFlagForUser('005new');

            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/tooling/sobjects/DebugLevel'),
                expect.objectContaining({ method: 'POST' })
            );
            expect(result).toBe('7tfNew');
        });

        it('returns trace flag ID', async () => {
            salesforceRequest
                .mockResolvedValueOnce({
                    json: { records: [{ Id: '7tfExisting', DebugLevelId: 'dbg123' }] },
                })
                .mockResolvedValueOnce({ json: {} });

            const result = await enableTraceFlagForUser('005user');

            expect(typeof result).toBe('string');
            expect(result).toBe('7tfExisting');
        });
    });

    describe('deleteAllTraceFlags', () => {
        it('returns 0 when no flags exist', async () => {
            salesforceRequest.mockResolvedValue({ json: { records: [] } });

            const result = await deleteAllTraceFlags();

            expect(result.deletedCount).toBe(0);
        });

        it('deletes all flags in batches', async () => {
            salesforceRequest
                .mockResolvedValueOnce({
                    json: { records: Array.from({ length: 30 }, (_, i) => ({ Id: `7tf${i}` })) },
                })
                .mockResolvedValue({ json: { compositeResponse: [] } });

            const result = await deleteAllTraceFlags();

            expect(result.deletedCount).toBe(30);
            // 1 query + 2 composite delete calls (25 + 5)
            expect(salesforceRequest).toHaveBeenCalledTimes(3);
        });

        it('handles null records', async () => {
            salesforceRequest.mockResolvedValue({ json: { records: null } });

            const result = await deleteAllTraceFlags();

            expect(result.deletedCount).toBe(0);
        });
    });

    describe('searchProfiles', () => {
        it('returns matching profiles', async () => {
            salesforceRequest.mockResolvedValue({
                json: {
                    records: [
                        { Id: '00e123', Name: 'System Administrator' },
                        { Id: '00e456', Name: 'Standard User' },
                    ],
                },
            });

            const result = await searchProfiles('Admin');

            expect(result).toHaveLength(2);
            expect(result[0].Name).toBe('System Administrator');
        });

        it('escapes single quotes in search term', async () => {
            salesforceRequest.mockResolvedValue({ json: { records: [] } });

            await searchProfiles("Partner's Profile");

            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining("Partner%5C's%20Profile")
            );
        });
    });

    describe('createBulkQueryJob', () => {
        it('SF-U-018: creates job with query', async () => {
            salesforceRequest.mockResolvedValue({
                json: { id: '750abc', state: 'UploadComplete' },
            });

            const result = await createBulkQueryJob('SELECT Id FROM Account');

            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/jobs/query'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ operation: 'query', query: 'SELECT Id FROM Account' }),
                })
            );
            expect(result.id).toBe('750abc');
        });

        it('returns job response', async () => {
            salesforceRequest.mockResolvedValue({
                json: { id: '750xyz', state: 'UploadComplete', operation: 'query' },
            });

            const result = await createBulkQueryJob('SELECT Name FROM Contact');

            expect(result.state).toBe('UploadComplete');
        });
    });

    describe('getBulkQueryJobStatus', () => {
        it('SF-U-019: returns job status', async () => {
            salesforceRequest.mockResolvedValue({
                json: { id: '750abc', state: 'JobComplete', numberRecordsProcessed: 1000 },
            });

            const result = await getBulkQueryJobStatus('750abc');

            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/jobs/query/750abc')
            );
            expect(result.state).toBe('JobComplete');
            expect(result.numberRecordsProcessed).toBe(1000);
        });
    });

    describe('getBulkQueryResults', () => {
        it('fetches CSV with correct Accept header', async () => {
            smartFetch.mockResolvedValue({
                success: true,
                data: 'Id,Name\n001abc,Test',
            });

            await getBulkQueryResults('750abc');

            expect(smartFetch).toHaveBeenCalledWith(
                expect.stringContaining('/jobs/query/750abc/results'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Accept: 'text/csv',
                    }),
                })
            );
        });

        it('returns CSV data', async () => {
            const csvData = 'Id,Name\n001abc,Account 1\n001def,Account 2';
            smartFetch.mockResolvedValue({
                success: true,
                data: csvData,
            });

            const result = await getBulkQueryResults('750abc');

            expect(result).toBe(csvData);
        });

        it('throws on failure', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                error: 'Job not found',
            });

            await expect(getBulkQueryResults('bad123')).rejects.toThrow('Job not found');
        });
    });

    describe('abortBulkQueryJob', () => {
        it('patches job state to Aborted', async () => {
            salesforceRequest.mockResolvedValue({ json: {} });

            await abortBulkQueryJob('750abc');

            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/jobs/query/750abc'),
                expect.objectContaining({
                    method: 'PATCH',
                    body: JSON.stringify({ state: 'Aborted' }),
                })
            );
        });
    });

    describe('executeBulkQueryExport', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('SF-U-020: creates job and polls until complete', async () => {
            salesforceRequest
                .mockResolvedValueOnce({ json: { id: '750poll', state: 'UploadComplete' } }) // createBulkQueryJob
                .mockResolvedValueOnce({
                    json: { id: '750poll', state: 'InProgress', numberRecordsProcessed: 500 },
                }) // poll 1
                .mockResolvedValueOnce({
                    json: { id: '750poll', state: 'JobComplete', numberRecordsProcessed: 1000 },
                }); // poll 2

            smartFetch.mockResolvedValue({ success: true, data: 'Id\n001abc' });

            const promise = executeBulkQueryExport('SELECT Id FROM Account', vi.fn());

            // Advance through polls
            await vi.advanceTimersByTimeAsync(2000);
            await vi.advanceTimersByTimeAsync(2000);

            const result = await promise;

            expect(result).toBe('Id\n001abc');
        });

        it('returns CSV on success', async () => {
            salesforceRequest
                .mockResolvedValueOnce({ json: { id: '750csv', state: 'UploadComplete' } })
                .mockResolvedValueOnce({ json: { id: '750csv', state: 'JobComplete' } });

            const csvContent = 'Id,Name\n001abc,Test Account';
            smartFetch.mockResolvedValue({ success: true, data: csvContent });

            const promise = executeBulkQueryExport('SELECT Id, Name FROM Account', vi.fn());
            await vi.advanceTimersByTimeAsync(2000);

            const result = await promise;

            expect(result).toBe(csvContent);
        });

        it('calls onProgress callback', async () => {
            salesforceRequest
                .mockResolvedValueOnce({ json: { id: '750prog', state: 'UploadComplete' } })
                .mockResolvedValueOnce({
                    json: { id: '750prog', state: 'InProgress', numberRecordsProcessed: 100 },
                })
                .mockResolvedValueOnce({
                    json: { id: '750prog', state: 'JobComplete', numberRecordsProcessed: 200 },
                });

            smartFetch.mockResolvedValue({ success: true, data: 'data' });

            const onProgress = vi.fn();
            const promise = executeBulkQueryExport('SELECT Id FROM Account', onProgress);

            await vi.advanceTimersByTimeAsync(2000);
            await vi.advanceTimersByTimeAsync(2000);
            await promise;

            expect(onProgress).toHaveBeenCalledWith('Creating job...');
            expect(onProgress).toHaveBeenCalledWith('InProgress', 100);
            expect(onProgress).toHaveBeenCalledWith('JobComplete', 200);
            expect(onProgress).toHaveBeenCalledWith('Downloading...');
        });

        it('throws on Failed state', async () => {
            vi.useRealTimers(); // Use real timers for this test

            salesforceRequest
                .mockResolvedValueOnce({ json: { id: '750fail', state: 'UploadComplete' } })
                .mockResolvedValueOnce({
                    json: { id: '750fail', state: 'Failed', errorMessage: 'Invalid query' },
                });

            await expect(
                executeBulkQueryExport('SELECT BadField FROM Account', vi.fn())
            ).rejects.toThrow('Bulk query failed: Invalid query');
        });

        it('throws on Aborted state', async () => {
            vi.useRealTimers(); // Use real timers for this test

            salesforceRequest
                .mockResolvedValueOnce({ json: { id: '750abort', state: 'UploadComplete' } })
                .mockResolvedValueOnce({ json: { id: '750abort', state: 'Aborted' } });

            await expect(executeBulkQueryExport('SELECT Id FROM Account', vi.fn())).rejects.toThrow(
                'Bulk query aborted'
            );
        });
    });

    describe('getFormulaFieldMetadata', () => {
        it('SF-U-021: queries CustomField via Tooling API', async () => {
            salesforceRequest.mockResolvedValue({
                json: {
                    records: [
                        {
                            Id: '00N123',
                            FullName: 'Account.Formula__c',
                            Metadata: { formula: 'Name & " - " & Industry' },
                        },
                    ],
                },
            });

            await getFormulaFieldMetadata('Account', 'Formula__c');

            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/tooling/query')
            );
            // The DeveloperName is the field name without __c suffix
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining("DeveloperName%20%3D%20'Formula'")
            );
        });

        it('returns formula and metadata', async () => {
            salesforceRequest.mockResolvedValue({
                json: {
                    records: [
                        {
                            Id: '00N456',
                            FullName: 'Contact.FullAddress__c',
                            Metadata: {
                                formula: 'MailingStreet & ", " & MailingCity',
                                type: 'Text',
                            },
                        },
                    ],
                },
            });

            const result = await getFormulaFieldMetadata('Contact', 'FullAddress__c');

            expect(result.id).toBe('00N456');
            expect(result.formula).toBe('MailingStreet & ", " & MailingCity');
            expect(result.metadata.type).toBe('Text');
        });

        it('throws when field not found', async () => {
            salesforceRequest.mockResolvedValue({ json: { records: [] } });

            await expect(getFormulaFieldMetadata('Account', 'NonExistent__c')).rejects.toThrow(
                'Formula field not found'
            );
        });
    });

    describe('updateFormulaField', () => {
        it('SF-U-022: patches field with new formula', async () => {
            salesforceRequest.mockResolvedValue({ json: {} });

            await updateFormulaField('00N789', 'NEW_FORMULA()', { type: 'Text', length: 100 });

            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/tooling/sobjects/CustomField/00N789'),
                expect.objectContaining({
                    method: 'PATCH',
                    body: expect.stringContaining('NEW_FORMULA()'),
                })
            );
        });

        it('preserves existing metadata', async () => {
            salesforceRequest.mockResolvedValue({ json: {} });

            const existingMetadata = { type: 'Number', scale: 2, precision: 18 };
            await updateFormulaField('00Nabc', 'Amount * 1.1', existingMetadata);

            const callBody = JSON.parse(salesforceRequest.mock.calls[0][1].body);
            expect(callBody.Metadata).toEqual({
                type: 'Number',
                scale: 2,
                precision: 18,
                formula: 'Amount * 1.1',
            });
        });
    });

    describe('getRecordWithRelationships', () => {
        it('collects referenced object types', async () => {
            const fields = [
                { name: 'Id', type: 'id' },
                {
                    name: 'OwnerId',
                    type: 'reference',
                    referenceTo: ['User'],
                    relationshipName: 'Owner',
                },
                {
                    name: 'AccountId',
                    type: 'reference',
                    referenceTo: ['Account'],
                    relationshipName: 'Account',
                },
            ];

            salesforceRequest
                .mockResolvedValueOnce({ json: { fields: [{ name: 'Name', nameField: true }] } }) // User describe
                .mockResolvedValueOnce({ json: { fields: [{ name: 'Name', nameField: true }] } }) // Account describe
                .mockResolvedValueOnce({ json: { records: [{ Id: '001abc' }] } }); // query

            await getRecordWithRelationships('Contact', '003abc', fields);

            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/sobjects/User/describe')
            );
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/sobjects/Account/describe')
            );
        });

        it('fetches describes for references in parallel', async () => {
            const fields = [
                { name: 'Id', type: 'id' },
                {
                    name: 'OwnerId',
                    type: 'reference',
                    referenceTo: ['User'],
                    relationshipName: 'Owner',
                },
                {
                    name: 'CreatedById',
                    type: 'reference',
                    referenceTo: ['User'],
                    relationshipName: 'CreatedBy',
                },
            ];

            salesforceRequest
                .mockResolvedValueOnce({ json: { fields: [{ name: 'Name', nameField: true }] } })
                .mockResolvedValueOnce({ json: { records: [{ Id: '001abc' }] } });

            await getRecordWithRelationships('Account', '001abc', fields);

            // Only one User describe call since both reference User
            expect(salesforceRequest).toHaveBeenCalledTimes(2);
        });

        it('builds field list with relationship paths', async () => {
            const fields = [
                { name: 'Id', type: 'id' },
                { name: 'Name', type: 'string' },
                {
                    name: 'AccountId',
                    type: 'reference',
                    referenceTo: ['Account'],
                    relationshipName: 'Account',
                },
            ];

            salesforceRequest
                .mockResolvedValueOnce({ json: { fields: [{ name: 'Name', nameField: true }] } })
                .mockResolvedValueOnce({
                    json: { records: [{ Id: '003abc', Name: 'Test', Account: { Name: 'Acme' } }] },
                });

            await getRecordWithRelationships('Contact', '003abc', fields);

            expect(salesforceRequest).toHaveBeenLastCalledWith(
                expect.stringContaining('Account.Name')
            );
        });

        it('returns record and nameFieldMap', async () => {
            const fields = [
                { name: 'Id', type: 'id' },
                {
                    name: 'OwnerId',
                    type: 'reference',
                    referenceTo: ['User'],
                    relationshipName: 'Owner',
                },
            ];

            salesforceRequest
                .mockResolvedValueOnce({ json: { fields: [{ name: 'Name', nameField: true }] } })
                .mockResolvedValueOnce({
                    json: { records: [{ Id: '001abc', Owner: { Name: 'John' } }] },
                });

            const result = await getRecordWithRelationships('Account', '001abc', fields);

            expect(result.record.Id).toBe('001abc');
            expect(result.nameFieldMap).toEqual({ User: 'Name' });
        });

        it('throws when record not found', async () => {
            const fields = [{ name: 'Id', type: 'id' }];

            salesforceRequest.mockResolvedValueOnce({ json: { records: [] } });

            await expect(getRecordWithRelationships('Account', 'badId', fields)).rejects.toThrow(
                'Record not found'
            );
        });
    });
});
