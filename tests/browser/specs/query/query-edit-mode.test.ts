/**
 * Test query edit mode functionality
 *
 * Test IDs: Q-F-008, Q-F-009, Q-F-010, Q-F-011
 * - Q-F-008: Toggle edit mode - Checkbox enables edit mode, fields become editable
 * - Q-F-009: Edit field value - Input accepts changes, cell marked as modified
 * - Q-F-010: Save changes - PATCH request succeeds, changes persist in Salesforce
 * - Q-F-011: Clear changes - Clears pending changes, cells return to original values
 */

import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

describe('Q-F-008-011: Query Edit Mode', () => {
    beforeEach(async () => {
        const router = new MockRouter();

        // Mock initial query response with entityName
        router.onQuery(
            /\/query/,
            [
                {
                    Id: '001MOCKACCOUNT01',
                    Name: 'Original Name',
                    attributes: {
                        type: 'Account',
                        url: '/services/data/v59.0/sobjects/Account/001MOCKACCOUNT01',
                    },
                },
            ],
            [
                { columnName: 'Id', displayName: 'Id', aggregate: false },
                { columnName: 'Name', displayName: 'Name', aggregate: false },
            ],
            'Account'
        );

        // Mock object describe for field metadata (needed for edit mode)
        router.onDescribe('Account', [
            { name: 'Id', label: 'Account ID', type: 'id', updateable: false, calculated: false },
            {
                name: 'Name',
                label: 'Account Name',
                type: 'string',
                updateable: true,
                calculated: false,
            },
        ]);

        // Mock update success
        router.onUpdateRecord('Account', '001MOCKACCOUNT01');

        await setupMocks(router);
    });

    it('enables edit mode, edits field, saves changes, and clears changes', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        // Navigate to extension
        await navigateToExtension();

        // Navigate to Query tab
        await queryTab.navigateTo();

        // Execute query
        const query = `SELECT Id, Name FROM Account LIMIT 10`;
        await queryTab.executeQuery(query);

        // Verify query succeeded
        const status = await queryTab.getStatus();
        expect(status.type).toBe('success');

        // @test Q-F-008: Toggle edit mode on
        await queryTab.enableEditMode();

        // Verify edit mode is enabled
        const editingEnabled = await queryTab.editingCheckbox.isChecked();
        expect(editingEnabled).toBe(true);

        // @test Q-F-009: Edit a field value
        const newName = `Updated ${Date.now()}`;
        await queryTab.editCell(0, 'Name', newName);

        // Verify at least one change is tracked
        const changesCount = await queryTab.getChangesCount();
        expect(changesCount).toBeGreaterThan(0);

        // @test Q-F-010: Save changes
        await queryTab.saveChanges();

        // Verify save succeeded
        const saveStatus = await queryTab.getStatus();
        expect(saveStatus.type).toBe('success');

        // @test Q-F-011: Edit again and clear changes
        const anotherName = `Another Update ${Date.now()}`;
        await queryTab.editCell(0, 'Name', anotherName);

        // Verify change is tracked
        const changesBeforeClear = await queryTab.getChangesCount();
        expect(changesBeforeClear).toBeGreaterThan(0);

        // Clear changes
        await queryTab.clearChanges();

        // Verify no pending changes
        const changesAfterClear = await queryTab.getChangesCount();
        expect(changesAfterClear).toBe(0);
    });
});
