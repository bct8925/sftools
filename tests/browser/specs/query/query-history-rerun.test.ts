/**
 * Query History Re-run Button and Preview Trimming Tests
 *
 * Test IDs: Q-F-027, Q-F-028, Q-F-030, Q-F-031, Q-F-036, Q-F-037, Q-F-038, Q-F-039, Q-F-040
 * - Q-F-027: Re-run button exists in history list
 * - Q-F-028: Re-run button executes query without loading into editor
 * - Q-F-030: Re-run preserves history order (does not reorder)
 * - Q-F-031: Clicking history item loads into editor and reorders
 * - Q-F-036: Preview trimming - "SELECT Id," prefix is removed
 * - Q-F-037: Preview trimming - "SELECT Id FROM" pattern is trimmed
 * - Q-F-038: Preview trimming - case-insensitive matching
 * - Q-F-039: Preview trimming - handles extra whitespace variations
 * - Q-F-040: Preview trimming - preserves queries that don't start with SELECT Id
 */

import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

describe('Q-F-027/028/030/031: Query History Re-run Button', () => {
    beforeEach(async () => {
        const router = new MockRouter();

        // Mock query response for all queries
        router.onQuery(
            /\/query/,
            [
                { Id: '001MOCKACCOUNT01', Name: 'Account 1' },
                { Id: '001MOCKACCOUNT02', Name: 'Account 2' },
            ],
            [
                { columnName: 'Id', displayName: 'Id', aggregate: false },
                { columnName: 'Name', displayName: 'Name', aggregate: false },
            ]
        );

        await setupMocks(router);
    });

    it('Q-F-027: Re-run button exists in history list but not in favorites', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        await navigateToExtension();
        await queryTab.navigateTo();

        // Execute a query to create history
        const testQuery = 'SELECT Id, Name FROM Account LIMIT 2';
        await queryTab.executeQuery(testQuery);

        // Open history and verify re-run button exists
        await queryTab.openHistory();

        const rerunButton = page.locator(
            '[data-testid="query-history-list"] [data-testid="script-action-rerun"]'
        );
        const rerunCount = await rerunButton.count();
        expect(rerunCount).toBeGreaterThan(0);

        // Verify button has play icon
        const buttonText = await rerunButton.first().textContent();
        expect(buttonText).toContain('▶');

        // Switch to favorites tab
        const favoritesTab = page.locator('[data-testid="query-favorites-tab"]');
        await favoritesTab.click();

        // Verify re-run button does NOT exist in favorites
        const favRerunButton = page.locator(
            '[data-testid="query-favorites-list"] [data-testid="script-action-rerun"]'
        );
        const favRerunCount = await favRerunButton.count();
        expect(favRerunCount).toBe(0);

        await queryTab.closeHistory();
    });

    it('Q-F-028: Re-run button executes query without loading into editor', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        await navigateToExtension();
        await queryTab.navigateTo();

        // Execute initial query
        const initialQuery = 'SELECT Id, Name FROM Account LIMIT 2';
        await queryTab.executeQuery(initialQuery);

        // Clear the editor
        await queryTab.monaco.setValue('');
        const clearedValue = await queryTab.monaco.getValue();
        expect(clearedValue).toBe('');

        // Open history modal
        await queryTab.openHistory();

        // Click the re-run button on the first history item
        const rerunButton = page
            .locator('[data-testid="query-history-list"] [data-testid="script-action-rerun"]')
            .first();
        await rerunButton.click();

        // Wait for modal to close
        await page.waitForSelector('[data-testid="query-history-modal"]', {
            state: 'hidden',
            timeout: 5000,
        });

        // Wait for query execution to complete
        await page.waitForFunction(
            () => {
                const status = document.querySelector('[data-testid="query-status"]');
                if (!status) return false;
                return (
                    status.classList.contains('status-success') ||
                    status.classList.contains('status-error')
                );
            },
            { timeout: 30000 }
        );

        // Verify editor is still empty (query was not loaded into editor)
        const editorValue = await queryTab.monaco.getValue();
        expect(editorValue).toBe('');

        // Verify query executed successfully
        const status = await queryTab.getStatus();
        expect(status.type).toBe('success');
        expect(status.text).toContain('2 records');
    });

    it('Q-F-030: Re-run preserves history order', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        await navigateToExtension();
        await queryTab.navigateTo();

        // Execute three different queries to create history
        // Use queries that won't be affected by "SELECT Id" trimming
        const query1 = "SELECT Name FROM Account WHERE Id = '001First'";
        const query2 = "SELECT Name FROM Account WHERE Id = '001Second'";
        const query3 = "SELECT Name FROM Account WHERE Id = '001Third'";

        await queryTab.executeQuery(query1);
        await queryTab.executeQuery(query2);
        await queryTab.executeQuery(query3);

        // Verify initial order (most recent first)
        // Note: Previews will have trimming applied, so we check for unique parts
        await queryTab.openHistory();
        let historyItems = await queryTab.getHistoryItems();
        expect(historyItems[0]).toContain('001Third');
        expect(historyItems[1]).toContain('001Second');
        expect(historyItems[2]).toContain('001First');

        await queryTab.closeHistory();

        // Clear editor
        await queryTab.monaco.setValue('');

        // Re-run the second item (index 1) - should NOT reorder
        await queryTab.openHistory();
        const rerunButton = page
            .locator('[data-testid="query-history-list"] [data-testid="script-action-rerun"]')
            .nth(1);
        await rerunButton.click();

        // Wait for modal to close and query to execute
        await page.waitForSelector('[data-testid="query-history-modal"]', {
            state: 'hidden',
            timeout: 5000,
        });
        await page.waitForFunction(
            () => {
                const status = document.querySelector('[data-testid="query-status"]');
                if (!status) return false;
                return (
                    status.classList.contains('status-success') ||
                    status.classList.contains('status-error')
                );
            },
            { timeout: 30000 }
        );

        // Verify order is preserved (Q-F-030)
        await queryTab.openHistory();
        historyItems = await queryTab.getHistoryItems();
        expect(historyItems[0]).toContain('001Third');
        expect(historyItems[1]).toContain('001Second');
        expect(historyItems[2]).toContain('001First');

        await queryTab.closeHistory();
    });

    it('Q-F-031: Clicking history item loads into editor', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        await navigateToExtension();
        await queryTab.navigateTo();

        // Execute a query to create history
        const testQuery = "SELECT Name FROM Account WHERE Id = '001Test'";
        await queryTab.executeQuery(testQuery);

        // Clear the editor
        await queryTab.monaco.setValue('');
        const clearedValue = await queryTab.monaco.getValue();
        expect(clearedValue).toBe('');

        // Load from history by clicking the item
        await queryTab.loadFromHistory(0);

        // Verify the query was loaded into editor
        const editorValue = await queryTab.monaco.getValue();
        expect(editorValue).toBe(testQuery);
    });
});

