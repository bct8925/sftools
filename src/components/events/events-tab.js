// Events Tab - Unified Streaming (gRPC Pub/Sub + CometD)
import template from './events.html?raw';
import '../monaco-editor/monaco-editor.js';
import { isAuthenticated, isProxyConnected, getInstanceUrl, getAccessToken } from '../../lib/utils.js';
import { getAllStreamingChannels, publishPlatformEvent } from '../../lib/salesforce.js';
import { updateStatusBadge } from '../../lib/ui-helpers.js';
import { buildChannelOptions, formatEventEntry, formatSystemMessage } from '../../lib/events-utils.js';

class EventsTab extends HTMLElement {
    // DOM references
    channelSelect = null;
    subscribeBtn = null;
    streamStatus = null;
    streamEditor = null;
    clearBtn = null;
    publishChannelSelect = null;
    publishEditor = null;
    publishBtn = null;
    publishStatus = null;
    replaySelect = null;
    replayCustomContainer = null;
    replayIdInput = null;

    // Streaming state
    currentSubscriptionId = null;
    isSubscribed = false;
    eventCount = 0;
    channelsLoaded = false;

    // Bound message handler for cleanup
    boundMessageHandler = null;
    boundConnectionHandler = null;
    boundVisibilityHandler = null;

    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.initEditors();
        this.attachEventListeners();

        // Defer channel loading until tab is first visible (requires proxy anyway)
        this.boundVisibilityHandler = () => this.checkVisibilityAndLoad();
        document.addEventListener('tab-changed', this.boundVisibilityHandler);
        // Also check on click in case tab-changed event isn't used
        this.addEventListener('click', this.boundVisibilityHandler, { once: true });

