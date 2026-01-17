// Settings Tab - Connection Management & Proxy Connection
import template from './settings.html?raw';
import './settings.css';
import {
    loadConnections,
    updateConnection,
    removeConnection,
    getActiveConnectionId,
    setActiveConnection,
    setPendingAuth,
    isAuthenticated
} from '../../lib/utils.js';
import { clearDescribeCache } from '../../lib/salesforce.js';
import { escapeHtml } from '../../lib/text-utils.js';
import { icons } from '../../lib/icons.js';

class SettingsTab extends HTMLElement {
    // Theme DOM references
    themeRadios = null;
    systemThemeMediaQuery = null;

    // Proxy DOM references
    proxyToggle = null;
    proxyStatus = null;
    proxyIndicator = null;
    proxyLabel = null;
    proxyDetail = null;
    versionInfo = null;

    // Connection list DOM references
    connectionList = null;
    addConnectionBtn = null;
    addConnectionForm = null;
    loginDomainSelect = null;
    customDomainField = null;
    customDomainInput = null;
    newClientIdInput = null;
    authorizeBtn = null;
    cancelBtn = null;

    // Edit modal DOM references
    editModal = null;
    editLabelInput = null;
    editClientIdInput = null;
    editSaveBtn = null;
    editCancelBtn = null;
    editingConnectionId = null;

    // Cache management DOM references
    refreshCacheBtn = null;
    cacheStatus = null;

    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.attachEventListeners();
        this.initThemeUI();
        this.initProxyUI();
        this.renderConnectionList();

        // Listen for connection changes from other parts of the app
        this.connectionChangeHandler = () => this.renderConnectionList();
        document.addEventListener('connection-changed', this.connectionChangeHandler);

