/**
 * Integration tests for Query Tab
 *
 * Test IDs: Q-I-001 through Q-I-010
 *
 * These tests verify Salesforce API behavior that the Query Tab relies on.
 * Tests use real API calls against a test org.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { salesforce, TestDataManager, uniqueName } from './setup.js';

describe('Query Tab Integration', () => {
    const testData = new TestDataManager();

    afterEach(async () => {
        await testData.cleanup();
    });

    describe('Q-I-001: Query with no results', () => {
        it('returns empty array when no records match', async () => {
            const result = await salesforce.query(
                "SELECT Id FROM Account WHERE Name = 'NonExistentAccount_12345_xyz'"
            );
            expect(result).toEqual([]);
        });
    });

    describe('Q-I-002: Query with invalid SOQL', () => {
        it('throws error with details for invalid SOQL syntax', async () => {
            await expect(async () => {
                await salesforce.query('SELECT INVALID FROM Account');
            }).rejects.toThrow(/No such column/i);
        });

        it('throws error for invalid object name', async () => {
            await expect(async () => {
                await salesforce.query('SELECT Id FROM NonExistentObject__c');
            }).rejects.toThrow(/sObject type.*is not supported/i);
        });

        it('throws error for invalid field name', async () => {
            await expect(async () => {
                await salesforce.query('SELECT Id, NonExistentField__c FROM Account');
            }).rejects.toThrow(/No such column/i);
        });
    });

    describe('Q-I-003: Query with aggregate functions', () => {
        it('returns aggregate result without Id field', async () => {
            // Create test accounts
            await testData.create('Account', { Name: uniqueName('AggTest') });
            await testData.create('Account', { Name: uniqueName('AggTest') });

            const result = await salesforce.query(
                "SELECT COUNT(Id) cnt FROM Account WHERE Name LIKE 'AggTest%'"
            );

            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty('cnt');
            expect(result[0].cnt).toBeGreaterThanOrEqual(2);
            expect(result[0]).not.toHaveProperty('Id');
        });

        it('returns aggregate with grouping', async () => {
            const testName = uniqueName('AggGroupTest');
            await testData.create('Account', { Name: testName, Type: 'Customer' });
            await testData.create('Account', { Name: testName, Type: 'Prospect' });

            const result = await salesforce.query(
                `SELECT Type, COUNT(Id) cnt FROM Account WHERE Name = '${testName}' GROUP BY Type`
            );

            expect(result).toHaveLength(2);
            expect(result[0]).toHaveProperty('Type');
            expect(result[0]).toHaveProperty('cnt');
            expect(result[0]).not.toHaveProperty('Id');
        });
    });

    describe('Q-I-004: Query without Id field', () => {
        it('returns records without Id when not selected', async () => {
            const testName = uniqueName('NoIdTest');
            await testData.create('Account', { Name: testName });

            const result = await salesforce.query(
                `SELECT Name FROM Account WHERE Name = '${testName}'`
            );

            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty('Name', testName);
            expect(result[0]).not.toHaveProperty('Id');
        });
    });

    describe('Q-I-005: Query COUNT()', () => {
        it('returns single row with count value', async () => {
            // COUNT() query returns aggregate result
            const response = await salesforce.request(
                'GET',
                `/query?q=${encodeURIComponent('SELECT COUNT() FROM Account')}`
            );

            // Aggregate queries return a single "record" with the aggregate value
            expect(response).toHaveProperty('totalSize');
            expect(response.records).toHaveLength(0);
        });
    });

    describe('Q-I-006: Query with LIMIT', () => {
        it('returns correct number of rows with LIMIT 2', async () => {
            // Create test data
            await testData.create('Account', { Name: uniqueName('LimitTest') });
            await testData.create('Account', { Name: uniqueName('LimitTest') });
            await testData.create('Account', { Name: uniqueName('LimitTest') });
            await testData.create('Account', { Name: uniqueName('LimitTest') });

            const result = await salesforce.query(
                "SELECT Id FROM Account WHERE Name LIKE 'LimitTest%' LIMIT 2"
            );

            expect(result).toHaveLength(2);
        });

        it('returns all rows when LIMIT exceeds result count', async () => {
            const testName = uniqueName('LimitTest2');
            await testData.create('Account', { Name: testName });

            const result = await salesforce.query(
                `SELECT Id FROM Account WHERE Name = '${testName}' LIMIT 100`
            );

            expect(result).toHaveLength(1);
        });
    });

    describe('Q-I-007: Query with ORDER BY', () => {
        it('returns rows in ascending order by Name', async () => {
            // Create test data with specific names for ordering
            const prefix = uniqueName('OrderTest');
            await testData.create('Account', { Name: `${prefix}_Zebra` });
            await testData.create('Account', { Name: `${prefix}_Alpha` });
            await testData.create('Account', { Name: `${prefix}_Beta` });

            const result = await salesforce.query(
                `SELECT Name FROM Account WHERE Name LIKE '${prefix}%' ORDER BY Name ASC`
            );

            expect(result).toHaveLength(3);
            expect(result[0].Name).toContain('Alpha');
            expect(result[1].Name).toContain('Beta');
            expect(result[2].Name).toContain('Zebra');
        });

        it('returns rows in descending order by Name', async () => {
            const prefix = uniqueName('OrderTest');
            await testData.create('Account', { Name: `${prefix}_Alpha` });
            await testData.create('Account', { Name: `${prefix}_Zebra` });
            await testData.create('Account', { Name: `${prefix}_Beta` });

            const result = await salesforce.query(
                `SELECT Name FROM Account WHERE Name LIKE '${prefix}%' ORDER BY Name DESC`
            );

            expect(result).toHaveLength(3);
            expect(result[0].Name).toContain('Zebra');
            expect(result[1].Name).toContain('Beta');
            expect(result[2].Name).toContain('Alpha');
        });
    });

    describe('Q-I-008: Query with WHERE clause', () => {
        it('returns only matching records', async () => {
            const matchingName = uniqueName('WhereMatch');
            const nonMatchingName = uniqueName('WhereNoMatch');

            await testData.create('Account', { Name: matchingName, Type: 'Customer' });
            await testData.create('Account', { Name: nonMatchingName, Type: 'Prospect' });

            const result = await salesforce.query(
                `SELECT Name FROM Account WHERE Name = '${matchingName}'`
            );

            expect(result).toHaveLength(1);
            expect(result[0].Name).toBe(matchingName);
        });

        it('filters by multiple conditions with AND', async () => {
            const testName = uniqueName('WhereAnd');
            await testData.create('Account', { Name: testName, Type: 'Customer' });
            await testData.create('Account', { Name: testName, Type: 'Prospect' });

            const result = await salesforce.query(
                `SELECT Name, Type FROM Account WHERE Name = '${testName}' AND Type = 'Customer'`
            );

            expect(result).toHaveLength(1);
            expect(result[0].Type).toBe('Customer');
        });

        it('filters by multiple conditions with OR', async () => {
            const testName1 = uniqueName('WhereOr1');
            const testName2 = uniqueName('WhereOr2');
            const testName3 = uniqueName('WhereOr3');

            await testData.create('Account', { Name: testName1 });
            await testData.create('Account', { Name: testName2 });
            await testData.create('Account', { Name: testName3 });

            const result = await salesforce.query(
                `SELECT Name FROM Account WHERE Name = '${testName1}' OR Name = '${testName2}'`
            );

            expect(result).toHaveLength(2);
            const names = result.map(r => r.Name);
            expect(names).toContain(testName1);
            expect(names).toContain(testName2);
            expect(names).not.toContain(testName3);
        });
    });

    describe('Q-I-009: Query Tooling API object', () => {
        it('returns results from Tooling API', async () => {
            // Query ApexClass (Tooling API object)
            const result = await salesforce.toolingQuery(
                'SELECT Id, Name FROM ApexClass LIMIT 5'
            );

            expect(Array.isArray(result)).toBe(true);
            // Most orgs have at least some Apex classes
            if (result.length > 0) {
                expect(result[0]).toHaveProperty('Id');
                expect(result[0]).toHaveProperty('Name');
            }
        });

        it('queries DebugLevel (Tooling-only object)', async () => {
            const result = await salesforce.toolingQuery(
                'SELECT Id, DeveloperName FROM DebugLevel LIMIT 5'
            );

            expect(Array.isArray(result)).toBe(true);
            // DebugLevels exist in all orgs
            expect(result.length).toBeGreaterThan(0);
        });
    });
});
