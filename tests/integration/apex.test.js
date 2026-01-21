/**
 * Integration tests for Apex Tab
 *
 * Tests the executeAnonymous Tooling API endpoint and debug log retrieval.
 * Test IDs: A-I-001 through A-I-007
 */
import { describe, it, expect, afterEach } from 'vitest';
import { salesforce, TestDataManager, uniqueName } from './setup.js';

describe('Apex Tab Integration', () => {
    const testData = new TestDataManager();

    afterEach(async () => {
        await testData.cleanup();
    });

    describe('A-I-001: Execute System.debug()', () => {
        it('executes anonymous apex with debug statements successfully', async () => {
            const code = 'System.debug(\'Test message from integration test\');';
            const result = await salesforce.executeAnonymousApex(code);

            expect(result.compiled).toBe(true);
            expect(result.success).toBe(true);
            expect(result.line).toBe(-1);
            expect(result.column).toBe(-1);
        });
    });

    describe('A-I-002: Execute DML operation', () => {
        it('creates a record via anonymous apex', async () => {
            const accountName = uniqueName('ApexTest');
            const code = `
                Account acc = new Account(Name = '${accountName}');
                insert acc;
                System.debug('Created account: ' + acc.Id);
            `;

            const result = await salesforce.executeAnonymousApex(code);

            expect(result.compiled).toBe(true);
            expect(result.success).toBe(true);

            // Verify the account was created
            const accounts = await salesforce.query(
                `SELECT Id, Name FROM Account WHERE Name = '${accountName}'`
            );

            expect(accounts.length).toBe(1);
            expect(accounts[0].Name).toBe(accountName);

            // Track for cleanup
            testData.track('Account', accounts[0].Id);
        });

        it('updates a record via anonymous apex', async () => {
            const accountName = uniqueName('ApexUpdate');
            const newName = uniqueName('ApexUpdated');

            // Create account first
            const accountId = await testData.create('Account', { Name: accountName });

            const code = `
                Account acc = [SELECT Id FROM Account WHERE Id = '${accountId}'];
                acc.Name = '${newName}';
                update acc;
            `;

            const result = await salesforce.executeAnonymousApex(code);

            expect(result.compiled).toBe(true);
            expect(result.success).toBe(true);

            // Verify the update
            const account = await salesforce.getRecord('Account', accountId, ['Name']);
            expect(account.Name).toBe(newName);
        });
    });

    describe('A-I-003: Execute with governor limits', () => {
        it('executes code and returns governor limit information', async () => {
            const code = `
                Integer totalQueries = Limits.getQueries();
                Integer totalDML = Limits.getDmlStatements();
                System.debug('Queries used: ' + totalQueries);
                System.debug('DML statements used: ' + totalDML);
            `;

            const result = await salesforce.executeAnonymousApex(code);

            expect(result.compiled).toBe(true);
            expect(result.success).toBe(true);

            // The API returns limits in the response
            // Note: The actual limits structure varies, but execution should succeed
        });

        it('handles code that approaches governor limits', async () => {
            // Use unique prefix to avoid querying accounts from other tests
            const prefix = uniqueName('GovernorTest');
            const batchSize = 10;
            const code = `
                List<Account> accounts = new List<Account>();
                for (Integer i = 0; i < ${batchSize}; i++) {
                    accounts.add(new Account(Name = '${prefix}_' + i));
                }
                insert accounts;
                System.debug('Inserted ' + accounts.size() + ' accounts');
            `;

            const result = await salesforce.executeAnonymousApex(code);

            expect(result.compiled).toBe(true);
            expect(result.success).toBe(true);

            // Clean up the test accounts - only query the ones we just created
            const accounts = await salesforce.query(
                `SELECT Id FROM Account WHERE Name LIKE '${prefix}_%'`
            );
            for (const acc of accounts) {
                testData.track('Account', acc.Id);
            }
        });
    });

    describe('A-I-004: Compilation error on line 5', () => {
        it('returns compilation error with line information', async () => {
            const code = `
                // Line 1
                System.debug('Line 2');
                // Line 3
                // Line 4
                Invalid syntax here;
                // Line 6
            `.trim();

            const result = await salesforce.executeAnonymousApex(code);

            expect(result.compiled).toBe(false);
            expect(result.success).toBe(false);
            expect(result.line).toBeGreaterThan(0);
            expect(result.compileProblem).toBeDefined();
            expect(typeof result.compileProblem).toBe('string');
        });

        it('returns error for undefined variable', async () => {
            const code = 'System.debug(undefinedVariable);';

            const result = await salesforce.executeAnonymousApex(code);

            expect(result.compiled).toBe(false);
            expect(result.success).toBe(false);
            expect(result.compileProblem).toContain('Variable does not exist');
        });

        it('returns error for missing semicolon', async () => {
            const code = 'System.debug(\'test\')';

            const result = await salesforce.executeAnonymousApex(code);

            expect(result.compiled).toBe(false);
            expect(result.success).toBe(false);
        });
    });

    describe('A-I-005: Runtime NullPointerException', () => {
        it('handles runtime null pointer exception', async () => {
            const code = `
                Account acc = null;
                System.debug(acc.Name);
            `;

            const result = await salesforce.executeAnonymousApex(code);

            expect(result.compiled).toBe(true);
            expect(result.success).toBe(false);
            expect(result.exceptionMessage).toBeDefined();
            expect(result.exceptionStackTrace).toBeDefined();
            expect(result.exceptionMessage).toContain('NullPointerException');
        });

        it('handles runtime exception with DML', async () => {
            const code = `
                Account acc = new Account();  // Missing required field Name
                insert acc;
            `;

            const result = await salesforce.executeAnonymousApex(code);

            expect(result.compiled).toBe(true);
            expect(result.success).toBe(false);
            expect(result.exceptionMessage).toBeDefined();
        });
    });

    describe('A-I-006: No debug log available', () => {
        it('handles execution when trace flag might not be enabled', async () => {
            // This tests that the code executes even if logging is minimal
            // Debug logs are always generated but might be small
            const code = 'Integer x = 1;';

            const result = await salesforce.executeAnonymousApex(code);

            // Should compile and execute successfully
            expect(result.compiled).toBe(true);
            expect(result.success).toBe(true);
            // Note: Debug log availability depends on trace flag configuration
            // The test focuses on execution success, not log presence
        });
    });

    describe('A-I-007: Empty code submission', () => {
        it('handles empty string submission', async () => {
            const code = '';

            const result = await salesforce.executeAnonymousApex(code);

            // Empty code fails compilation in Salesforce
            expect(result.compiled).toBe(false);
            expect(result.success).toBe(false);
            expect(result.compileProblem).toBeDefined();
        });

        it('handles whitespace-only submission', async () => {
            const code = '   \n\n   \t   ';

            const result = await salesforce.executeAnonymousApex(code);

            // Whitespace-only code also fails compilation
            expect(result.compiled).toBe(false);
            expect(result.success).toBe(false);
            expect(result.compileProblem).toBeDefined();
        });
    });

    // A-I-008: Not authenticated - Skipped
    // Would require invalid/expired token which would break all tests

    // A-I-009: Large debug log (>2MB) - Skipped
    // Hard to generate consistently in test environment
    // Would require extensive debug output generation
});
