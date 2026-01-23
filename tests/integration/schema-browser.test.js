/**
 * Integration tests for Schema Browser
 *
 * Test IDs: SB-I-002 through SB-I-009
 * - SB-I-002: Object describe error - Error message
 * - SB-I-003: Formula field not found - Error message
 * - SB-I-004: Save formula error - Error displayed
 * - SB-I-005: Describe standard object - Object and field metadata returned
 * - SB-I-006: Query CustomField records - Returns custom field list
 * - SB-I-007: Get field metadata from describe - Field label, type returned
 * - SB-I-008: Identify formula fields - Formula fields marked as calculated
 * - SB-I-009: Get global describe - All org objects returned
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { salesforce, TestDataManager, uniqueName } from './setup.js';

describe('Schema Browser Integration', () => {
    const testData = new TestDataManager();

    afterAll(async () => {
        await testData.cleanup();
    });

    describe('SB-I-002: Object describe error', () => {
        it('returns error for non-existent object', async () => {
            const nonExistentObject = 'NonExistentObject__c';

            try {
                await salesforce.describeObject(nonExistentObject);
                expect.fail('Should have thrown an error');
            } catch (error) {
                // Error message varies: "NOT_FOUND" or "The requested resource does not exist"
                expect(error.message).toContain('Salesforce API error');
            }
        });

        it('returns error for invalid object name', async () => {
            const invalidObject = 'Invalid Object Name';

            try {
                await salesforce.describeObject(invalidObject);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('Salesforce API error');
            }
        });

        it('returns error for malformed object name', async () => {
            const malformedObject = '!!!Invalid!!!';

            try {
                await salesforce.describeObject(malformedObject);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('Salesforce API error');
            }
        });
    });

    describe('SB-I-003: Formula field not found', () => {
        it('returns error for non-existent field query', async () => {
            const objectType = 'Account';

            try {
                await salesforce.toolingQuery(
                    `SELECT Id, FullName, Metadata FROM CustomField WHERE TableEnumOrId = '${objectType}' AND DeveloperName = 'NonExistentFormulaField'`
                );
                // Query succeeds but returns empty results
            } catch (error) {
                expect.fail('Query should not throw, but should return empty results');
            }

            // Test the actual getFormulaFieldMetadata function
            try {
                await salesforce.toolingRequest(
                    'GET',
                    `/query/?q=${encodeURIComponent(
                        `SELECT Id, FullName, Metadata FROM CustomField WHERE TableEnumOrId = '${objectType}' AND DeveloperName = 'NonExistentFormulaField'`
                    )}`
                );
                // Query will succeed but we need to check for empty records
            } catch (error) {
                // If this throws, it's a different error (API access, etc.)
                expect(error.message).not.toContain('NOT_FOUND');
            }
        });

        it('returns empty records for non-existent custom field', async () => {
            const objectType = 'Account';
            const response = await salesforce.toolingRequest(
                'GET',
                `/query/?q=${encodeURIComponent(
                    `SELECT Id, FullName, Metadata FROM CustomField WHERE TableEnumOrId = '${objectType}' AND DeveloperName = 'ThisFieldDoesNotExist'`
                )}`
            );

            expect(response.records).toBeDefined();
            expect(response.records.length).toBe(0);
        });

        it('returns error for invalid object in field query', async () => {
            const invalidObject = 'InvalidObject__c';

            try {
                const response = await salesforce.toolingRequest(
                    'GET',
                    `/query/?q=${encodeURIComponent(
                        `SELECT Id, FullName, Metadata FROM CustomField WHERE TableEnumOrId = '${invalidObject}' AND DeveloperName = 'SomeField'`
                    )}`
                );

                // Query may succeed but return empty records
                expect(response.records).toBeDefined();
            } catch (error) {
                // Some orgs may throw errors for invalid objects
                expect(error.message).toContain('Salesforce');
            }
        });
    });

    describe('SB-I-004: Save formula error', () => {
        it('returns error for invalid formula syntax', async () => {
            // We can't actually test formula updates without a real formula field
            // But we can test invalid field ID updates
            const invalidFieldId = '000000000000000';

            try {
                await salesforce.toolingRequest(
                    'PATCH',
                    `/sobjects/CustomField/${invalidFieldId}`,
                    {
                        Metadata: {
                            formula: 'Invalid Formula Syntax (((',
                        },
                    }
                );
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('Salesforce Tooling API error');
            }
        });

        it('returns error for non-existent field ID', async () => {
            const nonExistentFieldId = '00N000000000000AAA';

            try {
                await salesforce.toolingRequest(
                    'PATCH',
                    `/sobjects/CustomField/${nonExistentFieldId}`,
                    {
                        Metadata: {
                            formula: 'Name',
                        },
                    }
                );
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('Salesforce Tooling API error');
            }
        });

        it('returns error for malformed field ID', async () => {
            const malformedFieldId = 'not-a-valid-id';

            try {
                await salesforce.toolingRequest(
                    'PATCH',
                    `/sobjects/CustomField/${malformedFieldId}`,
                    {
                        Metadata: {
                            formula: 'Name',
                        },
                    }
                );
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('Salesforce Tooling API error');
            }
        });

        it('returns error when missing required metadata', async () => {
            // Query for a real custom field (if exists)
            const response = await salesforce.toolingRequest(
                'GET',
                `/query/?q=${encodeURIComponent(
                    `SELECT Id FROM CustomField WHERE TableEnumOrId = 'Account' LIMIT 1`
                )}`
            );

            if (response.records.length === 0) {
                // No custom fields to test with
                return;
            }

            const fieldId = response.records[0].Id;

            try {
                // Try to update without required metadata structure
                await salesforce.toolingRequest('PATCH', `/sobjects/CustomField/${fieldId}`, {
                    // Invalid - missing Metadata wrapper
                    formula: 'Name',
                });
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error.message).toContain('Salesforce Tooling API error');
            }
        });
    });

    describe('SB-I-005: Describe standard object', () => {
        it('successfully describes standard object', async () => {
            const describe = await salesforce.describeObject('Account');

            expect(describe).toBeDefined();
            expect(describe.name).toBe('Account');
            expect(describe.fields).toBeDefined();
            expect(describe.fields.length).toBeGreaterThan(0);
        });
    });

    describe('SB-I-006: Query CustomField records', () => {
        it('successfully queries CustomField records', async () => {
            const response = await salesforce.toolingQuery(
                `SELECT Id, DeveloperName, TableEnumOrId FROM CustomField WHERE TableEnumOrId = 'Account' LIMIT 5`
            );

            expect(response).toBeDefined();
            expect(Array.isArray(response)).toBe(true);
        });
    });

    describe('SB-I-007: Get field metadata from describe', () => {
        it('returns field metadata from describe', async () => {
            const describe = await salesforce.describeObject('Account');
            const nameField = describe.fields.find(f => f.name === 'Name');

            expect(nameField).toBeDefined();
            expect(nameField.label).toBe('Account Name');
            expect(nameField.type).toBeDefined();
        });
    });

    describe('SB-I-008: Identify formula fields', () => {
        it('identifies formula fields in describe', async () => {
            const describe = await salesforce.describeObject('Account');
            const formulaFields = describe.fields.filter(f => f.calculated === true);

            // May or may not have formula fields, just verify structure
            formulaFields.forEach(field => {
                expect(field.calculated).toBe(true);
                expect(field.name).toBeDefined();
            });
        });
    });

    describe('SB-I-009: Get global describe', () => {
        it('returns global describe with all objects', async () => {
            const global = await salesforce.describeGlobal();

            expect(global).toBeDefined();
            expect(global.sobjects).toBeDefined();
            expect(global.sobjects.length).toBeGreaterThan(0);

            // Check for standard objects
            const accountSobject = global.sobjects.find(obj => obj.name === 'Account');
            expect(accountSobject).toBeDefined();
            expect(accountSobject.label).toBeDefined();
        });
    });
});
