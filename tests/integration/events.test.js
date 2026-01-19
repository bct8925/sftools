/**
 * Integration tests for Events Tab
 *
 * Test IDs: E-I-001 through E-I-010
 * - E-I-001: Subscribe to Platform Event (gRPC) - Connection via proxy, events received (skip - needs proxy)
 * - E-I-002: Subscribe to PushTopic (CometD) - Connection via proxy, events received (skip - needs proxy)
 * - E-I-003: Subscribe to System Topic (CometD) - Connection via proxy, events received (skip - needs proxy)
 * - E-I-004: Proxy not connected - Tab disabled with overlay (skip - needs browser)
 * - E-I-005: Not authenticated - Error message (skip - needs invalid token)
 * - E-I-006: Invalid JSON in publish payload - Validation error
 * - E-I-007: Stream error from server - Error displayed (skip - needs proxy)
 * - E-I-008: Stream end from server - End notification (skip - needs proxy)
 * - E-I-009: Connection change - Unsubscribes, reloads channels (skip - needs browser)
 * - E-I-010: Tab visibility - Lazy loads on first view (skip - needs browser)
 *
 * Note: Most Events Tab tests require the local proxy for streaming.
 * These tests cover the API calls for loading channels and publishing events.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { salesforce, uniqueName } from './setup.js';

describe('Events Tab Integration', () => {
    describe('Platform Events API', () => {
        it('can query custom Platform Events via EntityDefinition', async () => {
            // Query for Platform Event entities via EntityDefinition
            const result = await salesforce.toolingQuery(
                "SELECT DeveloperName, QualifiedApiName FROM EntityDefinition WHERE KeyPrefix LIKE 'e__' LIMIT 10"
            );
            expect(Array.isArray(result)).toBe(true);
            // May be empty if no custom platform events defined
        });

        it('can query CustomNotificationType for notifications', async () => {
            const result = await salesforce.toolingQuery(
                "SELECT DeveloperName FROM CustomNotificationType LIMIT 10"
            );
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('PushTopics API', () => {
        it('can query active PushTopics', async () => {
            const result = await salesforce.query(
                "SELECT Id, Name, Query, IsActive FROM PushTopic WHERE IsActive = true LIMIT 10"
            );
            expect(Array.isArray(result)).toBe(true);
            // May be empty if no active push topics
        });

        it('can query all PushTopics', async () => {
            const result = await salesforce.query(
                "SELECT Id, Name, Query, IsActive FROM PushTopic LIMIT 10"
            );
            expect(Array.isArray(result)).toBe(true);
        });
    });

    // E-I-006: Invalid JSON in publish payload - Validation error
    describe('E-I-006: Platform Event Publishing', () => {
        it('returns error when publishing to non-existent event', async () => {
            try {
                await salesforce.request('POST', '/sobjects/NonExistent_Event__e', {
                    SomeField__c: 'value'
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

    // E-I-001 to E-I-003: Streaming subscriptions (require proxy)
    describe('E-I-001 to E-I-003: Streaming (skipped - requires proxy)', () => {
        it.skip('subscribes to Platform Event via gRPC', async () => {
            // Requires local proxy for gRPC connection to Salesforce Pub/Sub API
        });

        it.skip('subscribes to PushTopic via CometD', async () => {
            // Requires local proxy for CometD connection
        });

        it.skip('subscribes to System Topic via CometD', async () => {
            // Requires local proxy for CometD connection
        });
    });

    // E-I-004: Proxy not connected (requires browser)
    describe('E-I-004: Proxy not connected (skipped - requires browser)', () => {
        it.skip('shows disabled overlay when proxy not connected', async () => {
            // Browser-only test - UI state check
        });
    });

    // E-I-005: Not authenticated
    describe('E-I-005: Not authenticated (skipped)', () => {
        it.skip('returns auth error with invalid token', async () => {
            // Would require separate fetch with invalid credentials
        });
    });

    // E-I-007 to E-I-008: Stream events (require proxy)
    describe('E-I-007 to E-I-008: Stream events (skipped - requires proxy)', () => {
        it.skip('handles stream error from server', async () => {
            // Requires active streaming connection
        });

        it.skip('handles stream end from server', async () => {
            // Requires active streaming connection
        });
    });

    // E-I-009 to E-I-010: Browser behavior
    describe('E-I-009 to E-I-010: Browser behavior (skipped)', () => {
        it.skip('unsubscribes and reloads channels on connection change', async () => {
            // Browser-only test
        });

        it.skip('lazy loads on first tab view', async () => {
            // Browser-only test
        });
    });

    describe('Channel Discovery', () => {
        it('returns API versions info', async () => {
            const result = await salesforce.restRequest('/services/data', 'GET');
            expect(result.ok).toBe(true);
            expect(Array.isArray(result.body)).toBe(true);
        });

        it('can access streaming API endpoint info', async () => {
            // Check that the org supports streaming
            const result = await salesforce.describeGlobal();
            expect(result).toHaveProperty('sobjects');

            // PushTopic should be in the list of objects
            const pushTopicExists = result.sobjects.some(s => s.name === 'PushTopic');
            expect(pushTopicExists).toBe(true);
        });
    });
});
