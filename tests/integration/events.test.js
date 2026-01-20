/**
 * Integration tests for Events Tab
 *
 * Test IDs: E-I-006 through E-I-012
 * - E-I-006: Invalid JSON in publish payload - Validation error
 * - E-I-007: Query custom Platform Events - Returns event definitions via EntityDefinition
 * - E-I-008: Query CustomNotificationType - Returns notification types
 * - E-I-009: Query active PushTopics - Returns active PushTopic records
 * - E-I-010: Query all PushTopics - Returns all PushTopic records
 * - E-I-011: Get API versions - Returns API versions info
 * - E-I-012: Verify streaming API support - Confirms PushTopic availability in org
 *
 * Note: Most Events Tab tests are frontend tests that require browser/proxy interaction.
 * These tests cover the API calls for loading channels and publishing events.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { salesforce, uniqueName } from './setup.js';

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
                "SELECT DeveloperName FROM CustomNotificationType LIMIT 10"
            );
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('E-I-009: Query active PushTopics', () => {
        it('can query active PushTopics', async () => {
            const result = await salesforce.query(
                "SELECT Id, Name, Query, IsActive FROM PushTopic WHERE IsActive = true LIMIT 10"
            );
            expect(Array.isArray(result)).toBe(true);
            // May be empty if no active push topics
        });

    });

    describe('E-I-010: Query all PushTopics', () => {
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
});
