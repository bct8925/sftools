// Aura Debugger - Custom Element
import template from './aura.html?raw';
import './aura.css';
import '../monaco-editor/monaco-editor.js';
import { extensionFetch } from '../../lib/utils.js';

const PRESETS = {
    getItems: {
        descriptor: 'serviceComponent://ui.force.components.controllers.lists.selectableListDataProvider.SelectableListDataProviderController/ACTION$getItems',
        params: {
            'entityNameOrId': 'Account',
            'layoutType': 'FULL',
            'pageSize': 25,
            'currentPage': 0,
            'useTimeout': false,
            'getCount': true,
            'enableRowActions': false
        }
    },
    getObjectInfo: {
        descriptor: 'aura://RecordUiController/ACTION$getObjectInfo',
        params: {
            "objectApiName": "Account"
        }
    },
    getConfigData: {
        descriptor: 'serviceComponent://ui.force.components.controllers.hostConfig.HostConfigController/ACTION$getConfigData',
        params: {}
    },
    auraCmpDef: {
        descriptor: 'aura://ComponentController/ACTION$getComponentDef',
        params: {
            "name": "markup://force:recordData"
        }
    },
    apex: {
        descriptor: 'aura://ApexActionController/ACTION$execute',
        params: {
            "namespace": "",
            "classname": "MyApexController",
            "method": "myMethod",
            "cacheable": false,
            "isContinuation": false,
            "params": { "someKey": "someValue" }
        }
    },
    custom: {
        descriptor: '',
        params: {}
    }
};

class AuraPage extends HTMLElement {
    // DOM references
    disclaimerOverlay = null;
    disclaimerCheckbox = null;
    disclaimerAccept = null;
    disclaimerCancel = null;
    standaloneHeader = null;
    contentArea = null;
    communityUrlInput = null;
    authModeRadios = null;
    authFieldsDiv = null;
    authTokenInput = null;
    authSidInput = null;
    methodSelector = null;
    methodDescriptorInput = null;
    fwuidInput = null;
    executeBtn = null;
    statusBadge = null;
    paramsEditor = null;
    responseEditor = null;
    resizer = null;

    // Resizer state
    isResizing = false;
    startY = 0;
    startHeight = 0;

