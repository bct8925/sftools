import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

/**
 * Test Apex history functionality
 *
 * Test IDs: A-F-008, A-F-009, A-F-010
 * - A-F-008: Execute an Apex script and verify it appears in history
 * - A-F-009: Load an Apex script from history and verify it populates editor
 * - A-F-010: Delete an Apex script from history and verify removal
 */
describe('Apex History', () => {
    const testScript = `System.debug('Test history script');
Integer result = 10 + 5;
System.debug('Result: ' + result);`;

    beforeEach(async () => {
        const router = new MockRouter();

        // Mock successful Apex execution
        router.onApexExecute(
            true,
            true,
            'USER_DEBUG|[1]|DEBUG|Test history script\nUSER_DEBUG|[3]|DEBUG|Result: 15'
        );

        await setupMocks(router);
    });

    /**
     * Get the number of items in history
     */
    async function getHistoryCount(page: any, apexTab: any): Promise<number> {
        // Make sure we're on the history tab
        const historyTab = page.locator('[data-testid="apex-history-tab"]');
        const isHistoryActive = await historyTab.evaluate(
            (el: Element) => el.classList.contains('active') || el.classList.contains('_active_')
        );
        if (!isHistoryActive) {
            await apexTab.slowClick(historyTab);
        }

        const count = await page.$$eval(
            '[data-testid="apex-history-list"] [data-testid="script-item"]',
            (items: Element[]) => items.length
        );

        return count;
    }

    /**
     * Get the text of all history items
     */
    async function getHistoryItems(page: any, apexTab: any): Promise<string[]> {
        // Make sure we're on the history tab
        const historyTab = page.locator('[data-testid="apex-history-tab"]');
        const isHistoryActive = await historyTab.evaluate(
            (el: Element) => el.classList.contains('active') || el.classList.contains('_active_')
        );
        if (!isHistoryActive) {
            await apexTab.slowClick(historyTab);
        }

        const items = await page.$$eval(
            '[data-testid="apex-history-list"] [data-testid="script-preview"]',
            (previews: Element[]) => previews.map(p => p.textContent?.trim() || '')
        );

        return items;
    }

    /**
     * Close the history modal
     */
    async function closeHistory(page: any): Promise<void> {
        // Press Escape to close modal
        await page.keyboard.press('Escape');
        // Wait for modal to close
        await page.waitForSelector('[data-testid="apex-history-modal"]', {
            state: 'hidden',
            timeout: 5000,
        });
    }

    it('can save to, load from, and delete from history', async () => {
        const { page } = getTestContext();
        const { apexTab } = createPageObjects(page);

        // Navigate to extension
        await navigateToExtension();

        // Navigate to Apex tab
        await apexTab.navigateTo();

        // Execute an Apex script to add it to history (will use mocked response)
        await apexTab.setCode(testScript);
        await apexTab.execute();

        // Verify execution was successful
        const status = await apexTab.getStatus();
        expect(status.success).toBe(true);

        // A-F-008: Verify script appears in history
        await apexTab.openHistory();
        const historyCount = await getHistoryCount(page, apexTab);
        expect(historyCount).toBeGreaterThan(0);

        const historyItems = await getHistoryItems(page, apexTab);
        expect(historyItems[0]).toContain('Test history script');

        await closeHistory(page);

        // Clear the editor
        await apexTab.clear();

        // A-F-009: Load from history and verify it populates editor
        await apexTab.loadFromHistory(0);

        const editorValue = await apexTab.getCode();
        expect(editorValue.trim()).toBe(testScript);

        // A-F-010: Delete from history and verify removal
        await apexTab.openHistory();
        const beforeDeleteCount = await getHistoryCount(page, apexTab);

        // Delete the first item
        await closeHistory(page);
        await apexTab.deleteFromHistory(0);

        // Reopen to check the count
        await closeHistory(page);
        await apexTab.openHistory();
        const afterDeleteCount = await getHistoryCount(page, apexTab);
        expect(afterDeleteCount).toBe(beforeDeleteCount - 1);

        await closeHistory(page);
    });
});
