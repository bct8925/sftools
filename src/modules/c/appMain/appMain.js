// App Main - LWC version of the main application shell
import { LightningElement, api, track } from 'lwc';
import { subscribe, publish, CHANNELS } from '../../../lib/pubsub.js';
import {
    getAccessToken,
    getInstanceUrl,
    isAuthenticated,
    checkProxyStatus,
    isProxyConnected,
    loadConnections,
    setActiveConnection,
    getActiveConnectionId,
    removeConnection,
    updateConnection,
    migrateFromSingleConnection,
    getOAuthCredentials,
    setPendingAuth,
    generateOAuthState,
    migrateCustomConnectedApp,
    migrateDescribeCache
} from '../../../lib/utils.js';
import { initTheme } from '../../../lib/theme.js';

// OAuth constants
const CALLBACK_URL = 'https://sftools.dev/sftools-callback';

// Tab definitions
const TABS = [
    { id: 'query', label: 'Query', requiresConnection: true },
    { id: 'apex', label: 'Apex', requiresConnection: true },
    { id: 'rest-api', label: 'REST API', requiresConnection: true },
    { id: 'events', label: 'Platform Events', requiresConnection: true, requiresProxy: true },
    { id: 'utils', label: 'Utils', requiresConnection: true },
    { id: 'settings', label: 'Settings', requiresConnection: false }
];

export default class AppMain extends LightningElement {
    @track activeTab = 'query';
    @track menuOpen = false;
    @track connections = [];
    @track activeConnectionId = null;
    @track activeConnectionLabel = '';
    @track proxyConnected = false;
    @track isInitialized = false;

    _detectedLoginDomain = 'https://login.salesforce.com';
    _storageListener = null;

    async connectedCallback() {
        // Initialize theme first
        await initTheme();

        // Check proxy status
        await checkProxyStatus();
        this.proxyConnected = isProxyConnected();

        // Initialize connections
        await this.initializeConnections();

        // Listen for storage changes (e.g., new auth from another tab)
        this._storageListener = this.handleStorageChange.bind(this);
        chrome.storage.onChanged.addListener(this._storageListener);

        // Subscribe to proxy status changes
        this._unsubscribeProxy = subscribe(CHANNELS.PROXY_STATUS_CHANGED, async () => {
            await checkProxyStatus();
            this.proxyConnected = isProxyConnected();
        });

        this.isInitialized = true;
    }

    disconnectedCallback() {
        if (this._storageListener) {
            chrome.storage.onChanged.removeListener(this._storageListener);
        }
        this._unsubscribeProxy?.();
    }

    async handleStorageChange(changes, area) {
        if (area !== 'local') return;
        if (changes.connections) {
            await this.refreshConnectionList(false);
        }
    }

    // ============================================================
    // Connection Management
    // ============================================================

    async initializeConnections() {
        await migrateFromSingleConnection();
        await migrateCustomConnectedApp();
        await migrateDescribeCache();
        await this.refreshConnectionList(true);
    }

    async refreshConnectionList(autoSelect = false) {
        this.connections = await loadConnections();

        if (this.connections.length === 0) {
            this.showNoConnectionsState();
            return;
        }

        const activeId = getActiveConnectionId();
        const activeConnection = this.connections.find((c) => c.id === activeId);

        if (!activeConnection) {
            setActiveConnection(null);
            this.activeConnectionId = null;
            this.activeConnectionLabel = '';

            if (autoSelect) {
                const mostRecent = this.connections.reduce((a, b) =>
                    a.lastUsedAt > b.lastUsedAt ? a : b
                );
                await this.selectConnection(mostRecent);
            }
        } else {
            this.activeConnectionId = activeConnection.id;
            this.activeConnectionLabel = activeConnection.label || '';
        }
    }

    showNoConnectionsState() {
        setActiveConnection(null);
        this.activeConnectionId = null;
        this.activeConnectionLabel = '';
        this.activeTab = 'settings';
    }

    async selectConnection(connection) {
        setActiveConnection(connection);
        this.activeConnectionId = connection.id;
        this.activeConnectionLabel = connection.label || '';
        this.connections = await loadConnections();

        await updateConnection(connection.id, {});

        // Notify components via pubsub
        publish(CHANNELS.CONNECTION_CHANGED, connection);
    }

    async handleConnectionSelect(event) {
        const connectionId = event.currentTarget.dataset.id;
        const connection = this.connections.find((c) => c.id === connectionId);
        if (connection) {
            await this.selectConnection(connection);
        }
        this.closeMenu();
    }

    async handleConnectionRemove(event) {
        event.stopPropagation();
        const connectionId = event.currentTarget.dataset.id;

        if (!confirm('Remove this connection?')) return;

        setActiveConnection(null);
        await removeConnection(connectionId);
        await this.refreshConnectionList();
        this.activeTab = 'settings';
    }

    // ============================================================
    // Tab Navigation
    // ============================================================

