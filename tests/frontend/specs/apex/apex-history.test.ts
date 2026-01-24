import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';

/**
 * Test Apex history functionality
 *
 * Test IDs: A-F-008, A-F-009, A-F-010
 * - A-F-008: Execute an Apex script and verify it appears in history
 * - A-F-009: Load an Apex script from history and verify it populates editor
 * - A-F-010: Delete an Apex script from history and verify removal
 */
export default class ApexHistoryTest extends SftoolsTest {
    private testScript: string = `System.debug('Test history script');
Integer result = 10 + 5;
System.debug('Result: ' + result);`;

    configureMocks() {
        const router = new MockRouter();

        // Mock successful Apex execution
        router.onApexExecute(
            true,
            true,
            'USER_DEBUG|[1]|DEBUG|Test history script\nUSER_DEBUG|[3]|DEBUG|Result: 15'
        );

        return router;
    }

    async test(): Promise<void> {
        // Navigate to extension
        await this.navigateToExtension();

        // Navigate to Apex tab
        await this.apexTab.navigateTo();

        // Execute an Apex script to add it to history (will use mocked response)
        await this.apexTab.setCode(this.testScript);
        await this.apexTab.execute();

        // Verify execution was successful
        const status = await this.apexTab.getStatus();
        await this.expect(status.success).toBe(true);

        // A-F-008: Verify script appears in history
        await this.apexTab.openHistory();
        const historyCount = await this.getHistoryCount();
        await this.expect(historyCount).toBeGreaterThan(0);

        const historyItems = await this.getHistoryItems();
        await this.expect(historyItems[0]).toContain('Test history script');

        await this.closeHistory();

        // Clear the editor
        await this.apexTab.clear();

        // A-F-009: Load from history and verify it populates editor
        await this.apexTab.loadFromHistory(0);

        const editorValue = await this.apexTab.getCode();
        await this.expect(editorValue.trim()).toBe(this.testScript);

        // A-F-010: Delete from history and verify removal
        await this.apexTab.openHistory();
        const beforeDeleteCount = await this.getHistoryCount();

        // Delete the first item
        await this.closeHistory();
        await this.apexTab.deleteFromHistory(0);

        // Reopen to check the count
        await this.closeHistory();
        await this.apexTab.openHistory();
        const afterDeleteCount = await this.getHistoryCount();
        await this.expect(afterDeleteCount).toBe(beforeDeleteCount - 1);

        await this.closeHistory();
    }

    /**
     * Get the number of items in history
     */
    private async getHistoryCount(): Promise<number> {
        // Make sure we're on the history tab
        const historyTab = this.page.locator('apex-tab .dropdown-tab[data-tab="history"]');
        const isHistoryActive = await historyTab.evaluate(el => el.classList.contains('active'));
        if (!isHistoryActive) {
            await this.apexTab.slowClick(historyTab);
        }

        const count = await this.page.$$eval(
            'apex-tab .apex-history-list .script-item',
            items => items.length
        );

        return count;
    }

    /**
     * Get the text of all history items
     */
    private async getHistoryItems(): Promise<string[]> {
        // Make sure we're on the history tab
        const historyTab = this.page.locator('apex-tab .dropdown-tab[data-tab="history"]');
        const isHistoryActive = await historyTab.evaluate(el => el.classList.contains('active'));
        if (!isHistoryActive) {
            await this.apexTab.slowClick(historyTab);
        }

        const items = await this.page.$$eval(
            'apex-tab .apex-history-list .script-item .script-preview',
            previews => previews.map(p => p.textContent?.trim() || '')
        );

        return items;
    }

    /**
     * Close the history modal
     */
    private async closeHistory(): Promise<void> {
        // Press Escape to close modal
        await this.page.keyboard.press('Escape');
        // Wait for modal to close
        await this.page.waitForFunction(
            () => {
                const modal = document.querySelector('apex-tab .apex-history-modal');
                return modal && !modal.classList.contains('open');
            },
            { timeout: 5000 }
        );
    }
}
