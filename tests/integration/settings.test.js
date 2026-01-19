/**
 * Integration tests for Settings Tab
 *
 * Tests cover the underlying API functionality for settings.
 * Most Settings Tab behavior tests are frontend tests requiring browser interaction.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { salesforce, uniqueName } from './setup.js';

describe('Settings Tab Integration', () => {
    describe('Connection Validation', () => {
        it('validates credentials by fetching user info', async () => {
            const user = await salesforce.getCurrentUser();
            expect(user).toHaveProperty('id');
            expect(user).toHaveProperty('name');
        });

        it('can retrieve org identity info', async () => {
            const result = await salesforce.restRequest(
                '/services/data/v62.0/chatter/users/me',
                'GET'
            );
            expect(result.ok).toBe(true);
            expect(result.body).toHaveProperty('id');
        });

        it('returns API limits information', async () => {
            const result = await salesforce.restRequest(
                '/services/data/v62.0/limits',
                'GET'
            );
            expect(result.ok).toBe(true);
            expect(result.body).toHaveProperty('DailyApiRequests');
        });
    });

    describe('Describe Cache Operations', () => {
        it('can fetch and cache global describe', async () => {
            const describe1 = await salesforce.describeGlobal();
            expect(describe1).toHaveProperty('sobjects');
            expect(Array.isArray(describe1.sobjects)).toBe(true);

            // Second call should also work (testing API, not caching logic)
            const describe2 = await salesforce.describeGlobal();
            expect(describe2).toHaveProperty('sobjects');
        });

        it('can describe specific objects', async () => {
            const describe = await salesforce.describeObject('Account');
            expect(describe.name).toBe('Account');
            expect(describe.fields).toBeInstanceOf(Array);
            expect(describe.fields.length).toBeGreaterThan(0);
        });

        it('can describe multiple objects independently', async () => {
            const [account, contact] = await Promise.all([
                salesforce.describeObject('Account'),
                salesforce.describeObject('Contact')
            ]);

            expect(account.name).toBe('Account');
            expect(contact.name).toBe('Contact');
        });
    });

    describe('API Version Compatibility', () => {
        it('can query available API versions', async () => {
            const result = await salesforce.restRequest('/services/data', 'GET');
            expect(result.ok).toBe(true);
            expect(Array.isArray(result.body)).toBe(true);

            // Check that current version is available
            const v62 = result.body.find(v => v.version === '62.0');
            expect(v62).toBeDefined();
        });

        it('can access REST resources list', async () => {
            const result = await salesforce.restRequest('/services/data/v62.0', 'GET');
            expect(result.ok).toBe(true);
            expect(result.body).toHaveProperty('sobjects');
            expect(result.body).toHaveProperty('query');
            expect(result.body).toHaveProperty('tooling');
        });
    });
});
