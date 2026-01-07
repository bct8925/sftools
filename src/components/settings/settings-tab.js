// Settings Tab - Proxy Connection & Session Management
import template from './settings.html?raw';
import './settings.css';
import {
    isAuthenticated,
    getInstanceUrl,
    getOAuthCredentials,
    loadCustomConnectedApp,
    saveCustomConnectedApp,
    clearCustomConnectedApp
} from '../../lib/utils.js';

const CALLBACK_URL = 'https://sftools.dev/sftools-callback';

class SettingsTab extends HTMLElement {
    // Proxy DOM references
    proxyIndicator = null;
    proxyLabel = null;
    proxyDetail = null;
    connectBtn = null;
    disconnectBtn = null;
    versionInfo = null;

    // Session DOM references
    sessionIndicator = null;
    sessionLabel = null;
    sessionDetail = null;
    reauthBtn = null;
    logoutBtn = null;

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
        this.checkProxyStatus();
        this.updateSessionUI();
        this.initCustomAppUI();

        // Listen for auth changes
        document.addEventListener('auth-ready', () => this.updateSessionUI());
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && (changes.accessToken || changes.instanceUrl)) {
                this.updateSessionUI();
            }
        });
    }

    initElements() {
        // Proxy elements
        this.proxyIndicator = this.querySelector('.settings-proxy-indicator');
        this.proxyLabel = this.querySelector('.settings-proxy-label');
        this.proxyDetail = this.querySelector('.settings-proxy-detail');
        this.connectBtn = this.querySelector('.settings-connect-btn');
        this.disconnectBtn = this.querySelector('.settings-disconnect-btn');
        this.versionInfo = this.querySelector('.settings-version-info');

        // Session elements
        this.sessionIndicator = this.querySelector('.settings-session-indicator');
        this.sessionLabel = this.querySelector('.settings-session-label');
        this.sessionDetail = this.querySelector('.settings-session-detail');
        this.reauthBtn = this.querySelector('.settings-reauth-btn');
        this.logoutBtn = this.querySelector('.settings-logout-btn');

        // Custom Connected App elements
        this.customAppToggle = this.querySelector('.settings-custom-app-toggle');
        this.customAppClientId = this.querySelector('.settings-custom-app-client-id');
        this.customAppSaveBtn = this.querySelector('.settings-custom-app-save-btn');
        this.customAppResetBtn = this.querySelector('.settings-custom-app-reset-btn');
        this.customAppFields = this.querySelector('.settings-custom-app-fields');
    }

    attachEventListeners() {
        this.connectBtn.addEventListener('click', () => this.connect());
        this.disconnectBtn.addEventListener('click', () => this.disconnect());
        this.reauthBtn.addEventListener('click', () => this.reauthorize());
        this.logoutBtn.addEventListener('click', () => this.logout());

        // Custom Connected App listeners
        this.customAppToggle.addEventListener('change', () => this.handleCustomAppToggle());
        this.customAppSaveBtn.addEventListener('click', () => this.saveCustomApp());
        this.customAppResetBtn.addEventListener('click', () => this.resetCustomApp());
    }

    // ============================================================
    // Proxy Management
    // ============================================================

    updateProxyUI(status) {
        const { connected, httpPort, version, error } = status;

        this.proxyIndicator.className = 'status-indicator ' + (connected ? 'connected' : 'disconnected');

        if (connected) {
            this.proxyLabel.textContent = 'Connected';
            this.proxyDetail.textContent = `HTTP server on port ${httpPort}`;
            this.connectBtn.style.display = 'none';
            this.disconnectBtn.style.display = 'inline-flex';

            if (version) {
                this.versionInfo.textContent = `Proxy version: ${version}`;
                this.versionInfo.style.display = 'block';
            }
        } else {
            this.proxyLabel.textContent = 'Not Connected';
            this.proxyDetail.textContent = error || 'Click Connect to establish connection';
            this.connectBtn.style.display = 'inline-flex';
            this.disconnectBtn.style.display = 'none';
            this.versionInfo.style.display = 'none';
        }
    }

    setConnecting() {
        this.proxyIndicator.className = 'status-indicator connecting';
        this.proxyLabel.textContent = 'Connecting...';
        this.proxyDetail.textContent = 'Establishing connection to local proxy';
        this.connectBtn.disabled = true;
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
        } finally {
            this.connectBtn.disabled = false;
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
    // Session Management
    // ============================================================

    updateSessionUI() {
        if (isAuthenticated()) {
            this.sessionIndicator.className = 'status-indicator connected';
            this.sessionLabel.textContent = 'Connected';
            try {
                const instanceHostname = new URL(getInstanceUrl()).hostname;
                this.sessionDetail.textContent = instanceHostname;
            } catch (e) {
                this.sessionDetail.textContent = 'Active session';
            }
        } else {
            this.sessionIndicator.className = 'status-indicator disconnected';
            this.sessionLabel.textContent = 'Not Connected';
            this.sessionDetail.textContent = 'No active session';
        }
    }

    async reauthorize() {
        // Clear existing tokens first
        await chrome.storage.local.remove(['accessToken', 'refreshToken', 'instanceUrl', 'loginDomain']);

        // Detect domain from current tab
        let loginDomain = 'https://login.salesforce.com';
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.url) {
                const urlObj = new URL(tab.url);
                if (urlObj.hostname.includes('.my.salesforce.com')) {
                    loginDomain = urlObj.origin;
                } else if (urlObj.hostname.includes('.lightning.force.com')) {
                    loginDomain = urlObj.origin.replace('.lightning.force.com', '.my.salesforce.com');
                } else if (urlObj.hostname.includes('.salesforce-setup.com')) {
                    loginDomain = urlObj.origin.replace('.salesforce-setup.com', '.salesforce.com');
                }
            }
        } catch (e) {
            // Use default
        }

        // Check proxy for code flow
        let useCodeFlow = false;
        try {
            const proxyStatus = await chrome.runtime.sendMessage({ type: 'checkProxyConnection' });
            useCodeFlow = proxyStatus.connected;
        } catch (e) {
            // Use implicit flow
        }

        chrome.storage.local.set({ loginDomain });

        // Get OAuth credentials (custom or default)
        const { clientId } = await getOAuthCredentials();

        const responseType = useCodeFlow ? 'code' : 'token';
        const authUrl = `${loginDomain}/services/oauth2/authorize` +
            `?client_id=${clientId}` +
            `&response_type=${responseType}` +
            `&redirect_uri=${encodeURIComponent(CALLBACK_URL)}`;

        chrome.tabs.create({ url: authUrl });
    }

    async logout() {
        await chrome.storage.local.remove(['accessToken', 'refreshToken', 'instanceUrl', 'loginDomain']);
        this.updateSessionUI();

        // Show auth modal
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.classList.remove('hidden');
            // Re-detect domain for the modal
            const domainEl = document.getElementById('auth-modal-domain');
            if (domainEl) {
                let loginDomain = 'https://login.salesforce.com';
                try {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tab?.url) {
                        const urlObj = new URL(tab.url);
                        if (urlObj.hostname.includes('.salesforce.com') || urlObj.hostname.includes('.force.com')) {
                            loginDomain = urlObj.origin;
                        }
                    }
                } catch (e) {
                    // Use default
                }
                const hostname = new URL(loginDomain).hostname;
                domainEl.textContent = `Will connect to: ${hostname}`;
                domainEl.dataset.loginDomain = loginDomain;
            }
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
