// Settings Tab - LWC component for connection management, theme, proxy, and cache
import { LightningElement, track } from 'lwc';
import { subscribe, publish, CHANNELS } from '../../../lib/pubsub.js';
import {
    loadConnections,
    updateConnection,
    removeConnection,
    getActiveConnectionId,
    setActiveConnection,
    setPendingAuth,
    isAuthenticated,
    getOAuthCredentials,
    generateOAuthState
} from '../../../lib/utils.js';
import { clearDescribeCache } from '../../../lib/salesforce.js';

// OAuth callback URL
const CALLBACK_URL = 'https://sftools.dev/sftools-callback';

export default class SettingsTab extends LightningElement {
    // Connection state
    @track connections = [];
    @track activeConnectionId = null;
    @track showAddForm = false;
    @track loginDomain = 'auto';
    @track customDomain = '';
    @track newClientId = '';

    // Edit modal state
    @track showEditModal = false;
    @track editingConnectionId = null;
    @track editLabel = '';
    @track editClientId = '';

    // Theme state
    @track selectedTheme = 'system';

    // Proxy state
    @track proxyEnabled = false;
    @track proxyConnected = false;
    @track proxyConnecting = false;
    @track proxyHttpPort = null;
    @track proxyVersion = null;
    @track proxyError = '';

    // Cache state
    @track cacheStatus = '';
    @track cacheStatusClass = '';
    @track refreshingCache = false;

    _systemThemeMediaQuery = null;
    _systemThemeChangeHandler = null;
    _storageListener = null;

    // ============================================================
    // Lifecycle
    // ============================================================

    async connectedCallback() {
        // Load initial data
        await this.loadConnectionList();
        await this.initThemeUI();
        await this.initProxyUI();

        // Listen for storage changes
        this._storageListener = (changes, area) => {
            if (area === 'local' && changes.connections) {
                this.loadConnectionList();
            }
        };
        chrome.storage.onChanged.addListener(this._storageListener);

        // Subscribe to connection changes
        this._unsubscribeConnection = subscribe(CHANNELS.CONNECTION_CHANGED, () => {
            this.loadConnectionList();
        });
    }

    disconnectedCallback() {
        if (this._storageListener) {
            chrome.storage.onChanged.removeListener(this._storageListener);
        }
        if (this._systemThemeMediaQuery && this._systemThemeChangeHandler) {
            this._systemThemeMediaQuery.removeEventListener('change', this._systemThemeChangeHandler);
        }
        this._unsubscribeConnection?.();
    }

    // ============================================================
    // Connection List Management
    // ============================================================

    async loadConnectionList() {
        this.connections = await loadConnections();
        this.activeConnectionId = getActiveConnectionId();
    }

    get hasConnections() {
        return this.connections.length > 0;
    }

    get connectionItems() {
        return this.connections.map((conn) => ({
            ...conn,
            isActive: conn.id === this.activeConnectionId,
            cssClass: conn.id === this.activeConnectionId
                ? 'settings-connection-item active'
                : 'settings-connection-item',
            hasRefreshToken: !!conn.refreshToken,
            hasCustomApp: !!conn.clientId
        }));
    }

    handleShowAddForm() {
        this.showAddForm = true;
    }

    handleCancelAdd() {
        this.showAddForm = false;
        this.loginDomain = 'auto';
        this.customDomain = '';
        this.newClientId = '';
    }

    handleLoginDomainChange(event) {
        this.loginDomain = event.target.value;
    }

    handleCustomDomainInput(event) {
        this.customDomain = event.target.value;
    }

    handleNewClientIdInput(event) {
        this.newClientId = event.target.value;
    }

    get showCustomDomainField() {
        return this.loginDomain === 'custom';
    }

    async handleAddConnection() {
        let domain = this.loginDomain;

        if (domain === 'auto') {
            domain = null;
        } else if (domain === 'custom') {
            domain = this.customDomain.trim();
            if (!domain) {
                alert('Please enter a custom domain');
                return;
            }
            if (!domain.startsWith('https://')) {
                domain = `https://${domain}`;
            }
        }

        const clientId = this.newClientId.trim() || null;
        await this.startAuthorization(domain, clientId, null);
        this.handleCancelAdd();
    }

    handleConnectionEdit(event) {
        event.stopPropagation();
        const connectionId = event.currentTarget.dataset.id;
        this.showEditModalFor(connectionId);
    }

    async handleConnectionReauth(event) {
        event.stopPropagation();
        const connectionId = event.currentTarget.dataset.id;
        const connection = this.connections.find((c) => c.id === connectionId);
        if (!connection) return;

        await this.startAuthorization(connection.instanceUrl, connection.clientId, connectionId);
    }