    // Bound handlers for cleanup
    boundMouseMove = null;
    boundMouseUp = null;

    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.initEditors();
        this.attachEventListeners();
        this.setupDisclaimer();
    }

    disconnectedCallback() {
        document.removeEventListener('mousemove', this.boundMouseMove);
        document.removeEventListener('mouseup', this.boundMouseUp);
    }

    initElements() {
        this.disclaimerOverlay = this.querySelector('#disclaimerOverlay');
        this.disclaimerCheckbox = this.querySelector('#disclaimerCheckbox');
        this.disclaimerAccept = this.querySelector('#disclaimerAccept');
        this.disclaimerCancel = this.querySelector('#disclaimerCancel');
        this.standaloneHeader = this.querySelector('.standalone-header');
        this.contentArea = this.querySelector('.content-area');
        this.communityUrlInput = this.querySelector('#communityUrl');
        this.authModeRadios = this.querySelectorAll('[name="authMode"]');
        this.authFieldsDiv = this.querySelector('#authFields');
        this.authTokenInput = this.querySelector('#authToken');
        this.authSidInput = this.querySelector('#authSid');
        this.methodSelector = this.querySelector('#methodSelector');
        this.methodDescriptorInput = this.querySelector('#methodDescriptor');
        this.fwuidInput = this.querySelector('#fwuid');
        this.executeBtn = this.querySelector('#executeBtn');
        this.statusBadge = this.querySelector('#status');
        this.paramsEditor = this.querySelector('#paramsEditor');
        this.responseEditor = this.querySelector('#responseEditor');
        this.resizer = this.querySelector('#responseResizer');
    }

    initEditors() {
        this.paramsEditor.setValue(JSON.stringify(PRESETS.getItems.params, null, 4));
        this.responseEditor.setValue('// Response will appear here');
    }

    attachEventListeners() {
        // Auth mode toggle
        this.authModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => this.handleAuthModeChange(e));
        });

        // Method selector
        this.methodSelector.addEventListener('change', (e) => this.handleMethodChange(e));

        // Execute button
        this.executeBtn.addEventListener('click', () => this.executeRequest());

        // Resizer
        this.resizer.addEventListener('mousedown', (e) => this.handleResizerMouseDown(e));
        this.boundMouseMove = (e) => this.handleMouseMove(e);
        this.boundMouseUp = () => this.handleMouseUp();
        document.addEventListener('mousemove', this.boundMouseMove);
        document.addEventListener('mouseup', this.boundMouseUp);
    }

    setupDisclaimer() {
        // Disable main content while modal is shown
        this.standaloneHeader.classList.add('main-content-disabled');
        this.contentArea.classList.add('main-content-disabled');

        // Click on container toggles checkbox
        this.querySelector('.disclaimer-checkbox-container').addEventListener('click', (e) => {
            if (e.target !== this.disclaimerCheckbox) {
                this.disclaimerCheckbox.click();
            }
        });

        // Enable accept button only when checkbox is checked
        this.disclaimerCheckbox.addEventListener('change', () => {
            this.disclaimerAccept.disabled = !this.disclaimerCheckbox.checked;
        });

        // Accept button - hide modal and enable content
        this.disclaimerAccept.addEventListener('click', () => {
            this.disclaimerOverlay.classList.add('hidden');
            this.standaloneHeader.classList.remove('main-content-disabled');
            this.contentArea.classList.remove('main-content-disabled');
        });

        // Cancel button - close the window/tab
        this.disclaimerCancel.addEventListener('click', () => {
            window.close();
            // Fallback if window.close() doesn't work
            this.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui, sans-serif;">
                    <div style="text-align: center; color: #666;">
                        <h2 style="margin-bottom: 10px;">Tool Access Declined</h2>
                        <p>You may close this tab.</p>
                    </div>
                </div>
            `;
        });
    }

    handleAuthModeChange(e) {
        if (e.target.value === 'auth') {
            this.authFieldsDiv.classList.remove('hidden');
        } else {
            this.authFieldsDiv.classList.add('hidden');
        }
    }

    handleMethodChange(e) {
        const key = e.target.value;
        const preset = PRESETS[key];

        if (key === 'custom') {
            this.methodDescriptorInput.value = '';
            this.methodDescriptorInput.disabled = false;
            this.methodDescriptorInput.style.backgroundColor = '#fff';
            this.paramsEditor.setValue('{\n    \n}');
        } else {
            this.methodDescriptorInput.value = preset.descriptor;
            this.methodDescriptorInput.disabled = true;
            this.methodDescriptorInput.style.backgroundColor = '#f3f4f6';
            this.paramsEditor.setValue(JSON.stringify(preset.params, null, 4));
        }
    }

    setStatus(text, type) {
        this.statusBadge.textContent = text;
        this.statusBadge.className = 'status-badge';
        if (type === 'success') {
            this.statusBadge.classList.add('status-success');
        } else if (type === 'error') {
            this.statusBadge.classList.add('status-error');
        } else if (type === 'loading') {
            this.statusBadge.classList.add('status-loading');
        }
    }

    // Cookie Helpers
    async getCookie(url, name) {
        return new Promise((resolve) => {
            chrome.cookies.get({ url, name }, (cookie) => {
                resolve(cookie ? cookie.value : null);
            });
        });
    }

    async setCookie(url, name, value) {
        const urlObj = new URL(url);
        return new Promise((resolve) => {
            chrome.cookies.set({
                url: url,
                name: name,
                value: value,
                domain: urlObj.hostname,
                path: '/'
            }, (cookie) => {
                resolve(cookie);
            });
        });
    }

    async removeCookie(url, name) {
        return new Promise((resolve) => {
            chrome.cookies.remove({ url, name }, () => {
                resolve();
            });
        });
    }

    validateRequest(url, descriptor, paramsJson) {
        if (!url) return { valid: false, error: 'Enter Community URL' };
        if (!descriptor) return { valid: false, error: 'Enter Method Descriptor' };
        try {
            JSON.parse(paramsJson);
            return { valid: true };
        } catch (e) {
            return { valid: false, error: 'Invalid JSON' };
        }
    }

    async resolveSessionId(url, providedSid) {
        if (providedSid) {
            await this.setCookie(url, 'sid', providedSid);
            return { sid: providedSid, cleanup: true };
        }

        const sid = await this.getCookie(url, 'sid');
        if (!sid) {
            throw new Error('No SID cookie found for this domain. Either provide a SID value manually, or ensure you are logged into this Salesforce org in your browser.');
        }
        return { sid, cleanup: false };
    }

    parseAuraResponse(responseText) {
        const cleanJson = responseText.replace(/^while\(1\);/, '');
        return JSON.parse(cleanJson);
    }

    async executeRequest() {
        const url = this.communityUrlInput.value.replace(/\/$/, '');
        const isAuth = this.querySelector('input[name="authMode"]:checked').value === 'auth';
        const descriptor = this.methodDescriptorInput.value;

        const validation = this.validateRequest(url, descriptor, this.paramsEditor.getValue());
        if (!validation.valid) {
            this.setStatus(validation.error, 'error');
            return;
        }

        const params = JSON.parse(this.paramsEditor.getValue());
        let sessionInfo = null;

        if (isAuth) {
            try {
                sessionInfo = await this.resolveSessionId(url, this.authSidInput.value.trim());
            } catch (e) {
                this.setStatus('Auth Error', 'error');
                this.responseEditor.setValue(JSON.stringify({ error: e.message }, null, 4));
                return;
            }
        }

        this.setStatus('Executing...', 'loading');
        this.responseEditor.setValue('// Loading...');

        try {
            const token = isAuth ? this.authTokenInput.value : null;
            const result = await this.performAuraRequest(url, descriptor, params, this.fwuidInput.value, token, isAuth);
            const parsed = this.parseAuraResponse(result);
            this.responseEditor.setValue(JSON.stringify(parsed, null, 4));
            this.setStatus('Success', 'success');
        } catch (error) {
            this.responseEditor.setValue(JSON.stringify({ error: error.message }, null, 4));
            this.setStatus(error.message.includes('JSON') ? 'Non-JSON Response' : 'Error', 'error');
        } finally {
            if (sessionInfo?.cleanup) {
                await this.removeCookie(url, 'sid').catch(() => {});
            }
        }
    }

    async performAuraRequest(url, actionDescriptor, params, fwuid, token, isAuth) {
        const messageData = {
            'actions': [{
                'descriptor': actionDescriptor,
                'params': params,
                'id': `${Math.floor(Math.random() * 1000)}`,
                'callingDescriptor': 'UNKNOWN'
            }]
        };

        const auraContext = {
            "mode": "PROD",
            "fwuid": fwuid,
            "app": "siteforce:communityApp",
            "loaded": { "APPLICATION@markup://siteforce:communityApp": "1419_b1bLMAuSpl9zzW1jkVMf-w" },
            "dn": [],
            "globals": {},
            "uad": true
        };

        const message = encodeURIComponent(JSON.stringify(messageData));
        const aura = encodeURIComponent(JSON.stringify(auraContext));
        const tokenVal = token ? encodeURIComponent(token) : 'null';

        const bodyData = `message=${message}&aura.context=${aura}&aura.pageURI=/&aura.token=${tokenVal}`;

        const response = await extensionFetch(`${url}/aura`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            body: bodyData,
            credentials: isAuth ? 'include' : 'omit'
        });

        if (!response.success) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.data;
    }

    // Resizer handlers
    handleResizerMouseDown(e) {
        this.isResizing = true;
        this.startY = e.clientY;
        this.startHeight = this.responseEditor.offsetHeight;
        this.resizer.classList.add('resizing');
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
    }

    handleMouseMove(e) {
        if (!this.isResizing) return;
        const dy = e.clientY - this.startY;
        const newHeight = Math.max(100, this.startHeight + dy);
        this.responseEditor.style.height = `${newHeight}px`;
        this.responseEditor.editor?.layout();
    }

    handleMouseUp() {
        if (this.isResizing) {
            this.isResizing = false;
            this.resizer.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    }
}

customElements.define('aura-page', AuraPage);
