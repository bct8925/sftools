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

    // Overlay
    readonly tabOverlay: Locator;

    constructor(page: Page) {
        super(page);
        this.streamMonaco = new MonacoHelpers(page, 'events-tab .event-stream-editor');
        this.publishMonaco = new MonacoHelpers(page, 'events-tab .event-publish-editor');

        // Stream selectors
        this.channelSelect = page.locator('events-tab .event-channel-select');
        this.replaySelect = page.locator('events-tab .event-replay-select');
        this.replayIdInput = page.locator('events-tab .event-replay-id');
        this.subscribeBtn = page.locator('events-tab .event-subscribe-btn');
        this.streamStatus = page.locator('events-tab .event-stream-status');
        this.clearStreamBtn = page.locator('events-tab .event-clear-btn');

        // Publish selectors
        this.publishChannelSelect = page.locator('events-tab .event-publish-channel');
        this.publishBtn = page.locator('events-tab .event-publish-btn');
        this.publishStatus = page.locator('events-tab .event-publish-status');

        // Overlay
        this.tabOverlay = page.locator('#events .feature-gate-overlay');
    }

    /**
     * Navigate to the Events tab
     */
    async navigateTo(): Promise<void> {
        // Check if already on events tab
        const isActive = (await this.page.locator('events-tab.active').count()) > 0;
        if (isActive) return;

        // Open hamburger menu and wait for nav item
        await this.slowClick(this.page.locator('.hamburger-btn'));
        const navItem = this.page.locator('.mobile-nav-item[data-tab="events"]');
        await navItem.waitFor({ state: 'visible', timeout: 5000 });

        // Click the nav item
        await this.slowClick(navItem);
        await this.page.waitForSelector('events-tab.active', { timeout: 5000 });
        await this.afterNavigation();

        // Manually trigger checkVisibilityAndLoad() in case tab-changed event doesn't fire
        await this.page.evaluate(() => {
            const eventsTab = document.querySelector('events-tab');
            if (eventsTab && typeof (eventsTab as any).checkVisibilityAndLoad === 'function') {
                (eventsTab as any).checkVisibilityAndLoad();
            }
        });
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
            'events-tab .event-channel-select option[value="/event/Order_Event__e"]',
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
            'events-tab .event-publish-channel option[value="Order_Event__e"]',
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
                const status = document.querySelector('events-tab .event-publish-status');
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
}
