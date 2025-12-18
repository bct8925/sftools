// REST API Tab Module
import { createEditor, createReadOnlyEditor } from '../lib/monaco.js';
import { extensionFetch, getAccessToken, getInstanceUrl, isAuthenticated } from '../lib/utils.js';

let requestEditor = null;
let responseEditor = null;

export function init() {
    const urlInput = document.getElementById('rest-api-url');
    const methodSelect = document.getElementById('rest-method-select');
    const bodyContainer = document.getElementById('rest-body-container');
    const sendButton = document.getElementById('rest-send-btn');
    const statusSpan = document.getElementById('rest-status');

    // Initialize Monaco editors
    requestEditor = createEditor(document.getElementById('rest-request-editor'), {
        value: '{\n    \n}',
        language: 'json'
    });

    responseEditor = createReadOnlyEditor(document.getElementById('rest-response-editor'), {
        value: '// Response will appear here',
        language: 'json'
    });

    // Toggle body input based on method
    function toggleBodyInput() {
        const method = methodSelect.value;
        if (method === 'POST' || method === 'PATCH') {
            bodyContainer.style.display = 'block';
        } else {
            bodyContainer.style.display = 'none';
        }
    }

    // Update status badge
    function updateStatus(status, type = '') {
        statusSpan.textContent = status;
        statusSpan.className = 'status-badge';
        if (type) {
            statusSpan.classList.add(`status-${type}`);
        }
    }

    // Send REST API request
    async function sendRequest() {
        const url = urlInput.value.trim();
        const method = methodSelect.value;

        if (!url) {
            alert('Please enter an API URL.');
            return;
        }

        if (!isAuthenticated()) {
            alert('Not authenticated. Please authorize via the extension popup first.');
            return;
        }

        updateStatus('Loading...', 'loading');
        responseEditor.setValue('// Loading...');

        try {
            const fullUrl = `${getInstanceUrl()}${url}`;

            const requestOptions = {
                method: method,
                headers: {
                    'Authorization': `Bearer ${getAccessToken()}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            };

            // Add body for POST/PATCH requests
            if (method === 'POST' || method === 'PATCH') {
                const bodyValue = requestEditor.getValue();
                try {
                    JSON.parse(bodyValue); // Validate JSON
                    requestOptions.body = bodyValue;
                } catch (e) {
                    alert('Invalid JSON in Request Body.');
                    updateStatus('Invalid JSON', 'error');
                    return;
                }
            }

            const response = await extensionFetch(fullUrl, requestOptions);

            if (response.success) {
                const statusCode = response.status.toString();
                updateStatus(statusCode, 'success');

                try {
                    const parsed = JSON.parse(response.data);
                    responseEditor.setValue(JSON.stringify(parsed, null, 2));
                } catch (e) {
                    responseEditor.setValue(response.data);
                }
            } else {
                updateStatus(`${response.status || 'Error'}`, 'error');

                let errorOutput = response.data || response.error || response.statusText || 'Unknown error';
                try {
                    const parsed = JSON.parse(errorOutput);
                    errorOutput = JSON.stringify(parsed, null, 2);
                } catch (e) {
                    // Keep as-is if not JSON
                }
                responseEditor.setValue(errorOutput);
            }

        } catch (error) {
            updateStatus('Client Error', 'error');
            responseEditor.setValue(`Error: ${error.message}`);
            console.error('REST API Error:', error);
        }
    }

    // Event listeners
    methodSelect.addEventListener('change', toggleBodyInput);
    sendButton.addEventListener('click', sendRequest);

    // Initial state
    toggleBodyInput();
}
