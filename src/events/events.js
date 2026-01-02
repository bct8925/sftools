// Platform Events Tab - Subscribe to streams and publish events
// Uses gRPC Pub/Sub API via local proxy for streaming
import { createEditor, createReadOnlyEditor, monaco } from '../lib/monaco.js';
import { extensionFetch, getAccessToken, getInstanceUrl, isAuthenticated, isProxyConnected } from '../lib/utils.js';

// DOM Elements
let channelSelect;
let subscribeBtn;
let streamStatus;
let streamEditor;
let clearBtn;
let publishChannelSelect;
let publishEditor;
let publishBtn;
let publishStatus;
let replaySelect;
let replayCustomContainer;
let replayIdInput;

// Streaming state
let currentSubscriptionId = null;
let isSubscribed = false;
let eventCount = 0;

// Standard Platform Events (commonly available)
const STANDARD_EVENTS = [
    { name: 'BatchApexErrorEvent', label: 'Batch Apex Error Event' },
    { name: 'FlowExecutionErrorEvent', label: 'Flow Execution Error Event' },
    { name: 'PlatformStatusAlertEvent', label: 'Platform Status Alert Event' },
    { name: 'AsyncOperationEvent', label: 'Async Operation Event' }
];

export function init() {
    // Get DOM references
    channelSelect = document.getElementById('event-channel-select');
    subscribeBtn = document.getElementById('event-subscribe-btn');
    streamStatus = document.getElementById('event-stream-status');
    clearBtn = document.getElementById('event-clear-btn');
    publishChannelSelect = document.getElementById('event-publish-channel');
    publishBtn = document.getElementById('event-publish-btn');
    publishStatus = document.getElementById('event-publish-status');
    replaySelect = document.getElementById('event-replay-select');
    replayCustomContainer = document.getElementById('event-replay-custom');
    replayIdInput = document.getElementById('event-replay-id');

    // Initialize Monaco editors
    streamEditor = createReadOnlyEditor(document.getElementById('event-stream-editor'), {
        language: 'json',
        value: '// Subscribe to a Platform Event channel to see events here\n',
        wordWrap: 'on'
    });

    publishEditor = createEditor(document.getElementById('event-publish-editor'), {
        language: 'json',
        value: '{\n  \n}'
    });

    // Add Ctrl/Cmd+Enter shortcut for publish
    publishEditor.addAction({
        id: 'publish-event',
        label: 'Publish Event',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        run: () => publishEvent()
    });

    // Event handlers
    subscribeBtn.addEventListener('click', toggleSubscription);
    clearBtn.addEventListener('click', clearStream);
    publishBtn.addEventListener('click', publishEvent);

    // Replay option toggle
    replaySelect.addEventListener('change', () => {
        replayCustomContainer.style.display = replaySelect.value === 'CUSTOM' ? 'block' : 'none';
    });

    // Sync channel selects
    channelSelect.addEventListener('change', () => {
        publishChannelSelect.value = channelSelect.value;
    });
    publishChannelSelect.addEventListener('change', () => {
        channelSelect.value = publishChannelSelect.value;
    });

    // Listen for stream events from background script
    chrome.runtime.onMessage.addListener(handleStreamMessage);

    // Load available channels
    loadEventChannels();
}

/**
 * Handle streaming messages from the background script (gRPC events)
 */
function handleStreamMessage(message) {
    // Only process messages for our subscription
    if (message.subscriptionId !== currentSubscriptionId) return;

    switch (message.type) {
        case 'grpcEvent':
            appendEvent(message.event);
            break;
        case 'grpcError':
            appendSystemMessage(`Error: ${message.error}`);
            updateStreamStatus('Error', 'error');
            break;
        case 'grpcEnd':
            appendSystemMessage('Stream ended by server');
            handleDisconnect();
            break;
    }
}