        // Handle connection changes - reload channels for new org
        this.boundConnectionHandler = () => this.handleConnectionChange();
        document.addEventListener('connection-changed', this.boundConnectionHandler);
    }

    disconnectedCallback() {
        if (this.boundMessageHandler) {
            chrome.runtime.onMessage.removeListener(this.boundMessageHandler);
        }
        if (this.boundConnectionHandler) {
            document.removeEventListener('connection-changed', this.boundConnectionHandler);
        }
        if (this.boundVisibilityHandler) {
            document.removeEventListener('tab-changed', this.boundVisibilityHandler);
        }
    }

    checkVisibilityAndLoad() {
        // Only load once, and only when tab is active and authenticated
        if (this.channelsLoaded || !this.classList.contains('active')) {
            return;
        }
        if (isAuthenticated()) {
            this.channelsLoaded = true;
            this.loadChannels();
        }
    }

    async handleConnectionChange() {
        // Unsubscribe from current channel if subscribed
        if (this.isSubscribed && this.currentSubscriptionId) {
            try {
                await chrome.runtime.sendMessage({
                    type: 'unsubscribe',
                    subscriptionId: this.currentSubscriptionId
                });
            } catch (e) {
                // Ignore errors during cleanup
            }
            this.handleDisconnect();
        }

        // Clear the stream and reset channel cache
        this.clearStream();
        this.channelsLoaded = false;
        // Only reload if tab is currently visible
        if (this.classList.contains('active')) {
            this.loadChannels();
            this.channelsLoaded = true;
        }
    }

    initElements() {
        this.channelSelect = this.querySelector('.event-channel-select');
        this.subscribeBtn = this.querySelector('.event-subscribe-btn');
        this.streamStatus = this.querySelector('.event-stream-status');
        this.clearBtn = this.querySelector('.event-clear-btn');
        this.publishChannelSelect = this.querySelector('.event-publish-channel');
        this.publishBtn = this.querySelector('.event-publish-btn');
        this.publishStatus = this.querySelector('.event-publish-status');
        this.replaySelect = this.querySelector('.event-replay-select');
        this.replayCustomContainer = this.querySelector('.event-replay-custom');
        this.replayIdInput = this.querySelector('.event-replay-id');
    }

    initEditors() {
        this.streamEditor = this.querySelector('.event-stream-editor');
        this.publishEditor = this.querySelector('.event-publish-editor');

        this.streamEditor.setValue('// Subscribe to a channel to see events here\n');
        this.publishEditor.setValue('{\n  \n}');

        this.publishEditor.addEventListener('execute', () => this.handlePublish());
    }

    attachEventListeners() {
        this.subscribeBtn.addEventListener('click', () => this.toggleSubscription());
        this.clearBtn.addEventListener('click', () => this.clearStream());
        this.publishBtn.addEventListener('click', () => this.handlePublish());

        this.replaySelect.addEventListener('change', () => {
            this.replayCustomContainer.style.display = this.replaySelect.value === 'CUSTOM' ? 'block' : 'none';
        });

        this.boundMessageHandler = (message) => this.handleStreamMessage(message);
        chrome.runtime.onMessage.addListener(this.boundMessageHandler);
    }

    // ============================================================
    // Channel Loading
    // ============================================================

    async loadChannels() {
        if (!isAuthenticated()) {
            this.channelSelect.innerHTML = '<option value="">Not authenticated</option>';
            this.publishChannelSelect.innerHTML = '<option value="">Not authenticated</option>';
            return;
        }

        this.channelSelect.innerHTML = '<option value="">Loading...</option>';
        this.publishChannelSelect.innerHTML = '<option value="">Loading...</option>';

        try {
            const channels = await getAllStreamingChannels();
            this.buildChannelOptions(channels);
        } catch (err) {
            console.error('Error loading streaming channels:', err);
            this.channelSelect.innerHTML = '<option value="">Error loading channels</option>';
            this.publishChannelSelect.innerHTML = '<option value="">Error loading channels</option>';
        }
    }

    buildChannelOptions(channels) {
        const { platformEvents, standardEvents, pushTopics, systemTopics } = channels;

        // Build subscribe dropdown (all channel types)
        this.channelSelect.innerHTML = '';
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = 'Select a channel...';
        this.channelSelect.appendChild(defaultOpt);

        const groups = buildChannelOptions(platformEvents, standardEvents, pushTopics, systemTopics);
        groups.forEach(group => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = group.label;
            group.options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                optgroup.appendChild(option);
            });
            this.channelSelect.appendChild(optgroup);
        });

        // Build publish dropdown (Platform Events only - publishing only works for PE)
        this.publishChannelSelect.innerHTML = '';
        const publishDefault = document.createElement('option');
        publishDefault.value = '';
        publishDefault.textContent = 'Select an event type...';
        this.publishChannelSelect.appendChild(publishDefault);

        if (platformEvents.length > 0) {
            const publishCustomGroup = document.createElement('optgroup');
            publishCustomGroup.label = 'Custom Events';
            platformEvents.forEach(evt => {
                const opt = document.createElement('option');
                opt.value = evt.QualifiedApiName;
                opt.textContent = evt.Label || evt.DeveloperName;
                publishCustomGroup.appendChild(opt);
            });
            this.publishChannelSelect.appendChild(publishCustomGroup);
        }
    }

    // ============================================================
    // Subscription (via proxy - gRPC or CometD based on channel)
    // ============================================================

    toggleSubscription() {
        if (this.isSubscribed) {
            this.unsubscribe();
        } else {
            this.subscribe();
        }
    }

    async subscribe() {
        const channel = this.channelSelect.value;
        if (!channel) {
            this.updateStreamStatus('Select a channel', 'error');
            return;
        }

        if (!isAuthenticated()) {
            this.updateStreamStatus('Not authenticated', 'error');
            return;
        }

        if (!isProxyConnected()) {
            this.updateStreamStatus('Proxy required', 'error');
            this.appendSystemMessage('Streaming requires the local proxy. Open Settings to connect.');
            return;
        }

        this.updateStreamStatus('Connecting...', 'loading');
        this.subscribeBtn.disabled = true;

        try {
            const replayPreset = this.replaySelect.value;
            const replayId = replayPreset === 'CUSTOM' ? this.replayIdInput.value : undefined;

            const response = await chrome.runtime.sendMessage({
                type: 'subscribe',
                instanceUrl: getInstanceUrl(),
                accessToken: getAccessToken(),
                channel,
                replayPreset,
                replayId
            });

            if (response.success) {
                this.currentSubscriptionId = response.subscriptionId;
                this.isSubscribed = true;
                this.updateStreamStatus('Subscribed', 'success');
                this.subscribeBtn.textContent = 'Unsubscribe';
                this.appendSystemMessage(`Subscribed to ${channel} (replay: ${replayPreset})`);
            } else {
                throw new Error(response.error || 'Subscription failed');
            }
        } catch (err) {
            console.error('Subscribe error:', err);
            this.updateStreamStatus('Error', 'error');
            this.appendSystemMessage(`Error: ${err.message}`);
        } finally {
            this.subscribeBtn.disabled = false;
        }
    }

    async unsubscribe() {
        if (!this.currentSubscriptionId) return;

        this.subscribeBtn.disabled = true;
        this.updateStreamStatus('Disconnecting...', 'loading');

        try {
            await chrome.runtime.sendMessage({
                type: 'unsubscribe',
                subscriptionId: this.currentSubscriptionId
            });
            this.appendSystemMessage('Unsubscribed');
        } catch (err) {
            console.error('Unsubscribe error:', err);
        }

        this.handleDisconnect();
    }

    handleDisconnect() {
        this.currentSubscriptionId = null;
        this.isSubscribed = false;
        this.subscribeBtn.textContent = 'Subscribe';
        this.subscribeBtn.disabled = false;
        this.updateStreamStatus('Disconnected', '');
    }

    // ============================================================
    // Stream Message Handling
    // ============================================================

    handleStreamMessage(message) {
        if (message.subscriptionId !== this.currentSubscriptionId) return;

        switch (message.type) {
            case 'streamEvent':
                this.appendEvent(message.event);
                break;
            case 'streamError':
                this.appendSystemMessage(`Error: ${message.error}`);
                this.updateStreamStatus('Error', 'error');
                break;
            case 'streamEnd':
                this.appendSystemMessage('Stream ended by server');
                this.handleDisconnect();
                break;
        }
    }

    appendEvent(event) {
        this.eventCount++;
        const timestamp = new Date().toISOString();

        const eventEntry = formatEventEntry(event, this.eventCount, timestamp);

        const currentValue = this.streamEditor.getValue();
        const newEntry = JSON.stringify(eventEntry, null, 2);

        if (currentValue.startsWith('//')) {
            this.streamEditor.setValue(newEntry);
        } else {
            this.streamEditor.setValue(currentValue + '\n\n' + newEntry);
        }

        this.scrollStreamToBottom();
    }

    appendSystemMessage(msg) {
        const current = this.streamEditor.getValue();
        const newContent = current + formatSystemMessage(msg) + '\n';
        this.streamEditor.setValue(newContent);

        this.scrollStreamToBottom();
    }

    scrollStreamToBottom() {
        const editor = this.streamEditor.editor;
        if (editor) {
            const lineCount = editor.getModel().getLineCount();
            editor.revealLine(lineCount);
        }
    }

    clearStream() {
        this.eventCount = 0;
        this.streamEditor.setValue('// Stream cleared\n');
    }

    // ============================================================
    // Publishing
    // ============================================================

    async handlePublish() {
        const channel = this.publishChannelSelect.value;
        if (!channel) {
            this.updatePublishStatus('Select an event type', 'error');
            return;
        }

        if (!isAuthenticated()) {
            this.updatePublishStatus('Not authenticated', 'error');
            return;
        }

        let payload;
        try {
            payload = JSON.parse(this.publishEditor.getValue());
        } catch (err) {
            this.updatePublishStatus('Invalid JSON', 'error');
            return;
        }

        this.updatePublishStatus('Publishing...', 'loading');
        this.publishBtn.disabled = true;

        try {
            const result = await publishPlatformEvent(channel, payload);

            if (result.success) {
                this.updatePublishStatus('Published', 'success');
                this.appendSystemMessage(`Published event: ${result.id || 'success'}`);
            } else {
                this.updatePublishStatus(result.error, 'error');
            }
        } catch (err) {
            console.error('Publish error:', err);
            this.updatePublishStatus('Error', 'error');
        } finally {
            this.publishBtn.disabled = false;
        }
    }

    // ============================================================
    // UI Helpers
    // ============================================================

    updateStreamStatus(text, type = '') {
        updateStatusBadge(this.streamStatus, text, type);
    }

    updatePublishStatus(text, type = '') {
        this.publishStatus.textContent = text;
        this.publishStatus.className = 'status-badge';
        if (type) this.publishStatus.classList.add(`status-${type}`);
    }
}

customElements.define('events-tab', EventsTab);