    async handleConnectionDelete(event) {
        event.stopPropagation();
        const connectionId = event.currentTarget.dataset.id;

        if (!confirm('Remove this connection?')) return;

        const wasActive = getActiveConnectionId() === connectionId;
        if (wasActive) {
            setActiveConnection(null);
        }

        await removeConnection(connectionId);
        await this.loadConnectionList();

        // Notify other components
        publish(CHANNELS.CONNECTION_CHANGED, null);
    }

    // ============================================================
    // Edit Modal
    // ============================================================

    async showEditModalFor(connectionId) {
        const connection = this.connections.find((c) => c.id === connectionId);
        if (!connection) return;

        this.editingConnectionId = connectionId;
        this.editLabel = connection.label || '';
        this.editClientId = connection.clientId || '';
        this.showEditModal = true;
    }

    handleEditLabelInput(event) {
        this.editLabel = event.target.value;
    }

    handleEditClientIdInput(event) {
        this.editClientId = event.target.value;
    }

    handleEditModalOverlayClick(event) {
        if (event.target === event.currentTarget) {
            this.hideEditModal();
        }
    }

    hideEditModal() {
        this.showEditModal = false;
        this.editingConnectionId = null;
        this.editLabel = '';
        this.editClientId = '';
    }

    async handleSaveEdit() {
        const label = this.editLabel.trim();
        if (!label) {
            alert('Label is required');
            return;
        }

        const newClientId = this.editClientId.trim() || null;
        const connectionId = this.editingConnectionId;

        const connection = this.connections.find((c) => c.id === connectionId);
        if (!connection) return;

        const clientIdChanged = connection.clientId !== newClientId;

        await updateConnection(connectionId, {
            label,
            clientId: newClientId
        });

        this.hideEditModal();
        await this.loadConnectionList();

        // Notify other components
        publish(CHANNELS.CONNECTION_CHANGED, null);

        // If clientId changed, prompt for re-auth
        if (clientIdChanged) {
            const message = newClientId
                ? 'Client ID changed. Re-authorize now to use the new Connected App?'
                : 'Client ID removed. Re-authorize now to use the default Connected App?';
            if (confirm(message)) {
                await this.startAuthorization(connection.instanceUrl, newClientId, connectionId);
            }
        }
    }

    // ============================================================
    // OAuth
    // ============================================================

    async startAuthorization(loginDomain = null, clientId = null, connectionId = null) {
        // Auto-detect domain if not provided
        if (!loginDomain) {
            loginDomain = await this.detectLoginDomain();
        }

        // Check if proxy is connected for code flow
        let useCodeFlow = false;
        try {
            const proxyStatus = await chrome.runtime.sendMessage({ type: 'checkProxyConnection' });
            useCodeFlow = proxyStatus.connected;
        } catch {
            // Proxy not available
        }

        const credentials = await getOAuthCredentials();
        const effectiveClientId = clientId ?? credentials.clientId;
        const state = generateOAuthState();

        await setPendingAuth({
            loginDomain,
            clientId,
            connectionId,
            state
        });

        const responseType = useCodeFlow ? 'code' : 'token';
        const authUrl =
            `${loginDomain}/services/oauth2/authorize` +
            `?client_id=${effectiveClientId}` +
            `&response_type=${responseType}` +
            `&redirect_uri=${encodeURIComponent(CALLBACK_URL)}` +
            `&state=${encodeURIComponent(state)}`;

        chrome.tabs.create({ url: authUrl });
    }