describe('Q-F-036/037/038/039/040: Query Preview Trimming', () => {
    beforeEach(async () => {
        const router = new MockRouter();

        // Mock query response
        router.onQuery(
            /\/query/,
            [{ Id: '001MOCKACCOUNT01', Name: 'Test Account' }],
            [
                { columnName: 'Id', displayName: 'Id', aggregate: false },
                { columnName: 'Name', displayName: 'Name', aggregate: false },
            ]
        );

        await setupMocks(router);
    });

    it('Q-F-036: Preview trimming removes "SELECT Id," prefix', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        await navigateToExtension();
        await queryTab.navigateTo();

        // Execute query with "SELECT Id," prefix
        const query = 'SELECT Id, Name FROM Account LIMIT 1';
        await queryTab.executeQuery(query);

        // Open history and check preview
        await queryTab.openHistory();

        const preview = page
            .locator('[data-testid="query-history-list"] [data-testid="script-preview"]')
            .first();
        const previewText = await preview.textContent();

        // Verify "SELECT Id," is trimmed
        expect(previewText).not.toContain('SELECT Id,');
        expect(previewText?.trim()).toBe('Name FROM Account LIMIT 1');

        await queryTab.closeHistory();
    });

    it('Q-F-037: Preview trimming handles "SELECT Id FROM" pattern', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        await navigateToExtension();
        await queryTab.navigateTo();

        // Execute query with only "SELECT Id FROM" (no comma)
        const query = 'SELECT Id FROM Account LIMIT 1';
        await queryTab.executeQuery(query);

        // Open history and check preview
        await queryTab.openHistory();

        const preview = page
            .locator('[data-testid="query-history-list"] [data-testid="script-preview"]')
            .first();
        const previewText = await preview.textContent();

        // Verify "SELECT Id" is trimmed
        expect(previewText).not.toContain('SELECT Id');
        expect(previewText?.trim()).toBe('FROM Account LIMIT 1');

        await queryTab.closeHistory();
    });

    it('Q-F-038: Preview trimming is case-insensitive', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        await navigateToExtension();
        await queryTab.navigateTo();

        // Execute queries with various case combinations
        const queries = [
            'select id, Name FROM Account',
            'SELECT id, Name FROM Account',
            'Select Id, Name FROM Account',
            'SeLeCt iD, Name FROM Account',
        ];

        for (const query of queries) {
            await queryTab.executeQuery(query);
        }

        // Open history and verify all are trimmed
        await queryTab.openHistory();

        const previews = await page
            .locator('[data-testid="query-history-list"] [data-testid="script-preview"]')
            .allTextContents();

        // All should have SELECT Id trimmed regardless of case
        for (let i = 0; i < queries.length; i++) {
            expect(previews[i]).not.toMatch(/select\s+id/i);
            expect(previews[i]?.trim()).toBe('Name FROM Account');
        }

        await queryTab.closeHistory();
    });

    it('Q-F-039: Preview trimming handles extra whitespace variations', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        await navigateToExtension();
        await queryTab.navigateTo();

        // Execute queries with various whitespace patterns
        const queries = [
            'SELECT Id,Name FROM Account', // No space after comma
            'SELECT Id,  Name FROM Account', // Multiple spaces after comma
            'SELECT  Id  ,  Name FROM Account', // Spaces around Id
            'SELECT\tId\t,\tName FROM Account', // Tabs
        ];

        for (const query of queries) {
            await queryTab.executeQuery(query);
        }

        // Open history and verify all are trimmed
        await queryTab.openHistory();

        const previews = await page
            .locator('[data-testid="query-history-list"] [data-testid="script-preview"]')
            .allTextContents();

        // All should have SELECT Id, trimmed regardless of whitespace
        for (let i = 0; i < queries.length; i++) {
            expect(previews[i]).not.toContain('SELECT');
            expect(previews[i]).not.toContain('Id');
            // Should start with "Name FROM Account"
            expect(previews[i]?.trim()).toMatch(/^Name FROM Account/);
        }

        await queryTab.closeHistory();
    });

    it("Q-F-040: Preview preserves queries that don't start with SELECT Id", async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        await navigateToExtension();
        await queryTab.navigateTo();

        // Execute queries that should NOT be trimmed
        const queries = [
            'SELECT Name, Id FROM Account',
            'SELECT COUNT() FROM Account',
            "SELECT Name FROM Account WHERE Id = '001xxx'",
            'SELECT AccountId, Name FROM Contact',
        ];

        for (const query of queries) {
            await queryTab.executeQuery(query);
        }

        // Open history and verify none are trimmed incorrectly
        await queryTab.openHistory();

        const previews = await page
            .locator('[data-testid="query-history-list"] [data-testid="script-preview"]')
            .allTextContents();

        // History is in reverse order (most recent first)
        // These should not be modified (base preview logic may still apply, but no SELECT Id trimming)
        expect(previews[0]?.trim()).toBe('SELECT AccountId, Name FROM Contact');
        expect(previews[1]?.trim()).toBe("SELECT Name FROM Account WHERE Id = '001xxx'");
        expect(previews[2]?.trim()).toBe('SELECT COUNT() FROM Account');
        expect(previews[3]?.trim()).toBe('SELECT Name, Id FROM Account');

        await queryTab.closeHistory();
    });
});
