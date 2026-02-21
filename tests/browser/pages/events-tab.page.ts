import type { Page, Locator } from 'playwright';
import { BasePage } from './base.page';
import { MonacoHelpers } from '../helpers/monaco-helpers';

export class EventsTabPage extends BasePage {
    readonly streamMonaco: MonacoHelpers;
    readonly publishMonaco: MonacoHelpers;

    // Stream Elements
    readonly channelSelect: Locator;
    readonly replaySelect: Locator;
    readonly replayIdInput: Locator;
    readonly subscribeBtn: Locator;
    readonly streamStatus: Locator;
    readonly clearStreamBtn: Locator;

    // Publish Elements
    readonly publishChannelSelect: Locator;
    readonly publishBtn: Locator;
    readonly publishStatus: Locator;

    // Settings
    readonly settingsBtn: Locator;
    readonly settingsModal: Locator;

    // Overlay
    readonly tabOverlay: Locator;

    constructor(page: Page) {
        super(page);
        this.streamMonaco = new MonacoHelpers(page, '[data-testid="event-stream-editor"]');
        this.publishMonaco = new MonacoHelpers(page, '[data-testid="event-publish-editor"]');

        // Stream selectors
        this.channelSelect = page.locator('[data-testid="event-channel-select"]');
        this.replaySelect = page.locator('[data-testid="event-replay-select"]');
        this.replayIdInput = page.locator('[data-testid="event-replay-id"]');
        this.subscribeBtn = page.locator('[data-testid="event-subscribe-btn"]');
        this.streamStatus = page.locator('[data-testid="event-stream-status"]');
        this.clearStreamBtn = page.locator('[data-testid="event-clear-btn"]');

        // Settings
        this.settingsBtn = page.locator('[data-testid="event-settings-btn"]');
        this.settingsModal = page.locator('[data-testid="events-settings-modal"]');

        // Publish selectors
        this.publishChannelSelect = page.locator('[data-testid="event-publish-channel"]');
        this.publishBtn = page.locator('[data-testid="event-publish-btn"]');
        this.publishStatus = page.locator('[data-testid="event-publish-status"]');

        // Overlay
        this.tabOverlay = page.locator('[data-testid="feature-gate-overlay"]');
    }

    /**
     * Navigate to the Events tab
     */
    async navigateTo(): Promise<void> {
        // Check if already on events tab (must be visible, not just in DOM)
        const tabContent = this.page.locator('[data-testid="tab-content-events"]');
        const isVisible = await tabContent.isVisible();
        if (isVisible) return;

        // Go home first if in a feature view
        const homeScreen = this.page.locator('[data-testid="home-screen"]');
        if (!(await homeScreen.isVisible())) {
            await this.slowClick(this.page.locator('[data-testid="back-to-home-btn"]'));
            await homeScreen.waitFor({ state: 'visible', timeout: 5000 });
        }
        // Click feature tile
        await this.slowClick(this.page.locator('[data-testid="tile-events"]'));
        await this.page.waitForSelector('[data-testid="tab-content-events"]', { timeout: 5000 });
        await this.afterNavigation();
    }

    /**
     * Open the settings modal
     */
    async openSettings(): Promise<void> {
        await this.slowClick(this.settingsBtn);
        await this.settingsModal.waitFor({ state: 'visible', timeout: 3000 });
    }

    /**
     * Wait for channels to finish loading
     */
    async waitForChannelsLoaded(): Promise<void> {
        // First, wait a bit for the loadChannels() async call to start
        await this.page.waitForTimeout(500);

        // Then wait for channels to appear in the select dropdown
        // Use a function that polls the DOM state
        await this.page.waitForSelector(
            '[data-testid="event-channel-select"] option[value="/event/Order_Event__e"]',
            {
                state: 'attached',
                timeout: 10000,
            }
        );
    }

    /**
     * Wait for publish channels to finish loading
     */
    async waitForPublishChannelsLoaded(): Promise<void> {
        // First, wait a bit for the loadChannels() async call to start
        await this.page.waitForTimeout(500);

        // Then wait for options to appear in the publish select dropdown
        await this.page.waitForSelector(
            '[data-testid="event-publish-channel"] option[value="Order_Event__e"]',
            {
                state: 'attached',
                timeout: 10000,
            }
        );
    }

    /**
     * Select a channel from the dropdown
     */
    async selectChannel(channel: string): Promise<void> {
        await this.waitForChannelsLoaded();
        await this.delay('beforeClick');
        await this.channelSelect.selectOption(channel);
        await this.delay('afterClick');
    }

    /**
     * Select a replay option (LATEST, EARLIEST, CUSTOM)
     */
    async selectReplayOption(option: string): Promise<void> {
        await this.delay('beforeClick');
        await this.replaySelect.selectOption(option);
        await this.delay('afterClick');
    }

    /**
     * Set custom replay ID
     */
    async setReplayId(replayId: string): Promise<void> {
        await this.delay('beforeType');
        await this.replayIdInput.fill(replayId);
    }

    /**
     * Click subscribe button
     */
    async subscribe(): Promise<void> {
        await this.slowClick(this.subscribeBtn);
    }

    /**
     * Click unsubscribe button (subscribe button text changes to "Unsubscribe")
     */
    async unsubscribe(): Promise<void> {
        await this.slowClick(this.subscribeBtn);
    }