    async detectLoginDomain() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.url) {
                const urlObj = new URL(tab.url);
                if (urlObj.hostname.includes('.my.salesforce.com')) {
                    return urlObj.origin;
                } else if (urlObj.hostname.includes('.lightning.force.com')) {
                    return urlObj.origin.replace('.lightning.force.com', '.my.salesforce.com');
                }
            }
        } catch {
            // Ignore errors
        }
        return 'https://login.salesforce.com';
    }

    // ============================================================
    // Theme Management
    // ============================================================

    async initThemeUI() {
        const { theme } = await chrome.storage.local.get(['theme']);
        this.selectedTheme = theme || 'system';

        // Set up system theme change listener
        this._systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this._systemThemeChangeHandler = () => {
            if (this.selectedTheme === 'system') {
                this.applyTheme('system');
            }
        };
        this._systemThemeMediaQuery.addEventListener('change', this._systemThemeChangeHandler);

        this.applyTheme(this.selectedTheme);
    }

    handleThemeChange(event) {
        const theme = event.target.value;
        this.selectedTheme = theme;
        chrome.storage.local.set({ theme });
        this.applyTheme(theme);
        publish(CHANNELS.THEME_CHANGED, { theme });
    }

    applyTheme(theme) {
        let effectiveTheme = theme;

        if (theme === 'system') {
            effectiveTheme = this._systemThemeMediaQuery?.matches ? 'dark' : 'light';
        }

        if (effectiveTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    get isSystemTheme() {
        return this.selectedTheme === 'system';
    }

    get isLightTheme() {
        return this.selectedTheme === 'light';
    }

    get isDarkTheme() {
        return this.selectedTheme === 'dark';
    }

    // ============================================================
    // Proxy Management
    // ============================================================

    async initProxyUI() {
        const { proxyEnabled } = await chrome.storage.local.get(['proxyEnabled']);
        this.proxyEnabled = proxyEnabled || false;

        if (this.proxyEnabled) {
            await this.checkProxyStatus();
        }
    }

    async handleProxyToggle(event) {
        const enabled = event.target.checked;
        this.proxyEnabled = enabled;
        await chrome.storage.local.set({ proxyEnabled: enabled });

        if (enabled) {
            await this.connectProxy();
        } else {
            await this.disconnectProxy();
        }
    }

    get showProxyStatus() {
        return this.proxyEnabled;
    }

    get proxyStatusText() {
        if (this.proxyConnecting) return 'Connecting...';
        if (this.proxyConnected) return 'Connected';
        return 'Not Connected';
    }

    get proxyDetailText() {
        if (this.proxyConnecting) return 'Establishing connection to local proxy';
        if (this.proxyConnected && this.proxyHttpPort) return `HTTP server on port ${this.proxyHttpPort}`;
        return this.proxyError || '';
    }

    get proxyIndicatorClass() {
        if (this.proxyConnecting) return 'status-indicator connecting';
        if (this.proxyConnected) return 'status-indicator connected';
        return 'status-indicator disconnected';
    }

    async checkProxyStatus() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'checkProxyConnection' });
            this.updateProxyUI(response);
        } catch (err) {
            this.updateProxyUI({ connected: false, error: err.message });
        }
    }

    async connectProxy() {
        this.proxyConnecting = true;
        this.proxyConnected = false;
        this.proxyError = '';

        try {
            const response = await chrome.runtime.sendMessage({ type: 'connectProxy' });

            if (response.success) {
                this.proxyConnected = true;
                this.proxyHttpPort = response.httpPort;
                this.proxyVersion = response.version;
                publish(CHANNELS.PROXY_STATUS_CHANGED, { connected: true });
            } else {
                this.proxyConnected = false;
                this.proxyError = response.error || 'Connection failed';
                publish(CHANNELS.PROXY_STATUS_CHANGED, { connected: false });
            }
        } catch (err) {
            this.proxyConnected = false;
            this.proxyError = err.message;
            publish(CHANNELS.PROXY_STATUS_CHANGED, { connected: false });
        } finally {
            this.proxyConnecting = false;
        }
    }

    async disconnectProxy() {
        try {
            await chrome.runtime.sendMessage({ type: 'disconnectProxy' });
            this.proxyConnected = false;
            this.proxyHttpPort = null;
            this.proxyVersion = null;
            publish(CHANNELS.PROXY_STATUS_CHANGED, { connected: false });
        } catch (err) {
            console.error('Disconnect error:', err);
        }
    }

    updateProxyUI(status) {
        const { connected, httpPort, version, error } = status;
        this.proxyConnected = connected;
        this.proxyHttpPort = httpPort || null;
        this.proxyVersion = version || null;
        this.proxyError = connected ? '' : (error || '');
    }

    // ============================================================
    // Cache Management
    // ============================================================

    async handleRefreshCache() {
        if (!isAuthenticated()) {
            this.cacheStatus = 'Please connect to an org first';
            this.cacheStatusClass = 'settings-cache-status error';
            return;
        }

        this.refreshingCache = true;
        this.cacheStatus = 'Clearing cache...';
        this.cacheStatusClass = 'settings-cache-status';

        try {
            await clearDescribeCache();
            this.cacheStatus = 'Cache cleared successfully';
            this.cacheStatusClass = 'settings-cache-status success';

            // Clear status after a few seconds
            setTimeout(() => {
                this.cacheStatus = '';
                this.cacheStatusClass = 'settings-cache-status';
            }, 3000);
        } catch (err) {
            this.cacheStatus = `Error: ${err.message}`;
            this.cacheStatusClass = 'settings-cache-status error';
        } finally {
            this.refreshingCache = false;
        }
    }
}
