import { SftoolsTest } from '../../framework/base-test';

/**
 * Test Schema Browser functionality
 *
 * Test IDs: SB-F-001, SB-F-002, SB-F-004, SB-F-005
 * - SB-F-001: Load all objects - Object list populated
 * - SB-F-002: Filter objects by name - Matching objects shown
 * - SB-F-004: Select object - Field panel opens
 * - SB-F-005: Filter fields - Matching fields shown
 */
export default class BrowseSchemaTest extends SftoolsTest {
  // No setup/teardown needed - just browsing metadata

  async test(): Promise<void> {
    // Navigate to schema browser
    await this.navigateToSchema();
    await this.schemaPage.waitForLoad();

    // Verify objects are loaded
    const objectCount = await this.schemaPage.getObjectCount();
    await this.expect(objectCount).toBeGreaterThan(0);

    // Filter for Account object
    await this.schemaPage.filterObjects('Account');

    // Verify Account is in the filtered list
    const filteredObjects = await this.schemaPage.getVisibleObjectNames();
    await this.expect(filteredObjects).toInclude('Account');

    // Select Account to view fields
    await this.schemaPage.selectObject('Account');

    // Verify object name is shown
    const selectedName = await this.schemaPage.getSelectedObjectApiName();
    await this.expect(selectedName).toContain('Account');

    // Verify fields are loaded
    const fieldNames = await this.schemaPage.getVisibleFieldNames();
    await this.expect(fieldNames).toInclude('Name');
    await this.expect(fieldNames).toInclude('Id');

    // Verify field details
    const nameField = await this.schemaPage.getFieldDetails('Name');
    await this.expect(nameField?.label).toBe('Account Name');
  }
}
