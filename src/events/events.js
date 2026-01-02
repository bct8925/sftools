// Platform Events Tab - Subscribe to streams and publish events
// Uses custom Bayeux/CometD client that routes through background service worker
import { createEditor, createReadOnlyEditor, monaco } from '../lib/monaco.js';
import { extensionFetch, getAccessToken, getInstanceUrl, isAuthenticated } from '../lib/utils.js';

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

// Streaming state
let clientId = null;
let isConnected = false;
let isPolling = false;
let currentChannel = null;

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

    // Initialize Monaco editors
    streamEditor = createReadOnlyEditor(document.getElementById('event-stream-editor'), {
        language: 'json',
        value: '// Waiting for events...\n',
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

    // Sync channel selects
    channelSelect.addEventListener('change', () => {
        publishChannelSelect.value = channelSelect.value;
    });
    publishChannelSelect.addEventListener('change', () => {
        channelSelect.value = publishChannelSelect.value;
    });

    // Load available channels
    loadEventChannels();
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
    if (isConnected) {
        disconnect();
    } else {
        connect();
    }
}

// Custom Bayeux/CometD client using extensionFetch
async function bayeuxRequest(messages) {
    const instanceUrl = getInstanceUrl();
    const token = getAccessToken();

    const response = await extensionFetch(`${instanceUrl}/cometd/62.0`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(messages)
    });

    if (!response.success) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return JSON.parse(response.data);
}

async function connect() {
    const channel = channelSelect.value;
    if (!channel) {
        updateStreamStatus('Select a channel', 'error');
        return;
    }

    if (!isAuthenticated()) {
        updateStreamStatus('Not authenticated', 'error');
        return;
    }

    updateStreamStatus('Connecting...', 'loading');
    subscribeBtn.disabled = true;
    currentChannel = `/event/${channel}`;

    try {
        // Step 1: Handshake
        const handshakeResponse = await bayeuxRequest([{
            channel: '/meta/handshake',
            version: '1.0',
            supportedConnectionTypes: ['long-polling']
        }]);

        const handshake = handshakeResponse[0];
        if (!handshake.successful) {
            throw new Error(handshake.error || 'Handshake failed');
        }

        clientId = handshake.clientId;
        appendSystemMessage('Handshake successful');

        // Step 2: Subscribe to the event channel
        const subscribeResponse = await bayeuxRequest([{
            channel: '/meta/subscribe',
            clientId: clientId,
            subscription: currentChannel
        }]);

        const subscribe = subscribeResponse[0];
        if (!subscribe.successful) {
            throw new Error(subscribe.error || 'Subscribe failed');
        }

        isConnected = true;
        isPolling = true;
        updateStreamStatus('Subscribed', 'success');
        subscribeBtn.textContent = 'Unsubscribe';
        subscribeBtn.disabled = false;
        appendSystemMessage(`Subscribed to ${currentChannel}`);

        // Step 3: Start long-polling for messages
        poll();

    } catch (err) {
        console.error('Connect error:', err);
        updateStreamStatus('Error', 'error');
        appendSystemMessage(`Error: ${err.message}`);
        subscribeBtn.disabled = false;
        clientId = null;
        isConnected = false;
    }
}

async function poll() {
    if (!isPolling || !clientId) return;

    try {
        const response = await bayeuxRequest([{
            channel: '/meta/connect',
            clientId: clientId,
            connectionType: 'long-polling'
        }]);

        // Process any messages received
        for (const msg of response) {
            if (msg.channel === currentChannel && msg.data) {
                appendEvent(msg);
            } else if (msg.channel === '/meta/connect') {
                if (!msg.successful) {
                    console.error('Connect failed:', msg);
                    if (msg.error?.includes('402') || msg.error?.includes('403')) {
                        // Session expired or unauthorized
                        updateStreamStatus('Session expired', 'error');
                        appendSystemMessage('Session expired - please re-authorize');
                        disconnect();
                        return;
                    }
                }
            }
        }

        // Continue polling if still connected
        if (isPolling) {
            poll();
        }

    } catch (err) {
        console.error('Poll error:', err);
        if (isPolling) {
            appendSystemMessage(`Poll error: ${err.message}`);
            // Retry after a short delay
            setTimeout(() => {
                if (isPolling) poll();
            }, 2000);
        }
    }
}

async function disconnect() {
    isPolling = false;

    if (clientId) {
        try {
            // Unsubscribe
            if (currentChannel) {
                await bayeuxRequest([{
                    channel: '/meta/unsubscribe',
                    clientId: clientId,
                    subscription: currentChannel
                }]);
            }

            // Disconnect
            await bayeuxRequest([{
                channel: '/meta/disconnect',
                clientId: clientId
            }]);
        } catch (err) {
            console.error('Disconnect error:', err);
        }
    }

    clientId = null;
    isConnected = false;
    currentChannel = null;
    subscribeBtn.textContent = 'Subscribe';
    subscribeBtn.disabled = false;
    updateStreamStatus('Disconnected', '');
    appendSystemMessage('Disconnected from stream');
}

function appendEvent(message) {
    const timestamp = new Date().toLocaleTimeString();
    const payload = message.data?.payload || message.data || message;
    const formatted = JSON.stringify(payload, null, 2);

    const current = streamEditor.getValue();
    const newContent = current + `\n// [${timestamp}] Event received:\n${formatted}\n`;
    streamEditor.setValue(newContent);

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
    streamEditor.setValue('// Waiting for events...\n');
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