        // Listen for storage changes (new connection from auth)
        this.storageChangeHandler = (changes, area) => {
            if (area === 'local' && changes.connections) {
                this.renderConnectionList();
            }
        };
        chrome.storage.onChanged.addListener(this.storageChangeHandler);
    }

    disconnectedCallback() {
        document.removeEventListener('connection-changed', this.connectionChangeHandler);
        chrome.storage.onChanged.removeListener(this.storageChangeHandler);
        if (this.systemThemeMediaQuery) {
            this.systemThemeMediaQuery.removeEventListener('change', this.systemThemeChangeHandler);
        }
    }

    initElements() {
        // Theme elements
        this.themeRadios = this.querySelectorAll('.settings-theme-radio');

        // Proxy elements
        this.proxyToggle = this.querySelector('.settings-proxy-toggle');
        this.proxyStatus = this.querySelector('.settings-proxy-status');
        this.proxyIndicator = this.querySelector('.settings-proxy-indicator');
        this.proxyLabel = this.querySelector('.settings-proxy-label');
        this.proxyDetail = this.querySelector('.settings-proxy-detail');
        this.versionInfo = this.querySelector('.settings-version-info');

        // Connection list elements
        this.connectionList = this.querySelector('.settings-connection-list');
        this.addConnectionBtn = this.querySelector('.settings-add-connection-btn');
        this.addConnectionForm = this.querySelector('.settings-add-connection-form');
        this.loginDomainSelect = this.querySelector('.settings-login-domain');
        this.customDomainField = this.querySelector('.settings-custom-domain-field');
        this.customDomainInput = this.querySelector('.settings-custom-domain');
        this.newClientIdInput = this.querySelector('.settings-new-client-id');
        this.authorizeBtn = this.querySelector('.settings-authorize-btn');
        this.cancelBtn = this.querySelector('.settings-cancel-btn');

        // Edit modal elements
        this.editModal = this.querySelector('.settings-edit-modal');
        this.editLabelInput = this.querySelector('.settings-edit-label');
        this.editClientIdInput = this.querySelector('.settings-edit-client-id');
        this.editSaveBtn = this.querySelector('.settings-edit-save-btn');
        this.editCancelBtn = this.querySelector('.settings-edit-cancel-btn');

        // Cache management elements
        this.refreshCacheBtn = this.querySelector('.settings-refresh-cache-btn');
        this.cacheStatus = this.querySelector('.settings-cache-status');
    }

    attachEventListeners() {
        // Theme listeners
        this.themeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => this.handleThemeChange(e.target.value));
        });

        // Proxy listeners
        this.proxyToggle.addEventListener('change', () => this.handleProxyToggle());

        // Connection list listeners
        this.addConnectionBtn.addEventListener('click', () => this.showAddConnectionForm());
        this.cancelBtn.addEventListener('click', () => this.hideAddConnectionForm());
        this.authorizeBtn.addEventListener('click', () => this.handleAddConnection());
        this.loginDomainSelect.addEventListener('change', () => this.handleLoginDomainChange());

        // Connection list item actions (delegated)
        this.connectionList.addEventListener('click', (e) => this.handleConnectionAction(e));

        // Edit modal listeners
        this.editSaveBtn.addEventListener('click', () => this.handleSaveEdit());
        this.editCancelBtn.addEventListener('click', () => this.hideEditModal());
        this.editModal.addEventListener('click', (e) => {
            if (e.target === this.editModal) this.hideEditModal();
        });

        // Cache management listeners
        this.refreshCacheBtn.addEventListener('click', () => this.handleRefreshCache());
    }

    // ============================================================
    // Theme Management
    // ============================================================

    async initThemeUI() {
        const { theme } = await chrome.storage.local.get(['theme']);
        const savedTheme = theme || 'system';

        // Set the radio button
        const radio = this.querySelector(`.settings-theme-radio[value="${savedTheme}"]`);
        if (radio) radio.checked = true;

        // Set up system theme change listener
        this.systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this.systemThemeChangeHandler = () => {
            if (this.getCurrentThemeSetting() === 'system') {
                this.applyTheme('system');
            }
        };
        this.systemThemeMediaQuery.addEventListener('change', this.systemThemeChangeHandler);

        // Apply initial theme
        this.applyTheme(savedTheme);
    }

    getCurrentThemeSetting() {
        const checked = this.querySelector('.settings-theme-radio:checked');
        return checked ? checked.value : 'system';
    }

    async handleThemeChange(theme) {
        await chrome.storage.local.set({ theme });
        this.applyTheme(theme);

        // Notify other tabs/windows about the theme change
        document.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme } }));
    }

    applyTheme(theme) {
        let effectiveTheme = theme;

        if (theme === 'system') {
            effectiveTheme = this.systemThemeMediaQuery?.matches ? 'dark' : 'light';
        }

        if (effectiveTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    // ============================================================
    // Connection List Management
    // ============================================================

    async renderConnectionList() {
        const connections = await loadConnections();
        const activeId = getActiveConnectionId();

        if (connections.length === 0) {
            this.connectionList.innerHTML = '<div class="settings-no-connections">No connections saved</div>';
            return;
        }

        this.connectionList.innerHTML = connections
            .map(conn => this.createConnectionCardHtml(conn, activeId))
            .join('');
    }

    createConnectionCardHtml(conn, activeId) {
        const isActive = conn.id === activeId;
        const refreshBadge = conn.refreshToken
            ? `<span class="settings-connection-badge refresh-enabled" title="Auto-refresh enabled">${icons.refreshSmall} Auto-refresh</span>`
            : '';
        const customAppBadge = conn.clientId
            ? '<span class="settings-connection-badge">Custom App</span>'
            : '';

        return `
            <div class="settings-connection-item ${isActive ? 'active' : ''}" data-id="${conn.id}">
                <div class="settings-connection-info">
                    <div class="settings-connection-label">${escapeHtml(conn.label)}</div>
                    <div class="settings-connection-detail">
                        ${refreshBadge}
                        ${customAppBadge}
                    </div>
                </div>
                <div class="settings-connection-actions">
                    <button class="settings-connection-edit" title="Edit">
                        ${icons.edit}
                    </button>
                    <button class="settings-connection-reauth" title="Re-authorize">
                        ${icons.refresh}
                    </button>
                    <button class="settings-connection-delete" title="Delete">
                        ${icons.trash}
                    </button>
                </div>
            </div>
        `;
    }

    handleConnectionAction(e) {
        const item = e.target.closest('.settings-connection-item');
        if (!item) return;

        const connectionId = item.dataset.id;

        if (e.target.closest('.settings-connection-edit')) {
            this.showEditModal(connectionId);
        } else if (e.target.closest('.settings-connection-reauth')) {
            this.handleReauthorize(connectionId);
        } else if (e.target.closest('.settings-connection-delete')) {
            this.handleDeleteConnection(connectionId);
        }
    }

    showAddConnectionForm() {
        this.addConnectionBtn.classList.add('hidden');
        this.addConnectionForm.classList.remove('hidden');
    }

    hideAddConnectionForm() {
        this.addConnectionForm.classList.add('hidden');
        this.addConnectionBtn.classList.remove('hidden');
        // Reset form
        this.loginDomainSelect.value = 'auto';
        this.customDomainField.classList.add('hidden');
        this.customDomainInput.value = '';
        this.newClientIdInput.value = '';
    }

    handleLoginDomainChange() {
        if (this.loginDomainSelect.value === 'custom') {
            this.customDomainField.classList.remove('hidden');
        } else {
            this.customDomainField.classList.add('hidden');
        }
    }

    async handleAddConnection() {
        let loginDomain = this.loginDomainSelect.value;

        if (loginDomain === 'auto') {
            // Auto-detect from current tab - pass null to let startAuthorization detect
            loginDomain = null;
        } else if (loginDomain === 'custom') {
            loginDomain = this.customDomainInput.value.trim();
            if (!loginDomain) {
                alert('Please enter a custom domain');
                return;
            }
            // Ensure it starts with https://
            if (!loginDomain.startsWith('https://')) {
                loginDomain = 'https://' + loginDomain;
            }
        }

        const clientId = this.newClientIdInput.value.trim() || null;

        // Store pending auth and start OAuth flow
        await setPendingAuth({
            loginDomain,
            clientId,
            connectionId: null
        });

        // Call startAuthorization from app.js (available on window)
        if (window.startAuthorization) {
            window.startAuthorization(loginDomain, clientId, null);
        }

        this.hideAddConnectionForm();
    }

    async showEditModal(connectionId) {
        const connections = await loadConnections();
        const connection = connections.find(c => c.id === connectionId);
        if (!connection) return;

        this.editingConnectionId = connectionId;
        this.editLabelInput.value = connection.label;
        this.editClientIdInput.value = connection.clientId || '';
        this.editModal.classList.remove('hidden');
    }

    hideEditModal() {
        this.editModal.classList.add('hidden');
        this.editingConnectionId = null;
    }

    async handleSaveEdit() {
        const label = this.editLabelInput.value.trim();
        if (!label) {
            alert('Label is required');
            return;
        }

        const newClientId = this.editClientIdInput.value.trim() || null;
        const connectionId = this.editingConnectionId; // Save before hideEditModal clears it

        const connections = await loadConnections();
        const connection = connections.find(c => c.id === connectionId);
        if (!connection) return;

        const clientIdChanged = connection.clientId !== newClientId;

        await updateConnection(connectionId, {
            label,
            clientId: newClientId
        });

        this.hideEditModal();
        this.renderConnectionList();

        // Notify other components if label changed
        document.dispatchEvent(new CustomEvent('connection-updated'));

        // If clientId changed, prompt for re-auth (whether adding custom or reverting to default)
        if (clientIdChanged) {
            const message = newClientId
                ? 'Client ID changed. Re-authorize now to use the new Connected App?'
                : 'Client ID removed. Re-authorize now to use the default Connected App?';
            if (confirm(message)) {
                this.handleReauthorize(connectionId);
            }
        }
    }

    async handleReauthorize(connectionId) {
        const connections = await loadConnections();
        const connection = connections.find(c => c.id === connectionId);
        if (!connection) return;

        // Store pending auth with connection's clientId and ID for re-auth
        await setPendingAuth({
            loginDomain: connection.loginDomain || 'https://login.salesforce.com',
            clientId: connection.clientId,
            connectionId: connectionId
        });

        // Call startAuthorization from app.js
        if (window.startAuthorization) {
            window.startAuthorization(
                connection.loginDomain || 'https://login.salesforce.com',
                connection.clientId,
                connectionId
            );
        }
    }

    async handleDeleteConnection(connectionId) {
        if (!confirm('Remove this connection?')) return;

        const wasActive = getActiveConnectionId() === connectionId;
        if (wasActive) {
            setActiveConnection(null);
        }

        await removeConnection(connectionId);
        this.renderConnectionList();

        // Notify other components
        document.dispatchEvent(new CustomEvent('connection-removed', {
            detail: { connectionId }
        }));
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

                // Notify the app that proxy status changed
                document.dispatchEvent(new CustomEvent('proxy-status-changed', {
                    detail: { connected: true }
                }));
            } else {
                this.updateProxyUI({
                    connected: false,
                    error: response.error || 'Connection failed'
                });

                // Notify the app that proxy status changed
                document.dispatchEvent(new CustomEvent('proxy-status-changed', {
                    detail: { connected: false }
                }));
            }
        } catch (err) {
            this.updateProxyUI({ connected: false, error: err.message });

            // Notify the app that proxy status changed
            document.dispatchEvent(new CustomEvent('proxy-status-changed', {
                detail: { connected: false }
            }));
        }
    }

    async disconnect() {
        try {
            await chrome.runtime.sendMessage({ type: 'disconnectProxy' });
            this.updateProxyUI({ connected: false });

            // Notify the app that proxy status changed
            document.dispatchEvent(new CustomEvent('proxy-status-changed', {
                detail: { connected: false }
            }));
        } catch (err) {
            console.error('Disconnect error:', err);
        }
    }

    // ============================================================
    // Cache Management
    // ============================================================

    async handleRefreshCache() {
        if (!isAuthenticated()) {
            this.cacheStatus.textContent = 'Please connect to an org first';
            this.cacheStatus.className = 'settings-cache-status error';
            return;
        }

        this.refreshCacheBtn.disabled = true;
        this.cacheStatus.textContent = 'Clearing cache...';
        this.cacheStatus.className = 'settings-cache-status';

        try {
            await clearDescribeCache();
            this.cacheStatus.textContent = 'Cache cleared successfully';
            this.cacheStatus.className = 'settings-cache-status success';

            // Clear status after a few seconds
            setTimeout(() => {
                this.cacheStatus.textContent = '';
                this.cacheStatus.className = 'settings-cache-status';
            }, 3000);
        } catch (err) {
            this.cacheStatus.textContent = `Error: ${err.message}`;
            this.cacheStatus.className = 'settings-cache-status error';
        } finally {
            this.refreshCacheBtn.disabled = false;
        }
    }
}

customElements.define('settings-tab', SettingsTab);
