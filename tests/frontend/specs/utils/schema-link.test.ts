import { SftoolsTest } from '../../framework/base-test';

/**
 * Test Schema Browser link in Utils tab
 *
 * Test ID: U-SB-F-001
 * - U-SB-F-001: Click link - opens Schema Browser in new tab
 */
export default class SchemaLinkTest extends SftoolsTest {
    async test(): Promise<void> {
        // Navigate to extension
        await this.navigateToExtension();

        // Navigate to Utils tab
        await this.utilsTab.navigateTo();

        // Listen for popup window opening
        const popupPromise = this.context.waitForEvent('page');

        // Click the Schema Browser link
        await this.utilsTab.clickSchemaBrowserLink();

        // Wait for new page/tab to open
        const newPage = await popupPromise;
        await newPage.waitForLoadState('networkidle');

        // Verify the URL contains schema browser path and connectionId
        const url = newPage.url();
        await this.expect(url).toContain('/dist/pages/schema/schema.html');
        await this.expect(url).toContain('connectionId=');

        // Close the new page
        await newPage.close();
    }
}
