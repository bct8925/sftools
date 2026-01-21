import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';

/**
 * Test query edit mode functionality
 *
 * Test IDs: Q-F-008, Q-F-009, Q-F-010, Q-F-011
 * - Q-F-008: Toggle edit mode - Checkbox enables edit mode, fields become editable
 * - Q-F-009: Edit field value - Input accepts changes, cell marked as modified
 * - Q-F-010: Save changes - PATCH request succeeds, changes persist in Salesforce
 * - Q-F-011: Clear changes - Clears pending changes, cells return to original values
 */
export default class QueryEditModeTest extends SftoolsTest {
  configureMocks() {
    const router = new MockRouter();

    // Mock initial query response with entityName
    router.onQuery(
      /\/query/,
      [{
        Id: '001MOCKACCOUNT01',
        Name: 'Original Name',
        attributes: { type: 'Account', url: '/services/data/v59.0/sobjects/Account/001MOCKACCOUNT01' }
      }],
      [
        { columnName: 'Id', displayName: 'Id', aggregate: false },
        { columnName: 'Name', displayName: 'Name', aggregate: false }
      ],
      'Account'
    );

    // Mock object describe for field metadata (needed for edit mode)
    router.onDescribe('Account', [
      { name: 'Id', label: 'Account ID', type: 'id', updateable: false, calculated: false },
      { name: 'Name', label: 'Account Name', type: 'string', updateable: true, calculated: false }
    ]);

    // Mock update success
    router.onUpdateRecord('Account', '001MOCKACCOUNT01');

    return router;
  }

  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to Query tab
    await this.queryTab.navigateTo();

    // Execute query
    const query = `SELECT Id, Name FROM Account LIMIT 10`;
    await this.queryTab.executeQuery(query);

    // Verify query succeeded
    const status = await this.queryTab.getStatus();
    await this.expect(status.type).toBe('success');

    // @test Q-F-008: Toggle edit mode on
    await this.queryTab.enableEditMode();

    // Verify edit mode is enabled
    const editingEnabled = await this.queryTab.editingCheckbox.isChecked();
    await this.expect(editingEnabled).toBe(true);

    // @test Q-F-009: Edit a field value
    const newName = `Updated ${Date.now()}`;
    await this.queryTab.editCell(0, 'Name', newName);

    // Verify at least one change is tracked
    const changesCount = await this.queryTab.getChangesCount();
    await this.expect(changesCount).toBeGreaterThan(0);

    // @test Q-F-010: Save changes
    await this.queryTab.saveChanges();

    // Verify save succeeded
    const saveStatus = await this.queryTab.getStatus();
    await this.expect(saveStatus.type).toBe('success');

    // @test Q-F-011: Edit again and clear changes
    const anotherName = `Another Update ${Date.now()}`;
    await this.queryTab.editCell(0, 'Name', anotherName);

    // Verify change is tracked
    const changesBeforeClear = await this.queryTab.getChangesCount();
    await this.expect(changesBeforeClear).toBeGreaterThan(0);

    // Clear changes
    await this.queryTab.clearChanges();

    // Verify no pending changes
    const changesAfterClear = await this.queryTab.getChangesCount();
    await this.expect(changesAfterClear).toBe(0);
  }
}
