/**
 * Integration tests for Settings Tab
 *
 * Test IDs: S-I-001 through S-I-008
 * - S-I-001: Validate credentials - Fetches user info successfully
 * - S-I-002: Retrieve org identity info - Returns Chatter user info
 * - S-I-003: Get API limits - Returns API usage information
 * - S-I-004: Fetch global describe - Returns all sObjects
 * - S-I-005: Describe specific object - Returns field metadata
 * - S-I-006: Describe multiple objects - Returns metadata for each object
 * - S-I-007: Query API versions - Returns available API versions
 * - S-I-008: Access REST resources - Returns REST API resources list
 *
 * Most Settings Tab behavior tests are frontend tests requiring browser interaction.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { salesforce, uniqueName } from './setup.js';

describe('Settings Tab Integration', () => {
    describe('S-I-001: Validate credentials', () => {
        it('validates credentials by fetching user info', async () => {
            const user = await salesforce.getCurrentUser();
            expect(user).toHaveProperty('id');
            expect(user).toHaveProperty('name');
        });

    });

    describe('S-I-002: Retrieve org identity info', () => {
        it('can retrieve org identity info', async () => {
            const result = await salesforce.restRequest(
                '/services/data/v62.0/chatter/users/me',
                'GET'
            );
            expect(result.ok).toBe(true);
            expect(result.body).toHaveProperty('id');
        });

    });

    describe('S-I-003: Get API limits', () => {
        it('returns API limits information', async () => {
            const result = await salesforce.restRequest(
                '/services/data/v62.0/limits',
                'GET'
            );
            expect(result.ok).toBe(true);
            expect(result.body).toHaveProperty('DailyApiRequests');
        });
    });

    describe('S-I-004: Fetch global describe', () => {
        it('can fetch and cache global describe', async () => {
            const describe1 = await salesforce.describeGlobal();
            expect(describe1).toHaveProperty('sobjects');
            expect(Array.isArray(describe1.sobjects)).toBe(true);

            // Second call should also work (testing API, not caching logic)
            const describe2 = await salesforce.describeGlobal();
            expect(describe2).toHaveProperty('sobjects');
        });

    });

    describe('S-I-005: Describe specific object', () => {
        it('can describe specific objects', async () => {
            const describe = await salesforce.describeObject('Account');
            expect(describe.name).toBe('Account');
            expect(describe.fields).toBeInstanceOf(Array);
            expect(describe.fields.length).toBeGreaterThan(0);
        });

    });

    describe('S-I-006: Describe multiple objects', () => {
        it('can describe multiple objects independently', async () => {
            const [account, contact] = await Promise.all([
                salesforce.describeObject('Account'),
                salesforce.describeObject('Contact')
            ]);

            expect(account.name).toBe('Account');
            expect(contact.name).toBe('Contact');
        });
    });

    describe('S-I-007: Query API versions', () => {
        it('can query available API versions', async () => {
            const result = await salesforce.restRequest('/services/data', 'GET');
            expect(result.ok).toBe(true);
            expect(Array.isArray(result.body)).toBe(true);

            // Check that current version is available
            const v62 = result.body.find(v => v.version === '62.0');
            expect(v62).toBeDefined();
        });

    });

    describe('S-I-008: Access REST resources', () => {
        it('can access REST resources list', async () => {
            const result = await salesforce.restRequest('/services/data/v62.0', 'GET');
            expect(result.ok).toBe(true);
            expect(result.body).toHaveProperty('sobjects');
            expect(result.body).toHaveProperty('query');
            expect(result.body).toHaveProperty('tooling');
        });
    });
});
