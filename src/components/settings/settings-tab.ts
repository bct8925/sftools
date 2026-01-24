// Settings Tab - Connection Management & Proxy Connection
import {
    loadConnections,
    updateConnection,
    removeConnection,
    getActiveConnectionId,
    setActiveConnection,
    setPendingAuth,
    isAuthenticated,
} from '../../lib/utils.js';
import { clearDescribeCache } from '../../lib/salesforce.js';
import { escapeHtml } from '../../lib/text-utils.js';
import { icons } from '../../lib/icons.js';
import type { SalesforceConnection } from '../../types/salesforce';
import template from './settings.html?raw';
import './settings.css';

interface ProxyStatus {
    connected: boolean;
    httpPort?: number;
    version?: string;
    error?: string;
}

interface ThemeChangedEvent extends CustomEvent<{ theme: string }> {
    type: 'theme-changed';
}

declare global {
    interface Window {
        startAuthorization?: (
            loginDomain: string | null,
            clientId: string | null,
            connectionId: string | null
        ) => void;
    }
}

class SettingsTab extends HTMLElement {
    // Theme DOM references
    private themeRadios!: NodeListOf<HTMLInputElement>;
    private systemThemeMediaQuery: MediaQueryList | null = null;
    private systemThemeChangeHandler?: () => void;

    // Proxy DOM references
    private proxyToggle!: HTMLInputElement;
    private proxyStatus!: HTMLElement;
    private proxyIndicator!: HTMLElement;
    private proxyLabel!: HTMLElement;
    private proxyDetail!: HTMLElement;
    private versionInfo!: HTMLElement;

    // Connection list DOM references
    private connectionList!: HTMLElement;
    private addConnectionBtn!: HTMLButtonElement;
    private addConnectionForm!: HTMLElement;
    private loginDomainSelect!: HTMLSelectElement;
    private customDomainField!: HTMLElement;
    private customDomainInput!: HTMLInputElement;
    private newClientIdInput!: HTMLInputElement;
    private authorizeBtn!: HTMLButtonElement;
    private cancelBtn!: HTMLButtonElement;

    // Edit modal DOM references
    private editModal!: HTMLElement;
    private editLabelInput!: HTMLInputElement;
    private editClientIdInput!: HTMLInputElement;
    private editSaveBtn!: HTMLButtonElement;
    private editCancelBtn!: HTMLButtonElement;
    private editingConnectionId: string | null = null;

    // Cache management DOM references
    private refreshCacheBtn!: HTMLButtonElement;
    private cacheStatus!: HTMLElement;

    // Event handlers
    private connectionChangeHandler?: () => void;
    private storageChangeHandler?: (
        changes: { [key: string]: chrome.storage.StorageChange },
        area: string
    ) => void;

