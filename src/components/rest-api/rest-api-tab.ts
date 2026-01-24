// REST API Tab - Salesforce REST API Explorer
import { isAuthenticated } from '../../lib/utils.js';
import { executeRestRequest } from '../../lib/salesforce.js';
import { updateStatusBadge } from '../../lib/ui-helpers.js';
import { shouldShowBody } from '../../lib/rest-api-utils.js';
import type { MonacoEditorElement } from '../../types/components';
import type { StatusType } from '../../lib/ui-helpers';
import '../monaco-editor/monaco-editor.js';
import template from './rest-api.html?raw';

class RestApiTab extends HTMLElement {
    // DOM references
    private urlInput!: HTMLInputElement;
    private methodSelect!: HTMLSelectElement;
    private bodyContainer!: HTMLElement;
    private sendButton!: HTMLButtonElement;
    private statusSpan!: HTMLElement;
    private requestEditor!: MonacoEditorElement;
    private responseEditor!: MonacoEditorElement;

    connectedCallback(): void {
        this.innerHTML = template;
        this.initElements();
        this.initEditors();
        this.attachEventListeners();
        this.toggleBodyInput();
    }

    private initElements(): void {
        this.urlInput = this.querySelector<HTMLInputElement>('.rest-api-url')!;
        this.methodSelect = this.querySelector<HTMLSelectElement>('.rest-method-select')!;
        this.bodyContainer = this.querySelector<HTMLElement>('.rest-body-container')!;
        this.sendButton = this.querySelector<HTMLButtonElement>('.rest-send-btn')!;
        this.statusSpan = this.querySelector<HTMLElement>('.rest-status')!;
    }

    private initEditors(): void {
        this.requestEditor = this.querySelector<MonacoEditorElement>('.rest-request-editor')!;
        this.responseEditor = this.querySelector<MonacoEditorElement>('.rest-response-editor')!;

        this.requestEditor.setValue('{\n    \n}');
        this.responseEditor.setValue('// Response will appear here');
    }

    private attachEventListeners(): void {
        this.methodSelect.addEventListener('change', this.toggleBodyInput);
        this.sendButton.addEventListener('click', this.executeRequest);
        this.requestEditor.addEventListener('execute', this.executeRequest);
    }

    private toggleBodyInput = (): void => {
        const method = this.methodSelect.value;
        if (shouldShowBody(method)) {
            this.bodyContainer.style.display = 'block';
        } else {
            this.bodyContainer.style.display = 'none';
        }
    };

    private updateStatus(status: string, type: StatusType = ''): void {
        updateStatusBadge(this.statusSpan, status, type);
    }

    private executeRequest = async (): Promise<void> => {
        const url = this.urlInput.value.trim();
        const method = this.methodSelect.value;

        if (!url) {
            alert('Please enter an API URL.');
            return;
        }

        if (!isAuthenticated()) {
            alert('Not authenticated. Please authorize via the connection selector.');
            return;
        }

        // Validate JSON for POST/PATCH/PUT
        let body: string | null = null;
        if (shouldShowBody(method)) {
            const bodyValue = this.requestEditor.getValue();
            try {
                JSON.parse(bodyValue);
                body = bodyValue;
            } catch {
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
            } else if (response.raw) {
                this.responseEditor.setValue(response.raw);
            } else if (response.error) {
                this.responseEditor.setValue(`Error: ${response.error}`);
            } else {
                this.responseEditor.setValue(response.statusText || 'No response');
            }
        } catch (error) {
            this.updateStatus('Client Error', 'error');
            this.responseEditor.setValue(`Error: ${(error as Error).message}`);
            console.error('REST API Error:', error);
        }
    };
}

customElements.define('rest-api-tab', RestApiTab);
