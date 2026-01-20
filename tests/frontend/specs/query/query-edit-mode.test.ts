import { SftoolsTest } from '../../framework/base-test';

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
  private testAccountId: string = '';
  private originalName: string = '';

  async setup(): Promise<void> {
    // Create a test account with a known name
    this.originalName = `Playwright Edit Test ${Date.now()}`;
    this.testAccountId = await this.salesforce.createAccount(this.originalName);
  }

  async teardown(): Promise<void> {
    // Clean up test account
    if (this.testAccountId) {
      await this.salesforce.deleteRecord('Account', this.testAccountId);
    }
  }

  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to Query tab
    await this.queryTab.navigateTo();

    // Execute query for our test account
    const query = `SELECT Id, Name FROM Account WHERE Id = '${this.testAccountId}'`;
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

    // Verify the change persisted in Salesforce via API
    const records = await this.salesforce.query(
      `SELECT Name FROM Account WHERE Id = '${this.testAccountId}'`
    );
    await this.expect(records[0].Name).toBe(newName);

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

    // Verify the previous save is still persisted (not reverted)
    const finalRecords = await this.salesforce.query(
      `SELECT Name FROM Account WHERE Id = '${this.testAccountId}'`
    );
    await this.expect(finalRecords[0].Name).toBe(newName);
  }
}
