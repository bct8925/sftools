/**
 * Test CSV export functionality
 *
 * @test Q-F-012
 *
 * Test ID: Q-F-012
 * - Q-F-012: Export to CSV button triggers download with correct data
 */

import { describe, it, beforeEach, expect } from 'vitest';
import type { Download } from 'playwright';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

describe('Q-F-012: CSV Export', () => {
    const RECORD_COUNT = 5;

    beforeEach(async () => {
        const router = new MockRouter();

        // Mock query response with multiple records
        const records = [];
        for (let i = 0; i < RECORD_COUNT; i++) {
            records.push({
                Id: `001MOCKACCOUNT0${i}`,
                Name: `Export Test ${i}`,
                BillingCity: `City ${i}`,
                BillingState: 'CA',
            });
        }

        router.onQuery(/\/query/, records, [
            { columnName: 'Id', displayName: 'Id', aggregate: false },
            { columnName: 'Name', displayName: 'Name', aggregate: false },
            { columnName: 'BillingCity', displayName: 'BillingCity', aggregate: false },
            { columnName: 'BillingState', displayName: 'BillingState', aggregate: false },
        ]);

        await setupMocks(router);
    });

    it('exports query results to CSV with correct data', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        // Navigate to extension
        await navigateToExtension();

        // Navigate to Query tab
        await queryTab.navigateTo();

        // Execute query
        const query = `SELECT Id, Name, BillingCity, BillingState FROM Account LIMIT 10`;
        await queryTab.executeQuery(query);

        // Verify query succeeded
        const status = await queryTab.getStatus();
        expect(status.type).toBe('success');

        const count = await queryTab.getResultsCount();
        expect(count).toBe(RECORD_COUNT);

        // Set up download listener before clicking export
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

        // Click export CSV button
        await queryTab.exportCsv();

        // Wait for download to complete
        const download: Download = await downloadPromise;
        const filename = download.suggestedFilename();

        // Verify filename is CSV
        expect(filename).toContain('.csv');

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
        expect(recordCount).toBe(RECORD_COUNT);

        // Verify CSV has expected columns
        const header = lines[0];
        expect(header).toContain('Id');
        expect(header).toContain('Name');
        expect(header).toContain('BillingCity');
        expect(header).toContain('BillingState');

        // Verify at least one data row contains expected values
        const dataLine = lines[1];
        expect(dataLine).toContain('Export Test');
        expect(dataLine).toContain('CA');
    });
});