    connectedCallback(): void {
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

    disconnectedCallback(): void {
        if (this.connectionChangeHandler) {
            document.removeEventListener('connection-changed', this.connectionChangeHandler);
        }
        if (this.storageChangeHandler) {
            chrome.storage.onChanged.removeListener(this.storageChangeHandler);
        }
        if (this.systemThemeMediaQuery && this.systemThemeChangeHandler) {
            this.systemThemeMediaQuery.removeEventListener('change', this.systemThemeChangeHandler);
        }
    }

    private initElements(): void {
        // Theme elements
        this.themeRadios = this.querySelectorAll<HTMLInputElement>('.settings-theme-radio');

        // Proxy elements
        this.proxyToggle = this.querySelector<HTMLInputElement>('.settings-proxy-toggle')!;
        this.proxyStatus = this.querySelector<HTMLElement>('.settings-proxy-status')!;
        this.proxyIndicator = this.querySelector<HTMLElement>('.settings-proxy-indicator')!;
        this.proxyLabel = this.querySelector<HTMLElement>('.settings-proxy-label')!;
        this.proxyDetail = this.querySelector<HTMLElement>('.settings-proxy-detail')!;
        this.versionInfo = this.querySelector<HTMLElement>('.settings-version-info')!;

        // Connection list elements
        this.connectionList = this.querySelector<HTMLElement>('.settings-connection-list')!;
        this.addConnectionBtn = this.querySelector<HTMLButtonElement>(
            '.settings-add-connection-btn'
        )!;
        this.addConnectionForm = this.querySelector<HTMLElement>('.settings-add-connection-form')!;
        this.loginDomainSelect = this.querySelector<HTMLSelectElement>('.settings-login-domain')!;
        this.customDomainField = this.querySelector<HTMLElement>('.settings-custom-domain-field')!;
        this.customDomainInput = this.querySelector<HTMLInputElement>('.settings-custom-domain')!;
        this.newClientIdInput = this.querySelector<HTMLInputElement>('.settings-new-client-id')!;
        this.authorizeBtn = this.querySelector<HTMLButtonElement>('.settings-authorize-btn')!;
        this.cancelBtn = this.querySelector<HTMLButtonElement>('.settings-cancel-btn')!;

        // Edit modal elements
        this.editModal = this.querySelector<HTMLElement>('.settings-edit-modal')!;
        this.editLabelInput = this.querySelector<HTMLInputElement>('.settings-edit-label')!;
        this.editClientIdInput = this.querySelector<HTMLInputElement>('.settings-edit-client-id')!;
        this.editSaveBtn = this.querySelector<HTMLButtonElement>('.settings-edit-save-btn')!;
        this.editCancelBtn = this.querySelector<HTMLButtonElement>('.settings-edit-cancel-btn')!;

        // Cache management elements
        this.refreshCacheBtn = this.querySelector<HTMLButtonElement>(
            '.settings-refresh-cache-btn'
        )!;
        this.cacheStatus = this.querySelector<HTMLElement>('.settings-cache-status')!;
    }

    private attachEventListeners(): void {
        // Theme listeners
        this.themeRadios.forEach(radio => {
            radio.addEventListener('change', () => this.handleThemeChange(radio.value));
        });

        // Proxy listeners
        this.proxyToggle.addEventListener('change', this.handleProxyToggle);

        // Connection list listeners
        this.addConnectionBtn.addEventListener('click', this.showAddConnectionForm);
        this.cancelBtn.addEventListener('click', this.hideAddConnectionForm);
        this.authorizeBtn.addEventListener('click', this.handleAddConnection);
        this.loginDomainSelect.addEventListener('change', this.handleLoginDomainChange);

        // Connection list item actions (delegated)
        this.connectionList.addEventListener('click', this.handleConnectionAction);

        // Edit modal listeners
        this.editSaveBtn.addEventListener('click', this.handleSaveEdit);
        this.editCancelBtn.addEventListener('click', this.hideEditModal);
        this.editModal.addEventListener('click', (e: Event) => {
            if (e.target === this.editModal) this.hideEditModal();
        });

        // Cache management listeners
        this.refreshCacheBtn.addEventListener('click', this.handleRefreshCache);
    }

    // ============================================================
    // Theme Management
    // ============================================================

    private async initThemeUI(): Promise<void> {
        const { theme } = await chrome.storage.local.get(['theme']);
        const savedTheme = (theme as string) || 'system';

        // Set the radio button
        const radio = this.querySelector<HTMLInputElement>(
            `.settings-theme-radio[value="${savedTheme}"]`
        );
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

    private getCurrentThemeSetting(): string {
        const checked = this.querySelector<HTMLInputElement>('.settings-theme-radio:checked');
        return checked ? checked.value : 'system';
    }

    private async handleThemeChange(theme: string): Promise<void> {
        await chrome.storage.local.set({ theme });
        this.applyTheme(theme);

        // Notify other tabs/windows about the theme change
        const event = new CustomEvent('theme-changed', {
            detail: { theme },
        }) as ThemeChangedEvent;
        document.dispatchEvent(event);
    }

    private applyTheme(theme: string): void {
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

    private async renderConnectionList(): Promise<void> {
        const connections = await loadConnections();
        const activeId = getActiveConnectionId();

        if (connections.length === 0) {
            this.connectionList.innerHTML =
                '<div class="settings-no-connections">No connections saved</div>';
            return;
        }

        this.connectionList.innerHTML = connections
            .map(conn => this.createConnectionCardHtml(conn, activeId))
            .join('');
    }

    private createConnectionCardHtml(conn: SalesforceConnection, activeId: string | null): string {
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

    private handleConnectionAction = (e: Event): void => {
        const item = (e.target as HTMLElement).closest('.settings-connection-item') as HTMLElement;
        if (!item) return;

        const connectionId = item.dataset.id;
        if (!connectionId) return;

        if ((e.target as HTMLElement).closest('.settings-connection-edit')) {
            this.showEditModal(connectionId);
        } else if ((e.target as HTMLElement).closest('.settings-connection-reauth')) {
            this.handleReauthorize(connectionId);
        } else if ((e.target as HTMLElement).closest('.settings-connection-delete')) {
            this.handleDeleteConnection(connectionId);
        }
    };

    private showAddConnectionForm = (): void => {
        this.addConnectionBtn.classList.add('hidden');
        this.addConnectionForm.classList.remove('hidden');
    };

    private hideAddConnectionForm = (): void => {
        this.addConnectionForm.classList.add('hidden');
        this.addConnectionBtn.classList.remove('hidden');
        // Reset form
        this.loginDomainSelect.value = 'auto';
        this.customDomainField.classList.add('hidden');
        this.customDomainInput.value = '';
        this.newClientIdInput.value = '';
    };

    private handleLoginDomainChange = (): void => {
        if (this.loginDomainSelect.value === 'custom') {
            this.customDomainField.classList.remove('hidden');
        } else {
            this.customDomainField.classList.add('hidden');
        }
    };

    private handleAddConnection = async (): Promise<void> => {
        let loginDomain: string | null = this.loginDomainSelect.value;

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
                loginDomain = `https://${loginDomain}`;
            }
        }

        const clientId = this.newClientIdInput.value.trim() || null;

        // Store pending auth and start OAuth flow
        await setPendingAuth({
            loginDomain,
            clientId,
            connectionId: null,
            state: '',
        } as any);

        // Call startAuthorization from app.js (available on window)
        if (window.startAuthorization) {
            window.startAuthorization(loginDomain, clientId, null);
        }

        this.hideAddConnectionForm();
    };

    private async showEditModal(connectionId: string): Promise<void> {
        const connections = await loadConnections();
        const connection = connections.find(c => c.id === connectionId);
        if (!connection) return;

        this.editingConnectionId = connectionId;
        this.editLabelInput.value = connection.label;
        this.editClientIdInput.value = connection.clientId || '';
        this.editModal.classList.remove('hidden');
    }

    private hideEditModal = (): void => {
        this.editModal.classList.add('hidden');
        this.editingConnectionId = null;
    };

    private handleSaveEdit = async (): Promise<void> => {
        const label = this.editLabelInput.value.trim();
        if (!label) {
            alert('Label is required');
            return;
        }

        const newClientId = this.editClientIdInput.value.trim() || null;
        const connectionId = this.editingConnectionId; // Save before hideEditModal clears it
        if (!connectionId) return;

        const connections = await loadConnections();
        const connection = connections.find(c => c.id === connectionId);
        if (!connection) return;

        const clientIdChanged = connection.clientId !== newClientId;

        await updateConnection(connectionId, {
            label: label,
            clientId: newClientId,
        } as any);

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
    };

    private async handleReauthorize(connectionId: string): Promise<void> {
        const connections = await loadConnections();
        const connection = connections.find(c => c.id === connectionId);
        if (!connection) return;

        // Store pending auth with connection's clientId and ID for re-auth
        await setPendingAuth({
            loginDomain: connection.instanceUrl,
            clientId: connection.clientId,
            connectionId: connectionId,
            state: '',
        } as any);

        // Call startAuthorization from app.js
        if (window.startAuthorization) {
            window.startAuthorization(connection.instanceUrl, connection.clientId, connectionId);
        }
    }

    private async handleDeleteConnection(connectionId: string): Promise<void> {
        if (!confirm('Remove this connection?')) return;

        const wasActive = getActiveConnectionId() === connectionId;
        if (wasActive) {
            setActiveConnection(null);
        }

        await removeConnection(connectionId);
        this.renderConnectionList();

        // Notify other components
        document.dispatchEvent(
            new CustomEvent('connection-removed', {
                detail: { connectionId },
            })
        );
    }

    // ============================================================
    // Proxy Management
    // ============================================================

    private async initProxyUI(): Promise<void> {
        const { proxyEnabled } = await chrome.storage.local.get(['proxyEnabled']);
        this.proxyToggle.checked = (proxyEnabled as boolean) || false;

        if (proxyEnabled) {
            this.proxyStatus.classList.remove('hidden');
            await this.checkProxyStatus();
        }
    }

    private handleProxyToggle = async (): Promise<void> => {
        const enabled = this.proxyToggle.checked;
        await chrome.storage.local.set({ proxyEnabled: enabled });

        if (enabled) {
            this.proxyStatus.classList.remove('hidden');
            await this.connect();
        } else {
            await this.disconnect();
            this.proxyStatus.classList.add('hidden');
        }
    };

    private updateProxyUI(status: ProxyStatus): void {
        const { connected, httpPort, version, error } = status;

        this.proxyIndicator.className = `status-indicator ${connected ? 'connected' : 'disconnected'}`;

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

    private setConnecting(): void {
        this.proxyIndicator.className = 'status-indicator connecting';
        this.proxyLabel.textContent = 'Connecting...';
        this.proxyDetail.textContent = 'Establishing connection to local proxy';
    }

    private async checkProxyStatus(): Promise<void> {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'checkProxyConnection' });
            this.updateProxyUI(response);
        } catch (err) {
            this.updateProxyUI({ connected: false, error: (err as Error).message });
        }
    }

