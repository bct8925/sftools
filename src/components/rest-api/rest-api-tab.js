// REST API Tab - Salesforce REST API Explorer
import template from './rest-api.html?raw';
import { createEditor, createReadOnlyEditor, monaco } from '../../lib/monaco.js';
import { isAuthenticated } from '../../lib/utils.js';
import { executeRestRequest } from '../../lib/salesforce.js';

class RestApiTab extends HTMLElement {
    // DOM references
    urlInput = null;
    methodSelect = null;
    bodyContainer = null;
    sendButton = null;
    statusSpan = null;
    requestEditor = null;
    responseEditor = null;

    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.initEditors();
        this.attachEventListeners();
        this.toggleBodyInput();
    }

    initElements() {
        this.urlInput = this.querySelector('.rest-api-url');
        this.methodSelect = this.querySelector('.rest-method-select');
        this.bodyContainer = this.querySelector('.rest-body-container');
        this.sendButton = this.querySelector('.rest-send-btn');
        this.statusSpan = this.querySelector('.rest-status');
    }

    initEditors() {
        this.requestEditor = createEditor(this.querySelector('.rest-request-editor'), {
            value: '{\n    \n}',
            language: 'json'
        });

        this.responseEditor = createReadOnlyEditor(this.querySelector('.rest-response-editor'), {
            value: '// Response will appear here',
            language: 'json'
        });
    }

    attachEventListeners() {
        this.methodSelect.addEventListener('change', () => this.toggleBodyInput());
        this.sendButton.addEventListener('click', () => this.executeRequest());
        this.requestEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            this.executeRequest();
        });
    }

    toggleBodyInput() {
        const method = this.methodSelect.value;
        if (method === 'POST' || method === 'PATCH') {
            this.bodyContainer.style.display = 'block';
        } else {
            this.bodyContainer.style.display = 'none';
        }
    }

    updateStatus(status, type = '') {
        this.statusSpan.textContent = status;
        this.statusSpan.className = 'status-badge';
        if (type) {
            this.statusSpan.classList.add(`status-${type}`);
        }
    }

    async executeRequest() {
        const url = this.urlInput.value.trim();
        const method = this.methodSelect.value;

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
            const bodyValue = this.requestEditor.getValue();
            try {
                JSON.parse(bodyValue);
                body = bodyValue;
            } catch (e) {
                alert('Invalid JSON in Request Body.');
                this.updateStatus('Invalid JSON', 'error');
                return;
            }
        }

        this.updateStatus('Loading...', 'loading');
        this.responseEditor.setValue('// Loading...');

        try {
            const response = await executeRestRequest(url, method, body);

            this.updateStatus(response.status.toString(), response.success ? 'success' : 'error');

            if (typeof response.data === 'object') {
                this.responseEditor.setValue(JSON.stringify(response.data, null, 2));
            } else {
                this.responseEditor.setValue(response.raw || String(response.data));
            }

        } catch (error) {
            this.updateStatus('Client Error', 'error');
            this.responseEditor.setValue(`Error: ${error.message}`);
            console.error('REST API Error:', error);
        }
    }
}

customElements.define('rest-api-tab', RestApiTab);
