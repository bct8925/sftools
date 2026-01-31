import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToSchema,
    MockRouter,
} from '../../test-utils';

/**
 * Test Schema Browser external link icons
 *
 * Test IDs: SB-F-010, SB-F-011, SB-F-012
 * - SB-F-010: Object external links point to salesforce-setup.com
 * - SB-F-011: Field external links point to salesforce-setup.com
 * - SB-F-012: External link clicks don't trigger object/field selection
 */
describe('Schema Browser External Links', () => {
    beforeEach(async () => {
        const router = new MockRouter();

        router.onGlobalDescribe([
            { name: 'Account', label: 'Account', keyPrefix: '001', queryable: true },
            { name: 'Contact', label: 'Contact', keyPrefix: '003', queryable: true },
        ]);

        router.onDescribe('Account', [
            { name: 'Id', label: 'Record ID', type: 'id', updateable: false },
            { name: 'Name', label: 'Account Name', type: 'string', updateable: true },
        ]);

        await setupMocks(router);
    });

    it('SB-F-010: object external links use salesforce-setup.com domain', async () => {
        const { page } = getTestContext();
        const { schemaPage } = createPageObjects(page);

        await navigateToSchema();
        await schemaPage.waitForLoad();

        const href = await schemaPage.getObjectLinkHref('Account');
        expect(href).toContain('.salesforce-setup.com');
        expect(href).toContain('/lightning/setup/ObjectManager/Account/Details/view');
    });

    it('SB-F-011: field external links use salesforce-setup.com domain', async () => {
        const { page } = getTestContext();
        const { schemaPage } = createPageObjects(page);

        await navigateToSchema();
        await schemaPage.waitForLoad();
        await schemaPage.selectObject('Account');

        const href = await schemaPage.getFieldLinkHref('Name');
        expect(href).toContain('.salesforce-setup.com');
        expect(href).toContain(
            '/lightning/setup/ObjectManager/Account/FieldsAndRelationships/Name/view'
        );
    });

    it('SB-F-012: clicking external link does not change selected object', async () => {
        const { page } = getTestContext();
        const { schemaPage } = createPageObjects(page);

        await navigateToSchema();
        await schemaPage.waitForLoad();

        // Select Account first
        await schemaPage.selectObject('Account');
        const selectedBefore = await schemaPage.getSelectedObjectApiName();
        expect(selectedBefore).toContain('Account');

        // Click the Contact external link (stopPropagation should prevent selection)
        const contactItem = page.locator(
            '[data-testid="schema-object-item"][data-object-name="Contact"]'
        );
        const link = contactItem.locator('a[target="_blank"]');

        // Intercept navigation to prevent actual tab opening
        await page.context().route('**/*.salesforce-setup.com/**', route => route.abort());
        await link.click();

        // Selection should still be Account
        const selectedAfter = await schemaPage.getSelectedObjectApiName();
        expect(selectedAfter).toContain('Account');
    });
});
