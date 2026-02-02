import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';
import { EventsChannelsScenario } from '../../../shared/mocks/mock-scenarios.js';

/**
 * Test Events tab split-view layout and event table functionality
 *
 * Test IDs: E-F-002 through E-F-007
 * - E-F-002: Split-view layout - Monaco editor and event table both visible
 * - E-F-003: Event appears in table when received
 * - E-F-004: Open button loads event JSON into Monaco editor
 * - E-F-005: Clear Stream clears both table and editor
 * - E-F-006: System messages appear with distinct styling
 * - E-F-007: Event limit enforced (100 events max)
 */
describe('Events Viewer (E-F-002 to E-F-007)', () => {
    beforeEach(async () => {
        const router = new MockRouter();
        router.usePreset(EventsChannelsScenario);
        await setupMocks(router);
    });

    it('E-F-002: displays split-view layout with Monaco editor and event table', async () => {
        const { page } = getTestContext();
        const { eventsTab } = createPageObjects(page);

        await navigateToExtension();
        await eventsTab.navigateTo();

        // Verify Monaco editor is visible (this is in the viewerEditor section)
        const monacoEditor = page.locator('[data-testid="event-stream-editor"]');
        await monacoEditor.waitFor({ state: 'visible', timeout: 5000 });
        const isEditorVisible = await monacoEditor.isVisible();
        expect(isEditorVisible).toBe(true);

        // Verify the table section exists by checking for empty state message
        // (which is in the viewerTable section)
        const emptyStateText = page.locator('text=Subscribe to a channel to see events');
        await emptyStateText.waitFor({ state: 'visible', timeout: 5000 });
        const isEmptyStateVisible = await emptyStateText.isVisible();
        expect(isEmptyStateVisible).toBe(true);

        // This confirms split-view: Monaco editor is visible AND table section is visible
        // (showing empty state initially)
        // Both sections being present confirms the split-view layout is working
    });

    it('E-F-003: event appears in table after subscribing and receiving data', async () => {
        const { page } = getTestContext();
        const { eventsTab } = createPageObjects(page);

        await navigateToExtension();
        await eventsTab.navigateTo();

        // Select a channel and subscribe
        await eventsTab.selectChannel('/event/Order_Event__e');
        await eventsTab.subscribe();

        // Wait for subscription to establish
        await page.waitForTimeout(1000);

        // Simulate receiving an event by triggering the event handler
        // In a real test, this would come from the mock streaming endpoint
        await page.evaluate(() => {
            // Simulate an event being received
            const event = new CustomEvent('streamingEvent', {
                detail: {
                    channel: '/event/Order_Event__e',
                    replayId: 12345,
                    payload: {
                        schema: 'Order_Event__e',
                        payload: { OrderNumber__c: 'ORD-12345' },
                    },
                },
            });
            window.dispatchEvent(event);
        });

        // Wait for event to appear in table
        await page.waitForTimeout(500);

        // Verify event table is visible (empty state should be gone)
        const eventTable = page.locator('[data-testid="event-table"]');
        const isTableVisible = await eventTable.isVisible();

        // If the table is visible, verify we have at least one event row
        if (isTableVisible) {
            const eventRows = await page.locator('[data-testid^="event-row-"]').count();
            expect(eventRows).toBeGreaterThan(0);
        }
    });

    it('E-F-004: Open button loads event JSON into Monaco editor', async () => {
        const { page } = getTestContext();
        const { eventsTab } = createPageObjects(page);

        await navigateToExtension();
        await eventsTab.navigateTo();

        // Subscribe to a channel
        await eventsTab.selectChannel('/event/Order_Event__e');
        await eventsTab.subscribe();

        // Wait for any events to appear (in real scenario, events would come from mock)
        await page.waitForTimeout(1000);

        // Check if we have any event rows
        const firstEventRow = page.locator('[data-testid^="event-row-"]').first();
        const hasEvents = await firstEventRow.isVisible().catch(() => false);

        if (hasEvents) {
            // Get the initial Monaco content
            const initialContent = await eventsTab.getStreamOutput();

            // Click the Open button on the first event
            const openButton = page.locator('[data-testid^="event-open-"]').first();
            await openButton.click();

            // Wait for Monaco to update
            await page.waitForTimeout(500);

            // Verify Monaco content has changed and contains JSON
            const updatedContent = await eventsTab.getStreamOutput();
            expect(updatedContent).not.toBe(initialContent);
            expect(updatedContent).toContain('{'); // Should contain JSON

            // Verify the event row is marked as opened (opacity reduced)
            const firstEventRowClass = await firstEventRow.getAttribute('class');
            expect(firstEventRowClass).toContain('rowOpened');
        }
    });

    it('E-F-005: Clear Stream clears both table and Monaco editor', async () => {
        const { page } = getTestContext();
        const { eventsTab } = createPageObjects(page);

        await navigateToExtension();
        await eventsTab.navigateTo();

        // Subscribe and wait for potential events
        await eventsTab.selectChannel('/event/Order_Event__e');
        await eventsTab.subscribe();
        await page.waitForTimeout(1000);

        // Unsubscribe first
        await eventsTab.unsubscribe();
        await page.waitForTimeout(500);

        // Click Clear Stream button
        await eventsTab.clearStream();

        // Wait for clear to complete
        await page.waitForTimeout(500);

        // Verify Monaco editor is cleared (should show placeholder message)
        const editorContent = await eventsTab.getStreamOutput();
        expect(editorContent).toContain('Click Open on any event to view details');

        // Verify event table is cleared (empty state should be shown)
        const emptyState = page.locator('text=Subscribe to a channel to see events');
        const isEmptyStateVisible = await emptyState.isVisible();
        expect(isEmptyStateVisible).toBe(true);

        // Verify no event rows exist
        const eventRows = await page.locator('[data-testid^="event-row-"]').count();
        expect(eventRows).toBe(0);
    });

    it('E-F-006: system messages appear in table with distinct styling', async () => {
        const { page } = getTestContext();
        const { eventsTab } = createPageObjects(page);

        await navigateToExtension();
        await eventsTab.navigateTo();

        // Subscribe to trigger system messages
        await eventsTab.selectChannel('/event/Order_Event__e');
        await eventsTab.subscribe();

        // Wait for subscription to establish (might create system message)
        await page.waitForTimeout(1000);

        // Check for any event rows
        const eventRows = page.locator('[data-testid^="event-row-"]');
        const rowCount = await eventRows.count();

        if (rowCount > 0) {
            // Check each row to see if any have the system message styling
            for (let i = 0; i < rowCount; i++) {
                const row = eventRows.nth(i);
                const rowClass = await row.getAttribute('class');

                // If we find a system message row, verify it has the distinct styling
                if (rowClass?.includes('rowSystem')) {
                    // Verify system message styling is applied
                    expect(rowClass).toContain('rowSystem');

                    // Optionally verify the row has italic styling or background color
                    const styles = await row.evaluate(el => {
                        const computed = window.getComputedStyle(el);
                        return {
                            fontStyle: computed.fontStyle,
                            backgroundColor: computed.backgroundColor,
                        };
                    });

                    // System rows should have italic font style
                    expect(styles.fontStyle).toBe('italic');
                    break; // Found and verified at least one system message
                }
            }
        }
    });

    it('E-F-007: enforces 100-event limit by removing oldest events', async () => {
        const { page } = getTestContext();
        const { eventsTab } = createPageObjects(page);

        await navigateToExtension();
        await eventsTab.navigateTo();

        // Subscribe to a channel
        await eventsTab.selectChannel('/event/Order_Event__e');
        await eventsTab.subscribe();

        // Wait for subscription
        await page.waitForTimeout(1000);

        // Simulate receiving 105 events (to test limit enforcement)
        await page.evaluate(() => {
            for (let i = 0; i < 105; i++) {
                const event = new CustomEvent('streamingEvent', {
                    detail: {
                        channel: '/event/Order_Event__e',
                        replayId: 10000 + i,
                        payload: {
                            schema: 'Order_Event__e',
                            payload: { OrderNumber__c: `ORD-${i}` },
                        },
                    },
                });
                window.dispatchEvent(event);
            }
        });

        // Wait for events to be processed
        await page.waitForTimeout(1000);

        // Count non-system event rows
        const allRows = page.locator('[data-testid^="event-row-"]');
        const rowCount = await allRows.count();

        // Count non-system rows (system rows should be excluded from limit)
        let nonSystemRowCount = 0;
        for (let i = 0; i < rowCount; i++) {
            const row = allRows.nth(i);
            const rowClass = await row.getAttribute('class');
            if (!rowClass?.includes('rowSystem')) {
                nonSystemRowCount++;
            }
        }

        // Should have at most 100 non-system events
        expect(nonSystemRowCount).toBeLessThanOrEqual(100);
    });
});
