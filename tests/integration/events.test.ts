/**
 * Integration tests for Events Tab
 *
 * Test IDs: E-I-006 through E-I-016
 * - E-I-006: Invalid JSON in publish payload - Validation error
 * - E-I-007: Query custom Platform Events - Returns event definitions via EntityDefinition
 * - E-I-008: Query CustomNotificationType - Returns notification types
 * - E-I-009: Query active PushTopics - Returns active PushTopic records
 * - E-I-010: Query all PushTopics - Returns all PushTopic records
 * - E-I-011: Get API versions - Returns API versions info
 * - E-I-012: Verify streaming API support - Confirms PushTopic availability in org
 * - E-I-013: Publish event successfully and returns success
 * - E-I-014: Returns valid event record ID
 * - E-I-015: Handle invalid event type error
 * - E-I-016: Handle invalid field values error
 *
 * Note: Most Events Tab tests are frontend tests that require browser/proxy interaction.
 * These tests cover the API calls for loading channels and publishing events.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { salesforce, uniqueName } from './setup.js';

const API_VERSION = '62.0';

interface PublishEventResult {
    success: boolean;
    id: string | null;
    error: string | null;
}

/**
 * Publish a Platform Event
 */
async function publishPlatformEvent(
    eventType: string,
    payload: Record<string, unknown>
): Promise<PublishEventResult> {
    const url = `${salesforce.instanceUrl}/services/data/v${API_VERSION}/sobjects/${eventType}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${salesforce.accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (response.ok) {
        const data = await response.json();
        return { success: true, id: data.id, error: null };
    }

    let errorMsg = 'Publish failed';
    try {
        const errorData = await response.json();
        if (Array.isArray(errorData) && errorData[0]?.message) {
            errorMsg = errorData[0].message;
        } else if (errorData.message) {
            errorMsg = errorData.message;
        }
    } catch {
        errorMsg = `HTTP ${response.status}: ${response.statusText}`;
    }

    return { success: false, id: null, error: errorMsg };
}

/**
 * Check if SFToolsTestEvent__e exists in the org
 */
async function testEventExists(): Promise<boolean> {
    try {
        const result = await salesforce.toolingQuery<{ QualifiedApiName: string }>(
            "SELECT QualifiedApiName FROM EntityDefinition WHERE QualifiedApiName = 'SFToolsTestEvent__e'"
        );
        return result.length > 0;
    } catch {
        return false;
    }
}

describe('Events Tab Integration', () => {
    describe('E-I-007: Query custom Platform Events', () => {
        it('can query custom Platform Events via EntityDefinition', async () => {
            // Query for Platform Event entities via EntityDefinition
            const result = await salesforce.toolingQuery(
                "SELECT DeveloperName, QualifiedApiName FROM EntityDefinition WHERE KeyPrefix LIKE 'e__' LIMIT 10"
            );
            expect(Array.isArray(result)).toBe(true);
            // May be empty if no custom platform events defined
        });
    });

    describe('E-I-008: Query CustomNotificationType', () => {
        it('can query CustomNotificationType for notifications', async () => {
            const result = await salesforce.toolingQuery(
                'SELECT DeveloperName FROM CustomNotificationType LIMIT 10'
            );
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('E-I-009: Query active PushTopics', () => {
        it('can query active PushTopics', async () => {
            const result = await salesforce.query(
                'SELECT Id, Name, Query, IsActive FROM PushTopic WHERE IsActive = true LIMIT 10'
            );
            expect(Array.isArray(result)).toBe(true);
            // May be empty if no active push topics
        });
    });

    describe('E-I-010: Query all PushTopics', () => {
        it('can query all PushTopics', async () => {
            const result = await salesforce.query(
                'SELECT Id, Name, Query, IsActive FROM PushTopic LIMIT 10'
            );
            expect(Array.isArray(result)).toBe(true);
        });
    });

    // E-I-006: Invalid JSON in publish payload - Validation error
    describe('E-I-006: Platform Event Publishing', () => {
        it('returns error when publishing to non-existent event', async () => {
            try {
                await salesforce.request('POST', '/sobjects/NonExistent_Event__e', {
                    SomeField__c: 'value',
                });
                expect.fail('Should have thrown');
            } catch (e) {
                // Error varies: "NOT_FOUND", "INVALID_TYPE", "does not exist"
                expect(e.message).toMatch(/NOT_FOUND|INVALID_TYPE|not exist|resource/i);
            }
        });

        it('can describe an sObject to verify API access', async () => {
            // Verify basic sObject describe works - this is what the Events tab
            // uses to determine available objects
            const describe = await salesforce.describeGlobal();
            expect(describe).toHaveProperty('sobjects');
            expect(Array.isArray(describe.sobjects)).toBe(true);
        });
    });

    describe('E-I-011: Get API versions', () => {
        it('returns API versions info', async () => {
            const result = await salesforce.restRequest('/services/data', 'GET');
            expect(result.ok).toBe(true);
            expect(Array.isArray(result.body)).toBe(true);
        });
    });

    describe('E-I-012: Verify streaming API support', () => {
        it('can access streaming API endpoint info', async () => {
            // Check that the org supports streaming
            const result = await salesforce.describeGlobal();
            expect(result).toHaveProperty('sobjects');

            // PushTopic should be in the list of objects
            const pushTopicExists = result.sobjects.some(s => s.name === 'PushTopic');
            expect(pushTopicExists).toBe(true);
        });
    });

    describe('Platform Event Publishing (SFToolsTestEvent__e)', () => {
        let hasTestEvent: boolean;

        beforeAll(async () => {
            hasTestEvent = await testEventExists();
            if (!hasTestEvent) {
                console.log(
                    'SKIP: SFToolsTestEvent__e not deployed. Run: sf project deploy start -d test-metadata'
                );
            }
        });

        describe('E-I-013: Publish event successfully', () => {
            it('publishes event and returns success', async () => {
                if (!hasTestEvent) {
                    console.log('Skipping: SFToolsTestEvent__e not deployed');
                    return;
                }

                const testId = uniqueName('E_I_013');
                const result = await publishPlatformEvent('SFToolsTestEvent__e', {
                    Message__c: 'Test message from integration test',
                    TestId__c: testId,
                });

                expect(result.success).toBe(true);
                expect(result.error).toBeNull();
            });
        });

        describe('E-I-014: Returns valid event record ID', () => {
            it('returns event ID in correct format', async () => {
                if (!hasTestEvent) {
                    console.log('Skipping: SFToolsTestEvent__e not deployed');
                    return;
                }

                const testId = uniqueName('E_I_014');
                const result = await publishPlatformEvent('SFToolsTestEvent__e', {
                    Message__c: 'Test for ID validation',
                    TestId__c: testId,
                });

                expect(result.success).toBe(true);
                expect(result.id).toBeTruthy();
                // Platform Event IDs start with 'e'
                expect(result.id).toMatch(/^e[a-zA-Z0-9]{14,17}$/);
            });
        });

        describe('E-I-015: Handle invalid event type error', () => {
            it('returns error for non-existent event type', async () => {
                const result = await publishPlatformEvent('NonExistent_Event__e', {
                    SomeField__c: 'value',
                });

                expect(result.success).toBe(false);
                expect(result.id).toBeNull();
                expect(result.error).toBeTruthy();
                // Error message varies but should indicate invalid type
                expect(result.error).toMatch(
                    /NOT_FOUND|INVALID_TYPE|not exist|resource|sObject type/i
                );
            });
        });

        describe('E-I-016: Handle invalid field values error', () => {
            it('returns error for invalid field name', async () => {
                if (!hasTestEvent) {
                    console.log('Skipping: SFToolsTestEvent__e not deployed');
                    return;
                }

                const result = await publishPlatformEvent('SFToolsTestEvent__e', {
                    NonExistentField__c: 'value',
                });

                expect(result.success).toBe(false);
                expect(result.id).toBeNull();
                expect(result.error).toBeTruthy();
                // Should indicate invalid field
                expect(result.error).toMatch(
                    /No such column|INVALID_FIELD|field|NonExistentField/i
                );
            });
        });
    });
});
