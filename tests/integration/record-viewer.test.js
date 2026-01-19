/**
 * Integration tests for Record Viewer
 *
 * Test IDs: RV-I-001 through RV-I-006
 * - RV-I-001: Missing URL parameters - Error message (skip - client-side)
 * - RV-I-002: Connection not found - Error message (skip - client-side)
 * - RV-I-003: Record not found - Error message
 * - RV-I-004: Save failure - Error message displayed
 * - RV-I-005: CORS error - Modal with proxy prompt (skip - needs browser)
 * - RV-I-006: Rich text XSS attempt - Content sanitized (skip - client-side DOMPurify)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { salesforce, TestDataManager, uniqueName } from './setup.js';

describe('Record Viewer Integration', () => {
    const testData = new TestDataManager();

    afterEach(async () => {
        await testData.cleanup();
    });

    // RV-I-001: Missing URL parameters - Error message (skip - client-side)
    // This is validated in the browser before any API calls

    // RV-I-002: Connection not found - Error message (skip - client-side)
    // This is validated in the browser before any API calls

    describe('RV-I-003: Record not found - Error message', () => {
        it('returns error for non-existent record ID', async () => {
            // Use a valid-looking but non-existent ID
            try {
                await salesforce.getRecord('Account', '001000000000000AAA');
                expect.fail('Should have thrown');
            } catch (e) {
                // Error message varies: "The requested resource does not exist" or "NOT_FOUND"
                expect(e.message).toMatch(/not exist|NOT_FOUND|resource/i);
            }
        });

        it('returns error for invalid object type', async () => {
            const accountId = await testData.create('Account', {
                Name: uniqueName('Integration')
            });

            try {
                await salesforce.getRecord('InvalidObject', accountId);
                expect.fail('Should have thrown');
            } catch (e) {
                // Error message varies: "NOT_FOUND", "INVALID_TYPE", or "does not exist"
                expect(e.message).toMatch(/INVALID_TYPE|NOT_FOUND|not exist|resource/i);
            }
        });

        it('returns error for malformed record ID', async () => {
            try {
                await salesforce.getRecord('Account', 'not-a-valid-id');
                expect.fail('Should have thrown');
            } catch (e) {
                // Error message varies: "MALFORMED_ID", "external id", or "invalid id"
                expect(e.message).toMatch(/MALFORMED_ID|NOT_FOUND|external id|invalid/i);
            }
        });
    });

    describe('RV-I-004: Save failure - Error message displayed', () => {
        it('returns validation error for invalid data type', async () => {
            const accountId = await testData.create('Account', {
                Name: uniqueName('Validation Test')
            });

            // Attempt to set AnnualRevenue to invalid string
            try {
                await salesforce.updateRecord('Account', accountId, {
                    AnnualRevenue: 'not-a-number'
                });
                expect.fail('Should have thrown');
            } catch (e) {
                expect(e.message.toLowerCase()).toMatch(/invalid|number/);
            }
        });

        it('returns error when required field is cleared', async () => {
            const accountId = await testData.create('Account', {
                Name: uniqueName('Required Field Test')
            });

            // Attempt to clear required Name field
            try {
                await salesforce.updateRecord('Account', accountId, {
                    Name: ''
                });
                expect.fail('Should have thrown');
            } catch (e) {
                // Error varies: "REQUIRED_FIELD_MISSING", "Required fields are missing"
                expect(e.message).toMatch(/REQUIRED|missing|invalid/i);
            }
        });

        it('returns error for read-only field update', async () => {
            const accountId = await testData.create('Account', {
                Name: uniqueName('Read-Only Test')
            });

            // Attempt to update CreatedDate (read-only)
            try {
                await salesforce.updateRecord('Account', accountId, {
                    CreatedDate: new Date().toISOString()
                });
                expect.fail('Should have thrown');
            } catch (e) {
                // Error varies: "INVALID_FIELD", "Unable to create/update"
                expect(e.message).toMatch(/INVALID_FIELD|Unable|not valid|create.*update/i);
            }
        });

        it('returns error for field length exceeded', async () => {
            const accountId = await testData.create('Account', {
                Name: uniqueName('Length Test')
            });

            // Attempt to set Name longer than max length (255)
            const longName = 'A'.repeat(300);
            try {
                await salesforce.updateRecord('Account', accountId, {
                    Name: longName
                });
                expect.fail('Should have thrown');
            } catch (e) {
                // Error varies: "STRING_TOO_LONG", "data value too large"
                expect(e.message).toMatch(/STRING_TOO_LONG|too long|too large|data value/i);
            }
        });

        it('returns error for non-existent record update', async () => {
            try {
                await salesforce.updateRecord('Account', '001000000000000AAA', {
                    Name: 'Test'
                });
                expect.fail('Should have thrown');
            } catch (e) {
                // Error varies: "NOT_FOUND", "invalid cross reference"
                expect(e.message).toMatch(/NOT_FOUND|cross reference|invalid/i);
            }
        });
    });

    // RV-I-005: CORS error - Modal with proxy prompt (skip - needs browser)
    // CORS errors only occur in browser context, cannot be tested via Node.js

    // RV-I-006: Rich text XSS attempt - Content sanitized (skip - client-side DOMPurify)
    // XSS sanitization is handled client-side by DOMPurify

    describe('Record Viewer API - Successful operations', () => {
        it('fetches record with all fields', async () => {
            const accountId = await testData.create('Account', {
                Name: uniqueName('Complete Record'),
                Industry: 'Technology',
                AnnualRevenue: 1000000
            });

            const record = await salesforce.getRecord('Account', accountId);

            expect(record.Id).toBe(accountId);
            expect(record.Name).toContain('Complete Record');
            expect(record.Industry).toBe('Technology');
            expect(record.AnnualRevenue).toBe(1000000);
        });

        it('fetches record with specific fields', async () => {
            const accountId = await testData.create('Account', {
                Name: uniqueName('Specific Fields'),
                Industry: 'Technology',
                Description: 'Test description'
            });

            const record = await salesforce.getRecord('Account', accountId, ['Id', 'Name', 'Industry']);

            expect(record.Id).toBe(accountId);
            expect(record.Name).toContain('Specific Fields');
            expect(record.Industry).toBe('Technology');
            // Description should not be returned when not requested
            expect(record.Description).toBeUndefined();
        });

        it('fetches object describe with field metadata', async () => {
            const describe = await salesforce.describeObject('Account');

            expect(describe.name).toBe('Account');
            expect(describe.fields).toBeInstanceOf(Array);
            expect(describe.fields.length).toBeGreaterThan(0);

            // Check for standard fields
            const nameField = describe.fields.find(f => f.name === 'Name');
            expect(nameField).toBeDefined();
            expect(nameField.type).toBe('string');
            expect(nameField.updateable).toBe(true);

            const idField = describe.fields.find(f => f.name === 'Id');
            expect(idField).toBeDefined();
            expect(idField.type).toBe('id');
            expect(idField.updateable).toBe(false);
        });

        it('updates single field successfully', async () => {
            const accountId = await testData.create('Account', {
                Name: uniqueName('Update Test')
            });

            await salesforce.updateRecord('Account', accountId, {
                Industry: 'Healthcare'
            });

            const updated = await salesforce.getRecord('Account', accountId);
            expect(updated.Industry).toBe('Healthcare');
        });

        it('updates multiple fields successfully', async () => {
            const accountId = await testData.create('Account', {
                Name: uniqueName('Multi Update')
            });

            await salesforce.updateRecord('Account', accountId, {
                Industry: 'Finance',
                AnnualRevenue: 5000000,
                Description: 'Updated description'
            });

            const updated = await salesforce.getRecord('Account', accountId);
            expect(updated.Industry).toBe('Finance');
            expect(updated.AnnualRevenue).toBe(5000000);
            expect(updated.Description).toBe('Updated description');
        });

        it('handles null field values', async () => {
            const accountId = await testData.create('Account', {
                Name: uniqueName('Null Test'),
                Industry: 'Technology'
            });

            // Clear optional field
            await salesforce.updateRecord('Account', accountId, {
                Industry: null
            });

            const updated = await salesforce.getRecord('Account', accountId);
            expect(updated.Industry).toBeNull();
        });

        it('handles boolean field values', async () => {
            // First get field describe to find an available boolean field
            const describe = await salesforce.describeObject('Account');
            const boolField = describe.fields.find(
                f => f.type === 'boolean' && f.updateable && f.name !== 'IsDeleted'
            );

            if (!boolField) {
                console.log('Skipping: No updateable boolean field found on Account');
                return;
            }

            const accountId = await testData.create('Account', {
                Name: uniqueName('BoolTest')
            });

            // Update the boolean field to true
            await salesforce.updateRecord('Account', accountId, {
                [boolField.name]: true
            });

            const updated = await salesforce.getRecord('Account', accountId);
            expect(updated[boolField.name]).toBe(true);
        });
    });
});