    /**
     * Get stream status badge
     */
    async getStatus(): Promise<{ text: string; type: string }> {
        const text = (await this.streamStatus.textContent()) || '';
        const classList = (await this.streamStatus.getAttribute('class')) || '';

        let type = '';
        if (classList.includes('status-success')) type = 'success';
        else if (classList.includes('status-error')) type = 'error';
        else if (classList.includes('status-loading')) type = 'loading';

        return { text: text.trim(), type };
    }

    /**
     * Get publish status badge
     */
    async getPublishStatus(): Promise<{ text: string; type: string }> {
        const text = (await this.publishStatus.textContent()) || '';
        const classList = (await this.publishStatus.getAttribute('class')) || '';

        let type = '';
        if (classList.includes('status-success')) type = 'success';
        else if (classList.includes('status-error')) type = 'error';
        else if (classList.includes('status-loading')) type = 'loading';

        return { text: text.trim(), type };
    }

    /**
     * Get stream output content
     */
    async getStreamOutput(): Promise<string> {
        return await this.streamMonaco.getValue();
    }

    /**
     * Clear stream output
     */
    async clearStream(): Promise<void> {
        await this.slowClick(this.clearStreamBtn);
    }

    /**
     * Select event type for publishing
     */
    async selectPublishEventType(eventType: string): Promise<void> {
        await this.waitForPublishChannelsLoaded();
        await this.delay('beforeClick');
        await this.publishChannelSelect.selectOption(eventType);
        await this.delay('afterClick');
    }

    /**
     * Set publish payload
     */
    async setPublishPayload(payload: string): Promise<void> {
        await this.delay('beforeType');
        await this.publishMonaco.setValue(payload);
    }

    /**
     * Click publish button
     */
    async publishEvent(payload: string): Promise<void> {
        await this.setPublishPayload(payload);
        await this.slowClick(this.publishBtn);

        // Wait for publish to complete
        await this.page.waitForFunction(
            () => {
                const status = document.querySelector('[data-testid="event-publish-status"]');
                if (!status) return false;
                return (
                    status.classList.contains('status-error') ||
                    status.classList.contains('status-success')
                );
            },
            { timeout: 10000 }
        );
    }

    /**
     * Check if tab is disabled (proxy not connected overlay shown)
     */
    async isTabDisabled(): Promise<boolean> {
        return await this.tabOverlay.isVisible();
    }

    /**
     * Get available channels from dropdown
     */
    async getChannelOptions(): Promise<string[]> {
        await this.waitForChannelsLoaded();
        const options = await this.channelSelect.locator('option').all();
        const values: string[] = [];
        for (const option of options) {
            const value = await option.getAttribute('value');
            if (value) values.push(value);
        }
        return values;
    }

    /**
     * Get subscribe button text
     */
    async getSubscribeButtonText(): Promise<string> {
        return (await this.subscribeBtn.textContent()) || '';
    }

    /**
     * Get available replay options from dropdown
     */
    async getReplayOptions(): Promise<string[]> {
        const options = await this.replaySelect.locator('option').all();
        const values: string[] = [];
        for (const option of options) {
            const value = await option.getAttribute('value');
            if (value) values.push(value);
        }
        return values;
    }

    /**
     * Get currently selected replay option
     */
    async getSelectedReplayOption(): Promise<string> {
        return await this.replaySelect.inputValue();
    }

    /**
     * Check if custom replay ID input is visible
     */
    async isReplayIdInputVisible(): Promise<boolean> {
        return await this.replayIdInput.isVisible();
    }

    /**
     * Get the count of event rows in the table
     */
    async getEventCount(): Promise<number> {
        const rows = this.page.locator('[data-testid^="event-row-"]');
        return await rows.count();
    }

    /**
     * Get the count of system message rows
     */
    async getSystemMessageCount(): Promise<number> {
        const rows = this.page.locator('[data-testid^="event-row-"]');
        const count = await rows.count();
        let systemCount = 0;

        for (let i = 0; i < count; i++) {
            const row = rows.nth(i);
            const className = await row.getAttribute('class');
            if (className?.includes('rowSystem')) {
                systemCount++;
            }
        }

        return systemCount;
    }

    /**
     * Check if event table is visible
     */
    async isEventTableVisible(): Promise<boolean> {
        const table = this.page.locator('[data-testid="event-table"]');
        return await table.isVisible();
    }

    /**
     * Check if empty state is visible
     */
    async isEmptyStateVisible(): Promise<boolean> {
        const emptyState = this.page.locator('text=Subscribe to a channel to see events');
        return await emptyState.isVisible();
    }

    /**
     * Click Open button on a specific event by index
     */
    async openEventByIndex(index: number): Promise<void> {
        const openButtons = this.page.locator('[data-testid^="event-open-"]');
        const button = openButtons.nth(index);
        await this.slowClick(button);
    }

    /**
     * Check if an event row is marked as opened
     */
    async isEventOpened(eventId: string): Promise<boolean> {
        const row = this.page.locator(`[data-testid="event-row-${eventId}"]`);
        const className = await row.getAttribute('class');
        return className?.includes('rowOpened') || false;
    }

    /**
     * Get event data from a specific row
     */
    async getEventData(index: number): Promise<{
        time: string;
        replayId: string;
        channel: string;
        eventType: string;
    }> {
        const rows = this.page.locator('[data-testid^="event-row-"]');
        const row = rows.nth(index);
        const cells = row.locator('td');

        return {
            time: (await cells.nth(0).textContent()) || '',
            replayId: (await cells.nth(1).textContent()) || '',
            channel: (await cells.nth(2).textContent()) || '',
            eventType: (await cells.nth(3).textContent()) || '',
        };
    }
}
