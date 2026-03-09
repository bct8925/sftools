/**
 * Data Import Tab Frontend Tests
 *
 * Test IDs: DI-F-001 through DI-F-005
 * - DI-F-001: Tab renders when navigated to from home screen
 * - DI-F-002: Tab accessible via keyboard shortcut Alt+6
 * - DI-F-003: Operation & Object section is visible with operation selector defaulting to insert
 * - DI-F-004: CSV upload section is visible with browse button
 * - DI-F-005: Import button is disabled before object and CSV selection
 */

import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

describe('Data Import Tab', () => {
    beforeEach(async () => {
        const router = new MockRouter();
        // Provide a minimal global describe so the tab doesn't error on mount
        router.onGlobalDescribe([
            {
                name: 'Account',
                label: 'Account',
                createable: true,
                updateable: true,
                deletable: true,
            },
            {
                name: 'Contact',
                label: 'Contact',
                createable: true,
                updateable: true,
                deletable: true,
            },
        ]);
        await setupMocks(router);
    });

    it('DI-F-001: Tab renders when navigated to from home screen', async () => {
        const { page } = getTestContext();
        const { dataImportTab } = createPageObjects(page);

        await navigateToExtension();
        await dataImportTab.navigateTo();

        expect(await dataImportTab.tabContent.isVisible()).toBe(true);
    });

    it('DI-F-002: Tab accessible via keyboard shortcut Alt+6', async () => {
        const { page } = getTestContext();

        await navigateToExtension();
        await page.keyboard.press('Alt+6');

        await page
            .locator('[data-testid="tab-content-data-import"]')
            .waitFor({ state: 'visible', timeout: 3000 });
        expect(await page.locator('[data-testid="tab-content-data-import"]').isVisible()).toBe(
            true
        );
    });

    it('DI-F-003: Operation section is visible with operation selector defaulting to insert', async () => {
        const { page } = getTestContext();
        const { dataImportTab } = createPageObjects(page);

        await navigateToExtension();
        await dataImportTab.navigateTo();

        expect(await dataImportTab.operationSection.isVisible()).toBe(true);
        expect(await dataImportTab.operationSelect.isVisible()).toBe(true);
        expect(await dataImportTab.getSelectedOperation()).toBe('insert');
    });

    it('DI-F-004: CSV upload section is visible with browse button', async () => {
        const { page } = getTestContext();
        const { dataImportTab } = createPageObjects(page);

        await navigateToExtension();
        await dataImportTab.navigateTo();

        expect(await dataImportTab.csvSection.isVisible()).toBe(true);
        expect(await dataImportTab.browseBtn.isVisible()).toBe(true);
    });

    it('DI-F-005: Import button is disabled before object and CSV selection', async () => {
        const { page } = getTestContext();
        const { dataImportTab } = createPageObjects(page);

        await navigateToExtension();
        await dataImportTab.navigateTo();

        expect(await dataImportTab.isExecuteButtonDisabled()).toBe(true);
    });
});
