// Settings Tab - Proxy Connection & Custom Connected App
import template from './settings.html?raw';
import './settings.css';
import {
    getOAuthCredentials,
    loadCustomConnectedApp,
    saveCustomConnectedApp,
    clearCustomConnectedApp
} from '../../lib/utils.js';

class SettingsTab extends HTMLElement {
    // Proxy DOM references
    proxyToggle = null;
    proxyStatus = null;
    proxyIndicator = null;
    proxyLabel = null;
    proxyDetail = null;
    versionInfo = null;

    // Custom Connected App DOM references
    customAppToggle = null;
    customAppClientId = null;
    customAppSaveBtn = null;
    customAppResetBtn = null;
    customAppFields = null;

    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.attachEventListeners();
        this.initProxyUI();
        this.initCustomAppUI();
    }

    initElements() {
        // Proxy elements
        this.proxyToggle = this.querySelector('.settings-proxy-toggle');
        this.proxyStatus = this.querySelector('.settings-proxy-status');
        this.proxyIndicator = this.querySelector('.settings-proxy-indicator');
        this.proxyLabel = this.querySelector('.settings-proxy-label');
        this.proxyDetail = this.querySelector('.settings-proxy-detail');
        this.versionInfo = this.querySelector('.settings-version-info');

        // Custom Connected App elements
        this.customAppToggle = this.querySelector('.settings-custom-app-toggle');
        this.customAppClientId = this.querySelector('.settings-custom-app-client-id');
        this.customAppSaveBtn = this.querySelector('.settings-custom-app-save-btn');
        this.customAppResetBtn = this.querySelector('.settings-custom-app-reset-btn');
        this.customAppFields = this.querySelector('.settings-custom-app-fields');
    }

    attachEventListeners() {
        this.proxyToggle.addEventListener('change', () => this.handleProxyToggle());

        // Custom Connected App listeners
        this.customAppToggle.addEventListener('change', () => this.handleCustomAppToggle());
        this.customAppSaveBtn.addEventListener('click', () => this.saveCustomApp());
        this.customAppResetBtn.addEventListener('click', () => this.resetCustomApp());
    }

    // ============================================================
    // Proxy Management
    // ============================================================

    async initProxyUI() {
        const { proxyEnabled } = await chrome.storage.local.get(['proxyEnabled']);
        this.proxyToggle.checked = proxyEnabled || false;

        if (proxyEnabled) {
            this.proxyStatus.classList.remove('hidden');
            await this.checkProxyStatus();
        }
    }

    async handleProxyToggle() {
        const enabled = this.proxyToggle.checked;
        await chrome.storage.local.set({ proxyEnabled: enabled });

        if (enabled) {
            this.proxyStatus.classList.remove('hidden');
            await this.connect();
        } else {
            await this.disconnect();
            this.proxyStatus.classList.add('hidden');
        }
    }

    updateProxyUI(status) {
        const { connected, httpPort, version, error } = status;

        this.proxyIndicator.className = 'status-indicator ' + (connected ? 'connected' : 'disconnected');

        if (connected) {
            this.proxyLabel.textContent = 'Connected';
            this.proxyDetail.textContent = `HTTP server on port ${httpPort}`;

            if (version) {
                this.versionInfo.textContent = `Proxy version: ${version}`;
                this.versionInfo.style.display = 'block';
            }
        } else {
            this.proxyLabel.textContent = 'Not Connected';
            this.proxyDetail.textContent = error || '';
            this.versionInfo.style.display = 'none';
        }
    }

    setConnecting() {
        this.proxyIndicator.className = 'status-indicator connecting';
        this.proxyLabel.textContent = 'Connecting...';
        this.proxyDetail.textContent = 'Establishing connection to local proxy';
    }

    async checkProxyStatus() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'checkProxyConnection' });
            this.updateProxyUI(response);
        } catch (err) {
            this.updateProxyUI({ connected: false, error: err.message });
        }
    }

    async connect() {
        this.setConnecting();

        try {
            const response = await chrome.runtime.sendMessage({ type: 'connectProxy' });

            if (response.success) {
                this.updateProxyUI({
                    connected: true,
                    httpPort: response.httpPort,
                    version: response.version
                });
            } else {
                this.updateProxyUI({
                    connected: false,
                    error: response.error || 'Connection failed'
                });
            }
        } catch (err) {
            this.updateProxyUI({ connected: false, error: err.message });
        }
    }

    async disconnect() {
        try {
            await chrome.runtime.sendMessage({ type: 'disconnectProxy' });
            this.updateProxyUI({ connected: false });
        } catch (err) {
            console.error('Disconnect error:', err);
        }
    }

    // ============================================================
    // Custom Connected App Management
    // ============================================================

    async initCustomAppUI() {
        const config = await loadCustomConnectedApp();

        if (config) {
            this.customAppToggle.checked = config.enabled;
            this.customAppClientId.value = config.clientId || '';
        }

        this.updateCustomAppFieldsVisibility();
    }

    handleCustomAppToggle() {
        this.updateCustomAppFieldsVisibility();
    }

    updateCustomAppFieldsVisibility() {
        if (this.customAppToggle.checked) {
            this.customAppFields.classList.remove('hidden');
        } else {
            this.customAppFields.classList.add('hidden');
        }
    }

    async saveCustomApp() {
        const clientId = this.customAppClientId.value.trim();

        if (this.customAppToggle.checked && !clientId) {
            alert('Client ID is required when using a custom connected app.');
            return;
        }

        await saveCustomConnectedApp({
            enabled: this.customAppToggle.checked,
            clientId: clientId
        });

        // Show confirmation
        this.customAppSaveBtn.textContent = 'Saved!';
        setTimeout(() => {
            this.customAppSaveBtn.textContent = 'Save';
        }, 1500);
    }

    async resetCustomApp() {
        if (!confirm('Reset to default connected app? Your custom app settings will be removed.')) {
            return;
        }

        await clearCustomConnectedApp();

        this.customAppToggle.checked = false;
        this.customAppClientId.value = '';
        this.updateCustomAppFieldsVisibility();
    }
}

customElements.define('settings-tab', SettingsTab);
