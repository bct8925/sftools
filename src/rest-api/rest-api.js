// REST API Tab Module - UI Controller
import { createEditor, createReadOnlyEditor, monaco } from '../lib/monaco.js';
import { isAuthenticated } from '../lib/utils.js';
import { executeRestRequest } from '../lib/salesforce.js';

let requestEditor = null;
let responseEditor = null;

export function init() {
    const urlInput = document.getElementById('rest-api-url');
    const methodSelect = document.getElementById('rest-method-select');
    const bodyContainer = document.getElementById('rest-body-container');
    const sendButton = document.getElementById('rest-send-btn');
    const statusSpan = document.getElementById('rest-status');

    requestEditor = createEditor(document.getElementById('rest-request-editor'), {
        value: '{\n    \n}',
        language: 'json'
    });

    responseEditor = createReadOnlyEditor(document.getElementById('rest-response-editor'), {
        value: '// Response will appear here',
        language: 'json'
    });

    function toggleBodyInput() {
        const method = methodSelect.value;
        if (method === 'POST' || method === 'PATCH') {
            bodyContainer.style.display = 'block';
        } else {
            bodyContainer.style.display = 'none';
        }
    }

    function updateStatus(status, type = '') {
        statusSpan.textContent = status;
        statusSpan.className = 'status-badge';
        if (type) {
            statusSpan.classList.add(`status-${type}`);
        }
    }

    async function executeRequest() {
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

        // Validate JSON for POST/PATCH
        let body = null;
        if (method === 'POST' || method === 'PATCH') {
            const bodyValue = requestEditor.getValue();
            try {
                JSON.parse(bodyValue);
                body = bodyValue;
            } catch (e) {
                alert('Invalid JSON in Request Body.');
                updateStatus('Invalid JSON', 'error');
                return;
            }
        }

        updateStatus('Loading...', 'loading');
        responseEditor.setValue('// Loading...');

        try {
            const response = await executeRestRequest(url, method, body);

            updateStatus(response.status.toString(), response.success ? 'success' : 'error');

            if (typeof response.data === 'object') {
                responseEditor.setValue(JSON.stringify(response.data, null, 2));
            } else {
                responseEditor.setValue(response.raw || String(response.data));
            }

        } catch (error) {
            updateStatus('Client Error', 'error');
            responseEditor.setValue(`Error: ${error.message}`);
            console.error('REST API Error:', error);
        }
    }

    methodSelect.addEventListener('change', toggleBodyInput);
    sendButton.addEventListener('click', executeRequest);

    requestEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, executeRequest);

    toggleBodyInput();
}
