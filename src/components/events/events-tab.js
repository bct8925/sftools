// Events Tab - Platform Events Streaming via gRPC Pub/Sub API
import template from './events.html?raw';
import { createEditor, createReadOnlyEditor, monaco } from '../../lib/monaco.js';
import { isAuthenticated, isProxyConnected, getInstanceUrl, getAccessToken } from '../../lib/utils.js';
import { getEventChannels, publishPlatformEvent } from '../../lib/salesforce.js';

// Standard Platform Events (commonly available)
const STANDARD_EVENTS = [
    { name: 'BatchApexErrorEvent', label: 'Batch Apex Error Event' },
    { name: 'FlowExecutionErrorEvent', label: 'Flow Execution Error Event' },
    { name: 'PlatformStatusAlertEvent', label: 'Platform Status Alert Event' },
    { name: 'AsyncOperationEvent', label: 'Async Operation Event' }
];

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

    // Bound message handler for cleanup
    boundMessageHandler = null;

    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.initEditors();
        this.attachEventListeners();
        this.loadChannels();
    }

    disconnectedCallback() {
        if (this.boundMessageHandler) {
            chrome.runtime.onMessage.removeListener(this.boundMessageHandler);
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
        this.streamEditor = createReadOnlyEditor(this.querySelector('.event-stream-editor'), {
            language: 'json',
            value: '// Subscribe to a Platform Event channel to see events here\n',
            wordWrap: 'on'
        });

        this.publishEditor = createEditor(this.querySelector('.event-publish-editor'), {
            language: 'json',
            value: '{\n  \n}'
        });

        this.publishEditor.addAction({
            id: 'publish-event',
            label: 'Publish Event',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
            run: () => this.handlePublish()
        });
    }

    attachEventListeners() {
        this.subscribeBtn.addEventListener('click', () => this.toggleSubscription());
        this.clearBtn.addEventListener('click', () => this.clearStream());
        this.publishBtn.addEventListener('click', () => this.handlePublish());

        this.replaySelect.addEventListener('change', () => {
            this.replayCustomContainer.style.display = this.replaySelect.value === 'CUSTOM' ? 'block' : 'none';
        });

        this.channelSelect.addEventListener('change', () => {
            this.publishChannelSelect.value = this.channelSelect.value;
        });
        this.publishChannelSelect.addEventListener('change', () => {
            this.channelSelect.value = this.publishChannelSelect.value;
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
            const result = await getEventChannels();
            this.buildChannelOptions(result.customEvents);
        } catch (err) {
            console.error('Error loading event channels:', err);
            this.channelSelect.innerHTML = '<option value="">Error loading channels</option>';
            this.publishChannelSelect.innerHTML = '<option value="">Error loading channels</option>';
        }
    }

    buildChannelOptions(customEvents) {
        this.channelSelect.innerHTML = '';
        this.publishChannelSelect.innerHTML = '';

        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = 'Select an event channel...';
        this.channelSelect.appendChild(defaultOpt);
        this.publishChannelSelect.appendChild(defaultOpt.cloneNode(true));

        if (customEvents.length > 0) {
            const customGroup = document.createElement('optgroup');
            customGroup.label = 'Custom Events';

            customEvents.forEach(evt => {
                const opt = document.createElement('option');
                opt.value = evt.QualifiedApiName;
                opt.textContent = evt.Label || evt.DeveloperName;
                customGroup.appendChild(opt);
            });

            this.channelSelect.appendChild(customGroup);
            this.publishChannelSelect.appendChild(customGroup.cloneNode(true));
        }

        const standardGroup = document.createElement('optgroup');
        standardGroup.label = 'Standard Events';

        STANDARD_EVENTS.forEach(evt => {
            const opt = document.createElement('option');
            opt.value = evt.name;
            opt.textContent = evt.label;
            standardGroup.appendChild(opt);
        });

        this.channelSelect.appendChild(standardGroup);
        this.publishChannelSelect.appendChild(standardGroup.cloneNode(true));

        if (customEvents.length === 0) {
            const noCustomOpt = document.createElement('option');
            noCustomOpt.value = '';
            noCustomOpt.disabled = true;
            noCustomOpt.textContent = '(No custom events found)';
            this.channelSelect.insertBefore(noCustomOpt, this.channelSelect.querySelector('optgroup'));
            this.publishChannelSelect.insertBefore(noCustomOpt.cloneNode(true), this.publishChannelSelect.querySelector('optgroup'));
        }
    }

    // ============================================================
    // Subscription (via gRPC proxy)
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
            this.appendSystemMessage('Platform Events require the local proxy. Open Settings to connect.');
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
                topicName: `/event/${channel}`,
                replayPreset,
                replayId
            });

            if (response.success) {
                this.currentSubscriptionId = response.subscriptionId;
                this.isSubscribed = true;
                this.updateStreamStatus('Subscribed', 'success');
                this.subscribeBtn.textContent = 'Unsubscribe';
                this.appendSystemMessage(`Subscribed to /event/${channel} (replay: ${replayPreset})`);
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
            case 'grpcEvent':
                this.appendEvent(message.event);
                break;
            case 'grpcError':
                this.appendSystemMessage(`Error: ${message.error}`);
                this.updateStreamStatus('Error', 'error');
                break;
            case 'grpcEnd':
                this.appendSystemMessage('Stream ended by server');
                this.handleDisconnect();
                break;
        }
    }

    appendEvent(event) {
        this.eventCount++;
        const timestamp = new Date().toISOString();

        const eventEntry = {
            _eventNumber: this.eventCount,
            _receivedAt: timestamp,
            replayId: event.replayId,
            payload: event.payload,
            error: event.error
        };

        const currentValue = this.streamEditor.getValue();
        const newEntry = JSON.stringify(eventEntry, null, 2);

        if (currentValue.startsWith('//')) {
            this.streamEditor.setValue(newEntry);
        } else {
            this.streamEditor.setValue(currentValue + '\n\n' + newEntry);
        }

        const lineCount = this.streamEditor.getModel().getLineCount();
        this.streamEditor.revealLine(lineCount);
    }

    appendSystemMessage(msg) {
        const timestamp = new Date().toLocaleTimeString();
        const current = this.streamEditor.getValue();
        const newContent = current + `// [${timestamp}] ${msg}\n`;
        this.streamEditor.setValue(newContent);

        const lineCount = this.streamEditor.getModel().getLineCount();
        this.streamEditor.revealLine(lineCount);
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
        this.streamStatus.textContent = text;
        this.streamStatus.className = 'status-badge';
        if (type) this.streamStatus.classList.add(`status-${type}`);
    }

    updatePublishStatus(text, type = '') {
        this.publishStatus.textContent = text;
        this.publishStatus.className = 'status-badge';
        if (type) this.publishStatus.classList.add(`status-${type}`);
    }
}

customElements.define('events-tab', EventsTab);
