import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';

/**
 * Test debug log filtering
 *
 * Test IDs: A-F-006, A-F-007
 * - A-F-006: Filter debug log - Search filters visible lines
 * - A-F-007: Clear debug log filter - All lines visible again
 */
export default class ApexLogFilterTest extends SftoolsTest {
  configureMocks() {
    const router = new MockRouter();

    // Mock successful Apex execution with multi-line debug log
    const mockLog = `USER_DEBUG|[1]|DEBUG|First debug message
USER_DEBUG|[2]|DEBUG|Second debug message
USER_DEBUG|[3]|DEBUG|Third debug message with UNIQUE keyword
USER_DEBUG|[4]|DEBUG|Fourth debug message
USER_DEBUG|[6]|DEBUG|Calculation result: 30`;

    router.onApexExecute(true, true, mockLog);

    // Mock ApexLog query (returns the log record metadata)
    router.addRoute(/\/tooling\/query.*ApexLog/, {
      done: true,
      totalSize: 1,
      records: [{
        Id: '07LMOCKLOG002',
        LogLength: 500,
        Status: 'Success'
      }]
    }, 'GET');

    // Mock ApexLog body retrieval (returns the actual log content as plain text)
    router.addRoute(/\/tooling\/sobjects\/ApexLog\/07LMOCKLOG002\/Body/, {
      data: mockLog,
      contentType: 'text/plain'
    }, 'GET');

    return router;
  }

  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to Apex tab
    await this.apexTab.navigateTo();

    // Set Apex code with multiple distinct debug statements
    const apexCode = `
      System.debug('First debug message');
      System.debug('Second debug message');
      System.debug('Third debug message with UNIQUE keyword');
      System.debug('Fourth debug message');
      Integer result = 10 + 20;
      System.debug('Calculation result: ' + result);
    `;
    await this.apexTab.setCode(apexCode);

    // Execute (will use mocked response)
    await this.apexTab.execute();

    // Verify execution succeeded
    const status = await this.apexTab.getStatus();
    await this.expect(status.success).toBe(true);

    // Get full debug log content
    const fullLogContent = await this.apexTab.getLogContent();

    // Verify all debug statements are in the log
    await this.expect(fullLogContent).toContain('First debug message');
    await this.expect(fullLogContent).toContain('Second debug message');
    await this.expect(fullLogContent).toContain('UNIQUE keyword');
    await this.expect(fullLogContent).toContain('Fourth debug message');
    await this.expect(fullLogContent).toContain('Calculation result: 30');

    // Count total lines
    const totalLines = fullLogContent.split('\n').length;

    // Test A-F-006: Filter debug log
    // Filter by a unique keyword that appears in only one line
    await this.apexTab.filterLog('UNIQUE');

    // Get filtered content
    const filteredContent = await this.apexTab.getLogContent();
    const filteredLines = filteredContent.split('\n').length;

    // Verify filtered content contains the matching line
    await this.expect(filteredContent).toContain('UNIQUE keyword');

    // Verify filtered content does NOT contain non-matching lines
    await this.expect(filteredContent).toNotContain('First debug message');
    await this.expect(filteredContent).toNotContain('Second debug message');
    await this.expect(filteredContent).toNotContain('Fourth debug message');

    // Verify fewer lines after filtering
    await this.expect(filteredLines).toBeLessThan(totalLines);

    // Test A-F-007: Clear debug log filter
    await this.apexTab.clearLogFilter();

    // Get content after clearing filter
    const clearedContent = await this.apexTab.getLogContent();

    // Verify all lines are visible again
    await this.expect(clearedContent).toContain('First debug message');
    await this.expect(clearedContent).toContain('Second debug message');
    await this.expect(clearedContent).toContain('UNIQUE keyword');
    await this.expect(clearedContent).toContain('Fourth debug message');
    await this.expect(clearedContent).toContain('Calculation result: 30');

    // Verify total lines restored
    const restoredLines = clearedContent.split('\n').length;
    await this.expect(restoredLines).toBe(totalLines);
  }
}