    private async connect(): Promise<void> {
        this.setConnecting();

        try {
            const response = await chrome.runtime.sendMessage({ type: 'connectProxy' });

            if (response.success) {
                this.updateProxyUI({
                    connected: true,
                    httpPort: response.httpPort,
                    version: response.version,
                });

                // Notify the app that proxy status changed
                document.dispatchEvent(
                    new CustomEvent('proxy-status-changed', {
                        detail: { connected: true },
                    })
                );
            } else {
                this.updateProxyUI({
                    connected: false,
                    error: response.error || 'Connection failed',
                });

                // Notify the app that proxy status changed
                document.dispatchEvent(
                    new CustomEvent('proxy-status-changed', {
                        detail: { connected: false },
                    })
                );
            }
        } catch (err) {
            this.updateProxyUI({ connected: false, error: (err as Error).message });

            // Notify the app that proxy status changed
            document.dispatchEvent(
                new CustomEvent('proxy-status-changed', {
                    detail: { connected: false },
                })
            );
        }
    }

    private async disconnect(): Promise<void> {
        try {
            await chrome.runtime.sendMessage({ type: 'disconnectProxy' });
            this.updateProxyUI({ connected: false });

            // Notify the app that proxy status changed
            document.dispatchEvent(
                new CustomEvent('proxy-status-changed', {
                    detail: { connected: false },
                })
            );
        } catch (err) {
            console.error('Disconnect error:', err);
        }
    }

    // ============================================================
    // Cache Management
    // ============================================================

    private handleRefreshCache = async (): Promise<void> => {
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
            this.cacheStatus.textContent = `Error: ${(err as Error).message}`;
            this.cacheStatus.className = 'settings-cache-status error';
        } finally {
            this.refreshCacheBtn.disabled = false;
        }
    };
}

customElements.define('settings-tab', SettingsTab);
