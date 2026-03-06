/**
 * Test query delete records functionality
 *
 * Test IDs: Q-F-036, Q-F-037, Q-F-038, Q-F-039
 * - Q-F-036: Checkboxes appear in edit mode - visible when editing, hidden otherwise
 * - Q-F-037: Select individual records - toggle checkboxes, verify selected count in delete button
 * - Q-F-038: Select all / deselect all - select-all checkbox toggles all rows
 * - Q-F-039: Delete selected records - selected record removed from table, count decremented
 */

import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';
import { QueryEditableResultsScenario } from '../../../shared/mocks/mock-scenarios.js';

const ACCOUNT_FIELDS = [
    { name: 'Id', label: 'Account ID', type: 'id', updateable: false, calculated: false },
    { name: 'Name', label: 'Account Name', type: 'string', updateable: true, calculated: false },
    { name: 'Phone', label: 'Phone', type: 'phone', updateable: true, calculated: false },
    {
        name: 'AnnualRevenue',
        label: 'Annual Revenue',
        type: 'currency',
        updateable: true,
        calculated: false,
    },
    { name: 'Type', label: 'Type', type: 'picklist', updateable: true, calculated: false },
];

function buildRouter() {
    const router = new MockRouter();
    router.usePreset(QueryEditableResultsScenario);
    router.onDescribe('Account', ACCOUNT_FIELDS);
    router.onDeleteRecord('Account', '001MOCKACCOUNT01');
    router.onDeleteRecord('Account', '001MOCKACCOUNT02');
    return router;
}

describe('Q-F-036-039: Query Delete Records', () => {
    beforeEach(async () => {
        await setupMocks(buildRouter());
    });

    it('Q-F-036: checkboxes appear in edit mode only', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        await navigateToExtension();
        await queryTab.navigateTo();
        await queryTab.executeQuery('SELECT Id, Name, Phone, AnnualRevenue, Type FROM Account');

        // No checkboxes before edit mode
        const checkboxesBefore = await queryTab.getRowCheckboxes();
        expect(checkboxesBefore).toBe(0);

        // Enable edit mode — checkboxes appear
        await queryTab.enableEditMode();

        const checkboxesAfter = await queryTab.getRowCheckboxes();
        expect(checkboxesAfter).toBe(2);

        const selectAll = queryTab.getSelectAllCheckbox();
        expect(await selectAll.isVisible()).toBe(true);
    });

    it('Q-F-037: select individual records updates delete button label', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        await navigateToExtension();
        await queryTab.navigateTo();
        await queryTab.executeQuery('SELECT Id, Name, Phone, AnnualRevenue, Type FROM Account');
        await queryTab.enableEditMode();

        // Select first row
        await queryTab.toggleRowCheckbox(0);
        const textAfterFirst = await queryTab.getDeleteButtonText();
        expect(textAfterFirst).toContain('1');

        // Select second row
        await queryTab.toggleRowCheckbox(1);
        const textAfterSecond = await queryTab.getDeleteButtonText();
        expect(textAfterSecond).toContain('2');
    });

    it('Q-F-038: select all / deselect all toggles all rows', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        await navigateToExtension();
        await queryTab.navigateTo();
        await queryTab.executeQuery('SELECT Id, Name, Phone, AnnualRevenue, Type FROM Account');
        await queryTab.enableEditMode();

        const selectAll = queryTab.getSelectAllCheckbox();

        // Click select-all — all rows selected
        await selectAll.click();
        const selectedAfterSelectAll = await queryTab.getSelectedRowCount();
        expect(selectedAfterSelectAll).toBe(2);

        // Click select-all again — all rows deselected
        await selectAll.click();
        const selectedAfterDeselect = await queryTab.getSelectedRowCount();
        expect(selectedAfterDeselect).toBe(0);
    });

    it('Q-F-039: delete selected record removes row and decrements count', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        await navigateToExtension();
        await queryTab.navigateTo();
        await queryTab.executeQuery('SELECT Id, Name, Phone, AnnualRevenue, Type FROM Account');
        await queryTab.enableEditMode();

        // Select first row
        await queryTab.toggleRowCheckbox(0);

        // Stub window.confirm to return true
        await page.evaluate(() => {
            window.confirm = () => true;
        });

        // Click delete
        await queryTab.deleteSelected();

        // Wait for operation to complete
        await page.waitForFunction(
            () => {
                const loading = document.querySelector('[role="alert"][data-type="loading"]');
                if (loading) return false;
                const result = document.querySelector(
                    '[role="alert"][data-type="success"], [role="alert"][data-type="error"]'
                );
                return result !== null;
            },
            { timeout: 15000 }
        );

        // Table should now have 1 row
        const rowCount = await queryTab.getResultsRowCount();
        expect(rowCount).toBe(1);

        // Status should show "Deleted" success message
        const status = await queryTab.getStatus();
        expect(status.type).toBe('success');
        expect(status.text).toMatch(/deleted/i);
    });
});