    get tabs() {
        return TABS.map((tab) => ({
            ...tab,
            isActive: this.activeTab === tab.id,
            isDisabled: this.isTabDisabled(tab),
            cssClass: this.getTabCssClass(tab)
        }));
    }

    isTabDisabled(tab) {
        if (tab.requiresProxy && !this.proxyConnected) {
            return true;
        }
        if (tab.requiresConnection && !isAuthenticated()) {
            return true;
        }
        return false;
    }

    getTabCssClass(tab) {
        const classes = ['mobile-nav-item'];
        if (this.activeTab === tab.id) {
            classes.push('active');
        }
        if (this.isTabDisabled(tab)) {
            classes.push('tab-disabled');
        }
        return classes.join(' ');
    }

    handleTabClick(event) {
        const tabId = event.currentTarget.dataset.tab;
        const tab = TABS.find((t) => t.id === tabId);

        if (this.isTabDisabled(tab)) {
            return;
        }

        this.activeTab = tabId;
        this.closeMenu();

        // Notify that tab changed
        publish('tabChanged', { tabId });
    }

    // ============================================================
    // Menu Actions
    // ============================================================

    openMenu() {
        this.menuOpen = true;
    }

    closeMenu() {
        this.menuOpen = false;
    }

    handleHamburgerClick() {
        this.openMenu();
    }

    handleOverlayClick() {
        this.closeMenu();
    }

    handleCloseClick() {
        this.closeMenu();
    }

    handleOpenOrg() {
        if (!isAuthenticated()) {
            return;
        }

        const instanceUrl = getInstanceUrl();
        const accessToken = getAccessToken();
        const frontdoorUrl = `${instanceUrl}/secur/frontdoor.jsp?sid=${encodeURIComponent(accessToken)}`;
        window.open(frontdoorUrl, '_blank');
        this.closeMenu();
    }

    handleOpenTab() {
        chrome.tabs.create({ url: chrome.runtime.getURL('dist/pages/app/index.html') });
        this.closeMenu();
    }

    handleAddConnection() {
        this.activeTab = 'settings';
        this.closeMenu();
    }

    // ============================================================
    // OAuth
    // ============================================================

    async detectLoginDomain() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.url) {
                const urlObj = new URL(tab.url);
                if (urlObj.hostname.includes('.my.salesforce.com')) {
                    this._detectedLoginDomain = urlObj.origin;
                } else if (urlObj.hostname.includes('.lightning.force.com')) {
                    this._detectedLoginDomain = urlObj.origin.replace(
                        '.lightning.force.com',
                        '.my.salesforce.com'
                    );
                }
            }
        } catch (e) {
            console.error('Error detecting domain:', e);
        }
    }

    @api
    async startAuthorization(overrideLoginDomain = null, overrideClientId = null, connectionId = null) {
        let loginDomain;
        if (overrideLoginDomain) {
            loginDomain = overrideLoginDomain;
        } else {
            await this.detectLoginDomain();
            loginDomain = this._detectedLoginDomain;
        }

        let useCodeFlow = false;
        try {
            const proxyStatus = await chrome.runtime.sendMessage({ type: 'checkProxyConnection' });
            useCodeFlow = proxyStatus.connected;
        } catch {
            // Proxy not available
        }

        const clientId = overrideClientId ?? (await getOAuthCredentials()).clientId;
        const state = generateOAuthState();

        await setPendingAuth({
            loginDomain,
            clientId: overrideClientId,
            connectionId,
            state
        });

        const responseType = useCodeFlow ? 'code' : 'token';
        const authUrl =
            `${loginDomain}/services/oauth2/authorize` +
            `?client_id=${clientId}` +
            `&response_type=${responseType}` +
            `&redirect_uri=${encodeURIComponent(CALLBACK_URL)}` +
            `&state=${encodeURIComponent(state)}`;

        chrome.tabs.create({ url: authUrl });
    }

    // ============================================================
    // Computed Properties
    // ============================================================

    get menuClass() {
        return this.menuOpen ? 'mobile-menu open' : 'mobile-menu';
    }

    get overlayClass() {
        return this.menuOpen ? 'mobile-menu-overlay open' : 'mobile-menu-overlay';
    }

    get hasConnections() {
        return this.connections.length > 0;
    }

    get openOrgDisabled() {
        return !isAuthenticated();
    }

    get openOrgClass() {
        return isAuthenticated() ? 'mobile-nav-item' : 'mobile-nav-item tab-disabled';
    }

    // Tab visibility getters
    get showQueryTab() {
        return this.activeTab === 'query';
    }
    get showApexTab() {
        return this.activeTab === 'apex';
    }
    get showRestApiTab() {
        return this.activeTab === 'rest-api';
    }
    get showEventsTab() {
        return this.activeTab === 'events';
    }
    get showUtilsTab() {
        return this.activeTab === 'utils';
    }
    get showSettingsTab() {
        return this.activeTab === 'settings';
    }
}
