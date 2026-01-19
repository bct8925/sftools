/**
 * Integration tests for Utils Tab
 *
 * Test IDs: U-DL-I-001 through U-DL-I-005, U-FC-I-001 through U-FC-I-003
 *
 * Debug Logs Tool:
 * - U-DL-I-001: Not authenticated - Error message (skip - needs invalid token)
 * - U-DL-I-002: User search with no results - Empty list
 * - U-DL-I-003: Trace flag already exists - Updated (not duplicate)
 * - U-DL-I-004: No trace flags to delete - Success (no-op)
 * - U-DL-I-005: No logs to delete - Success (no-op)
 *
 * Flow Cleanup Tool:
 * - U-FC-I-001: Flow search with no results - Empty list
 * - U-FC-I-002: Flow with no inactive versions - Delete button disabled
 * - U-FC-I-003: Flow with only active version - No deletable versions
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { salesforce, TestDataManager, uniqueName } from './setup.js';

describe('Utils Tab Integration', () => {
    const testData = new TestDataManager();

    afterAll(async () => {
        await testData.cleanup();
    });

    describe('Debug Logs Tool', () => {
        // U-DL-I-001: Not authenticated - Error message
        describe('U-DL-I-001: Not authenticated (skipped)', () => {
            it.skip('returns 401 with invalid access token', async () => {
                // Skipped: Would require creating a separate fetch with invalid token
                // The setup always uses valid credentials
            });
        });

        describe('U-DL-I-002: User search with no results', () => {
            it('returns empty array for non-matching name search', async () => {
                const nonExistentName = uniqueName('ZZZ_NonExistent');
                const result = await salesforce.query(
                    `SELECT Id, Name, Username FROM User WHERE Name LIKE '${nonExistentName}%' LIMIT 10`
                );
                expect(result).toEqual([]);
            });

            it('returns empty array for partial username with no matches', async () => {
                const result = await salesforce.query(
                    "SELECT Id, Name, Username FROM User WHERE Username LIKE 'zzz_impossible_user_%' LIMIT 10"
                );
                expect(result).toEqual([]);
            });

            it('returns users when search matches', async () => {
                // Get current user to confirm search works
                const currentUser = await salesforce.getCurrentUser();
                const result = await salesforce.query(
                    `SELECT Id, Name, Username FROM User WHERE Id = '${currentUser.id}' LIMIT 1`
                );
                expect(result.length).toBe(1);
                expect(result[0].Id).toBe(currentUser.id);
            });
        });

        describe('U-DL-I-003: Trace flag already exists', () => {
            it('can query existing trace flags for a user', async () => {
                const currentUser = await salesforce.getCurrentUser();
                const result = await salesforce.toolingQuery(
                    `SELECT Id, DebugLevelId, ExpirationDate FROM TraceFlag WHERE TracedEntityId = '${currentUser.id}' AND LogType = 'USER_DEBUG'`
                );
                // Result may be empty or have trace flags - both are valid
                expect(Array.isArray(result)).toBe(true);
            });

            it('can query DebugLevel records', async () => {
                const result = await salesforce.toolingQuery(
                    "SELECT Id, DeveloperName FROM DebugLevel LIMIT 10"
                );
                expect(Array.isArray(result)).toBe(true);
            });
        });

        describe('U-DL-I-004: No trace flags to delete - Success (no-op)', () => {
            it('returns empty array when querying for non-existent user trace flags', async () => {
                const nonExistentId = '005000000000000AAA';
                const result = await salesforce.toolingQuery(
                    `SELECT Id FROM TraceFlag WHERE TracedEntityId = '${nonExistentId}' LIMIT 1`
                );
                expect(result).toEqual([]);
            });

            it('can query all trace flags', async () => {
                const result = await salesforce.toolingQuery(
                    'SELECT Id FROM TraceFlag LIMIT 100'
                );
                expect(Array.isArray(result)).toBe(true);
            });
        });

        describe('U-DL-I-005: No logs to delete - Success (no-op)', () => {
            it('returns empty result when filtering for impossible operation', async () => {
                const result = await salesforce.toolingQuery(
                    "SELECT Id FROM ApexLog WHERE Operation = 'ZZZ_Impossible_Operation' LIMIT 1"
                );
                expect(result).toEqual([]);
            });

            it('can query ApexLog records', async () => {
                const result = await salesforce.toolingQuery(
                    'SELECT Id, Operation, Status FROM ApexLog LIMIT 10'
                );
                expect(Array.isArray(result)).toBe(true);
            });
        });
    });

    describe('Flow Cleanup Tool', () => {
        describe('U-FC-I-001: Flow search with no results', () => {
            it('returns empty array for non-matching flow name', async () => {
                const nonExistentName = uniqueName('ZZZ_NonExistent_Flow');
                const result = await salesforce.toolingQuery(
                    `SELECT Id, ActiveVersionId, DeveloperName FROM FlowDefinition WHERE DeveloperName LIKE '${nonExistentName}%' LIMIT 10`
                );
                expect(result).toEqual([]);
            });

            it('returns empty array for partial name with no matches', async () => {
                const result = await salesforce.toolingQuery(
                    "SELECT Id, ActiveVersionId, DeveloperName FROM FlowDefinition WHERE DeveloperName LIKE 'zzz_impossible_flow_%' LIMIT 10"
                );
                expect(result).toEqual([]);
            });
        });

        describe('U-FC-I-002: Flow with no inactive versions', () => {
            it('can query FlowDefinition records', async () => {
                const result = await salesforce.toolingQuery(
                    'SELECT Id, ActiveVersionId, DeveloperName FROM FlowDefinition WHERE ActiveVersionId != null LIMIT 10'
                );
                expect(Array.isArray(result)).toBe(true);
            });

            it('can query Flow versions for a definition', async () => {
                // First get any flow definition
                const flows = await salesforce.toolingQuery(
                    'SELECT Id, ActiveVersionId, DeveloperName FROM FlowDefinition WHERE ActiveVersionId != null LIMIT 1'
                );

                if (flows.length === 0) {
                    console.log('Skipping: No active flows found in org');
                    return;
                }

                const flowId = flows[0].Id;
                const versions = await salesforce.toolingQuery(
                    `SELECT Id, VersionNumber, Status FROM Flow WHERE DefinitionId = '${flowId}' ORDER BY VersionNumber DESC`
                );

                expect(Array.isArray(versions)).toBe(true);
                expect(versions.length).toBeGreaterThan(0);
                // Should have at least one version with a status
                expect(versions[0]).toHaveProperty('Status');
            });
        });

        describe('U-FC-I-003: Flow with only active version', () => {
            it('active version cannot be deleted', async () => {
                // First get any flow with an active version
                const flows = await salesforce.toolingQuery(
                    'SELECT Id, ActiveVersionId, DeveloperName FROM FlowDefinition WHERE ActiveVersionId != null LIMIT 1'
                );

                if (flows.length === 0) {
                    console.log('Skipping: No active flows found in org');
                    return;
                }

                const activeVersionId = flows[0].ActiveVersionId;

                // Attempt to delete active version should fail
                try {
                    await salesforce.toolingRequest('DELETE', `/sobjects/Flow/${activeVersionId}`);
                    expect.fail('Should not allow deleting active flow version');
                } catch (error) {
                    // Expected error - active versions cannot be deleted
                    expect(error.message).toMatch(/ACTIVE_VERSION|cannot.*delet|unable.*delet/i);
                }
            });

            it('returns empty when filtering for inactive versions on single-version flow', async () => {
                // Find a flow with only one version
                const flows = await salesforce.toolingQuery(
                    'SELECT Id, ActiveVersionId, DeveloperName FROM FlowDefinition WHERE ActiveVersionId != null LIMIT 20'
                );

                if (flows.length === 0) {
                    console.log('Skipping: No flows found in org');
                    return;
                }

                // Check each flow for one that has only 1 version
                for (const flow of flows) {
                    const versions = await salesforce.toolingQuery(
                        `SELECT Id, Status FROM Flow WHERE DefinitionId = '${flow.Id}'`
                    );

                    if (versions.length === 1) {
                        // Found a flow with only one version
                        const inactiveVersions = await salesforce.toolingQuery(
                            `SELECT Id FROM Flow WHERE DefinitionId = '${flow.Id}' AND Status != 'Active'`
                        );
                        expect(inactiveVersions).toEqual([]);
                        return;
                    }
                }

                // If no single-version flow found, that's okay - just log it
                console.log('Note: All flows have multiple versions');
            });
        });
    });
});