async function loadEventChannels() {
    if (!isAuthenticated()) {
        channelSelect.innerHTML = '<option value="">Not authenticated</option>';
        publishChannelSelect.innerHTML = '<option value="">Not authenticated</option>';
        return;
    }

    channelSelect.innerHTML = '<option value="">Loading...</option>';
    publishChannelSelect.innerHTML = '<option value="">Loading...</option>';

    try {
        const instanceUrl = getInstanceUrl();
        const token = getAccessToken();

        // Query for custom Platform Events (entities ending in __e)
        const query = encodeURIComponent(
            "SELECT DeveloperName, QualifiedApiName, Label FROM EntityDefinition WHERE QualifiedApiName LIKE '%__e' AND IsCustomizable = true ORDER BY Label"
        );
        const response = await extensionFetch(
            `${instanceUrl}/services/data/v62.0/tooling/query?q=${query}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let customEvents = [];
        if (response.success) {
            const data = JSON.parse(response.data);
            customEvents = data.records || [];
        }

        // Build the select options
        buildChannelOptions(customEvents);

    } catch (err) {
        console.error('Error loading event channels:', err);
        channelSelect.innerHTML = '<option value="">Error loading channels</option>';
        publishChannelSelect.innerHTML = '<option value="">Error loading channels</option>';
    }
}

function buildChannelOptions(customEvents) {
    // Clear and add default option
    channelSelect.innerHTML = '';
    publishChannelSelect.innerHTML = '';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'Select an event channel...';
    channelSelect.appendChild(defaultOpt);
    publishChannelSelect.appendChild(defaultOpt.cloneNode(true));

    // Custom Events optgroup
    if (customEvents.length > 0) {
        const customGroup = document.createElement('optgroup');
        customGroup.label = 'Custom Events';

        customEvents.forEach(evt => {
            const opt = document.createElement('option');
            opt.value = evt.QualifiedApiName;
            opt.textContent = evt.Label || evt.DeveloperName;
            customGroup.appendChild(opt);
        });

        channelSelect.appendChild(customGroup);
        publishChannelSelect.appendChild(customGroup.cloneNode(true));
    }

    // Standard Events optgroup
    const standardGroup = document.createElement('optgroup');
    standardGroup.label = 'Standard Events';

    STANDARD_EVENTS.forEach(evt => {
        const opt = document.createElement('option');
        opt.value = evt.name;
        opt.textContent = evt.label;
        standardGroup.appendChild(opt);
    });

    channelSelect.appendChild(standardGroup);
    publishChannelSelect.appendChild(standardGroup.cloneNode(true));

    // If no custom events, show a message
    if (customEvents.length === 0) {
        const noCustomOpt = document.createElement('option');
        noCustomOpt.value = '';
        noCustomOpt.disabled = true;
        noCustomOpt.textContent = '(No custom events found)';
        // Insert before standard group
        channelSelect.insertBefore(noCustomOpt, channelSelect.querySelector('optgroup'));
        publishChannelSelect.insertBefore(noCustomOpt.cloneNode(true), publishChannelSelect.querySelector('optgroup'));
    }
}

function toggleSubscription() {
    if (isSubscribed) {
        unsubscribe();
    } else {
        subscribe();
    }
}

/**
 * Subscribe to a Platform Event channel via gRPC Pub/Sub API
 */
async function subscribe() {
    const channel = channelSelect.value;
    if (!channel) {
        updateStreamStatus('Select a channel', 'error');
        return;
    }

    if (!isAuthenticated()) {
        updateStreamStatus('Not authenticated', 'error');
        return;
    }

    if (!isProxyConnected()) {
        updateStreamStatus('Proxy required', 'error');
        appendSystemMessage('Platform Events require the local proxy. Open Settings to connect.');
        return;
    }

    updateStreamStatus('Connecting...', 'loading');
    subscribeBtn.disabled = true;

    try {
        // Get replay options
        const replayPreset = replaySelect.value;
        const replayId = replayPreset === 'CUSTOM' ? replayIdInput.value : undefined;

        const response = await chrome.runtime.sendMessage({
            type: 'subscribe',
            instanceUrl: getInstanceUrl(),
            accessToken: getAccessToken(),
            topicName: `/event/${channel}`,
            replayPreset,
            replayId
        });

        if (response.success) {
            currentSubscriptionId = response.subscriptionId;
            isSubscribed = true;
            updateStreamStatus('Subscribed', 'success');
            subscribeBtn.textContent = 'Unsubscribe';
            appendSystemMessage(`Subscribed to /event/${channel} (replay: ${replayPreset})`);
        } else {
            throw new Error(response.error || 'Subscription failed');
        }
    } catch (err) {
        console.error('Subscribe error:', err);
        updateStreamStatus('Error', 'error');
        appendSystemMessage(`Error: ${err.message}`);
    } finally {
        subscribeBtn.disabled = false;
    }
}

/**
 * Unsubscribe from the current channel
 */
async function unsubscribe() {
    if (!currentSubscriptionId) return;

    subscribeBtn.disabled = true;
    updateStreamStatus('Disconnecting...', 'loading');

    try {
        await chrome.runtime.sendMessage({
            type: 'unsubscribe',
            subscriptionId: currentSubscriptionId
        });
        appendSystemMessage('Unsubscribed');
    } catch (err) {
        console.error('Unsubscribe error:', err);
    }

    handleDisconnect();
}

/**
 * Handle disconnect (cleanup state)
 */
function handleDisconnect() {
    currentSubscriptionId = null;
    isSubscribed = false;
    subscribeBtn.textContent = 'Subscribe';
    subscribeBtn.disabled = false;
    updateStreamStatus('Disconnected', '');
}

function appendEvent(event) {
    eventCount++;
    const timestamp = new Date().toISOString();

    const eventEntry = {
        _eventNumber: eventCount,
        _receivedAt: timestamp,
        replayId: event.replayId,
        payload: event.payload,
        error: event.error
    };

    const currentValue = streamEditor.getValue();
    const newEntry = JSON.stringify(eventEntry, null, 2);

    if (currentValue.startsWith('//')) {
        // First event, replace the placeholder
        streamEditor.setValue(newEntry);
    } else {
        // Append to existing events
        streamEditor.setValue(currentValue + '\n\n' + newEntry);
    }

    // Scroll to bottom
    const lineCount = streamEditor.getModel().getLineCount();
    streamEditor.revealLine(lineCount);
}

function appendSystemMessage(msg) {
    const timestamp = new Date().toLocaleTimeString();
    const current = streamEditor.getValue();
    const newContent = current + `// [${timestamp}] ${msg}\n`;
    streamEditor.setValue(newContent);

    // Scroll to bottom
    const lineCount = streamEditor.getModel().getLineCount();
    streamEditor.revealLine(lineCount);
}

function clearStream() {
    eventCount = 0;
    streamEditor.setValue('// Stream cleared\n');
}

async function publishEvent() {
    const channel = publishChannelSelect.value;
    if (!channel) {
        updatePublishStatus('Select an event type', 'error');
        return;
    }

    if (!isAuthenticated()) {
        updatePublishStatus('Not authenticated', 'error');
        return;
    }

    let payload;
    try {
        payload = JSON.parse(publishEditor.getValue());
    } catch (err) {
        updatePublishStatus('Invalid JSON', 'error');
        return;
    }

    updatePublishStatus('Publishing...', 'loading');
    publishBtn.disabled = true;

    try {
        const instanceUrl = getInstanceUrl();
        const token = getAccessToken();

        const response = await extensionFetch(
            `${instanceUrl}/services/data/v62.0/sobjects/${channel}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }
        );

        if (response.success) {
            const data = JSON.parse(response.data);
            updatePublishStatus('Published', 'success');
            appendSystemMessage(`Published event: ${data.id || 'success'}`);
        } else {
            let errorMsg = 'Publish failed';
            try {
                const errorData = JSON.parse(response.data);
                if (Array.isArray(errorData) && errorData[0]?.message) {
                    errorMsg = errorData[0].message;
                }
            } catch (e) {
                // Use default error message
            }
            updatePublishStatus(errorMsg, 'error');
        }
    } catch (err) {
        console.error('Publish error:', err);
        updatePublishStatus('Error', 'error');
    } finally {
        publishBtn.disabled = false;
    }
}

function updateStreamStatus(text, type = '') {
    streamStatus.textContent = text;
    streamStatus.className = 'status-badge';
    if (type) streamStatus.classList.add(`status-${type}`);
}

function updatePublishStatus(text, type = '') {
    publishStatus.textContent = text;
    publishStatus.className = 'status-badge';
    if (type) publishStatus.classList.add(`status-${type}`);
}
