import { SftoolsTest } from '../../framework/base-test';
import type { Download } from 'playwright';

/**
 * Test CSV export functionality
 *
 * @test Q-F-012
 *
 * Test ID: Q-F-012
 * - Q-F-012: Export to CSV button triggers download with correct data
 */
export default class QueryExportTest extends SftoolsTest {
  private accountIds: string[] = [];
  private testTimestamp: string = '';
  private readonly RECORD_COUNT = 5;

  async setup(): Promise<void> {
    // Generate unique timestamp for this test run
    this.testTimestamp = Date.now().toString();

    // Create test accounts
    const promises = [];
    for (let i = 0; i < this.RECORD_COUNT; i++) {
      const name = `Export Test ${this.testTimestamp}-${i}`;
      promises.push(
        this.salesforce.createAccount(name, {
          BillingCity: `City ${i}`,
          BillingState: 'CA',
        })
      );
    }

    this.accountIds = await Promise.all(promises);
  }

  async teardown(): Promise<void> {
    // Clean up test accounts
    await Promise.all(
      this.accountIds.map(id => this.salesforce.deleteRecord('Account', id).catch(() => {}))
    );
    this.accountIds = [];
  }

  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to Query tab
    await this.queryTab.navigateTo();

    // Execute query for test accounts
    const query = `SELECT Id, Name, BillingCity, BillingState FROM Account WHERE Name LIKE 'Export Test ${this.testTimestamp}%' ORDER BY Name`;
    await this.queryTab.executeQuery(query);

    // Verify query succeeded
    const status = await this.queryTab.getStatus();
    await this.expect(status.type).toBe('success');

    const count = await this.queryTab.getResultsCount();
    await this.expect(count).toBe(this.RECORD_COUNT);

    // Set up download listener before clicking export
    const downloadPromise = this.page.waitForEvent('download', { timeout: 10000 });

    // Click export CSV button
    await this.queryTab.exportCsv();

    // Wait for download to complete
    const download: Download = await downloadPromise;
    const filename = download.suggestedFilename();

    // Verify filename is CSV
    await this.expect(filename).toContain('.csv');

    // Read the downloaded CSV content
    const csvPath = await download.path();
    if (!csvPath) {
      throw new Error('Download path is null');
    }

    const fs = await import('fs/promises');
    const csvContent = await fs.readFile(csvPath, 'utf-8');

    // Parse CSV to verify content
    const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
    const recordCount = lines.length - 1; // Subtract header row

    // Verify all records are present
    await this.expect(recordCount).toBe(this.RECORD_COUNT);

    // Verify CSV has expected columns
    const header = lines[0];
    await this.expect(header).toContain('Id');
    await this.expect(header).toContain('Name');
    await this.expect(header).toContain('BillingCity');
    await this.expect(header).toContain('BillingState');

    // Verify at least one data row contains expected values
    const dataLine = lines[1];
    await this.expect(dataLine).toContain(`Export Test ${this.testTimestamp}`);
    await this.expect(dataLine).toContain('CA');
  }
}
