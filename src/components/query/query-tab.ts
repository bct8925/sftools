// Query Tab - SOQL Query Editor with tabbed results
import { isAuthenticated, getActiveConnectionId } from '../../lib/utils.js';
import {
    executeQueryWithColumns,
    executeBulkQueryExport,
    getObjectDescribe,
    updateRecord,
} from '../../lib/salesforce.js';
import {
    registerSOQLCompletionProvider,
    activateSOQLAutocomplete,
    clearState as clearAutocompleteState,
} from '../../lib/soql-autocomplete.js';
import { updateStatusBadge } from '../../lib/ui-helpers.js';
import { HistoryManager } from '../../lib/history-manager.js';
import { escapeHtml } from '../../lib/text-utils.js';
import { icons } from '../../lib/icons.js';
import type { SObject, FieldDescribe, ColumnMetadata } from '../../types/salesforce';
import type { MonacoEditorElement } from '../../types/components';
import type { StatusType } from '../../lib/ui-helpers';
import '../monaco-editor/monaco-editor.js';
import '../button-icon/button-icon.js';
import '../modal-popup/modal-popup.js';
import template from './query.html?raw';
import './query.css';

interface Column {
    title: string;
    path: string;
    aggregate: boolean;
    isSubquery: boolean;
    subqueryColumns?: ColumnMetadata[];
}

interface TabData {
    id: string;
    query: string;
    normalizedQuery: string;
    objectName: string | null;
    records: SObject[];
    columns: Column[];
    totalSize: number;
    fieldDescribe: Record<string, FieldDescribe> | null;
    modifiedRecords: Map<string, Record<string, any>>;
    isEditable: boolean;
    loading: boolean;
    error?: string;
}

interface QueryResult {
    records: SObject[];
    totalSize: number;
    entityName: string;
    columnMetadata: ColumnMetadata[];
}

class QueryTab extends HTMLElement {
    // State
    private queryTabs = new Map<string, TabData>();
    private activeTabId: string | null = null;
    private tabCounter = 0;
    private bulkExportInProgress = false;
    private filterDebounceTimeout: number | null = null;

    // DOM references
    private editor!: MonacoEditorElement;
    private tabsContainer!: HTMLElement;
    private resultsContainer!: HTMLElement;
    private toolingCheckbox!: HTMLInputElement;
    private editingCheckbox!: HTMLInputElement;
    private statusSpan!: HTMLElement;
    private searchInput!: HTMLInputElement;
    private exportBtn!: HTMLButtonElement;
    private saveBtn!: HTMLButtonElement;
    private clearBtn!: HTMLButtonElement;

    // Button components
    private historyBtn!: HTMLElement;
    private historyModal!: any;
    private settingsBtn!: HTMLElement;
    private resultsBtn!: any;
    private actionBtn!: HTMLElement;

    // History dropdown elements
    private historyList!: HTMLElement;
    private favoritesList!: HTMLElement;
    private dropdownTabs!: NodeListOf<HTMLElement>;

    // Favorite modal elements
    private favoriteModal!: any;
    private favoriteInput!: HTMLInputElement;
    private favoriteCancelBtn!: HTMLButtonElement;
    private favoriteSaveBtn!: HTMLButtonElement;
    private bulkExportBtn!: HTMLButtonElement;

    // History/Favorites manager
    private historyManager!: HistoryManager;
    private pendingFavoriteQuery: string | null = null;

    // Bound event handlers for cleanup
    private boundConnectionHandler = this.handleConnectionChange.bind(this);

    connectedCallback(): void {
        this.innerHTML = template;
        this.historyManager = new HistoryManager(
            { history: 'queryHistory', favorites: 'queryFavorites' },
            { contentProperty: 'query' }
        );
        this.initElements();
        this.initEditor();
        this.attachEventListeners();
        this.loadStoredData();

        // Initialize SOQL autocomplete (global describe loads lazily on first FROM clause)
        registerSOQLCompletionProvider();
        activateSOQLAutocomplete();

        // Listen for connection changes
        document.addEventListener('connection-changed', this.boundConnectionHandler);
    }

    disconnectedCallback(): void {
        // Note: Don't deactivate autocomplete here - the innerHTML replacement in app.js
        // causes disconnect to fire after a new instance connects, which would deactivate it.
        // Since query-tab is always present (just hidden/shown), autocomplete stays active.
        document.removeEventListener('connection-changed', this.boundConnectionHandler);
        if (this.filterDebounceTimeout !== null) {
            clearTimeout(this.filterDebounceTimeout);
        }
    }

    private handleConnectionChange(): void {
        clearAutocompleteState();
    }

    private initElements(): void {
        this.tabsContainer = this.querySelector<HTMLElement>('.query-tabs')!;
        this.resultsContainer = this.querySelector<HTMLElement>('.query-results')!;
        this.toolingCheckbox = this.querySelector<HTMLInputElement>('.query-tooling-checkbox')!;
        this.editingCheckbox = this.querySelector<HTMLInputElement>('.query-editing-checkbox')!;
        this.statusSpan = this.querySelector<HTMLElement>('.query-status')!;

        // Button components
        this.historyBtn = this.querySelector<HTMLElement>('.query-history-btn')!;
        this.historyModal = this.querySelector('.query-history-modal')!;
        this.settingsBtn = this.querySelector<HTMLElement>('.query-settings-btn')!;
        this.resultsBtn = this.querySelector('.query-results-btn')!;
        this.actionBtn = this.querySelector<HTMLElement>('.query-action-btn')!;

        // History dropdown elements
        this.historyList = this.querySelector<HTMLElement>('.query-history-list')!;
        this.favoritesList = this.querySelector<HTMLElement>('.query-favorites-list')!;
        this.dropdownTabs = this.querySelectorAll<HTMLElement>('.dropdown-tab');

        // Favorite modal elements
        this.favoriteModal = this.querySelector('.query-favorite-modal')!;
        this.favoriteInput = this.querySelector<HTMLInputElement>('.query-favorite-input')!;
        this.favoriteCancelBtn = this.querySelector<HTMLButtonElement>('.query-favorite-cancel')!;
        this.favoriteSaveBtn = this.querySelector<HTMLButtonElement>('.query-favorite-save')!;

        // Search elements
        this.searchInput = this.querySelector<HTMLInputElement>('.search-input')!;

        // Export, Save, and Clear buttons (inside results dropdown)
        this.exportBtn = this.querySelector<HTMLButtonElement>('.query-export-btn')!;
        this.bulkExportBtn = this.querySelector<HTMLButtonElement>('.query-bulk-export-btn')!;
        this.saveBtn = this.querySelector<HTMLButtonElement>('.query-save-btn')!;
        this.clearBtn = this.querySelector<HTMLButtonElement>('.query-clear-btn')!;
    }

    private initEditor(): void {
        this.editor = this.querySelector<MonacoEditorElement>('.query-editor')!;
        this.editor.setValue(`SELECT
    Id,
    Name
FROM Account
LIMIT 10`);
    }

    private attachEventListeners(): void {
        // Query execution
        this.actionBtn.addEventListener('click', () => this.executeQuery());
        this.editor.addEventListener('execute', () => this.executeQuery());

        // History modal
        this.historyBtn.addEventListener('click', () => this.historyModal.toggle());

        // History tab switching
        this.dropdownTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                if (tabName) this.switchDropdownTab(tabName);
            });
        });

        // List click delegation
        this.historyList.addEventListener('click', (e: Event) => this.handleListClick(e, 'history'));
        this.favoritesList.addEventListener('click', (e: Event) =>
            this.handleListClick(e, 'favorites')
        );

        // Favorite modal
        this.favoriteCancelBtn.addEventListener('click', () => this.favoriteModal.close());
        this.favoriteSaveBtn.addEventListener('click', () => this.handleFavoriteSave());
        this.favoriteInput.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                this.handleFavoriteSave();
            } else if (e.key === 'Escape') {
                this.favoriteModal.close();
            }
        });

        // Search filtering with debounce for performance on large result sets
        this.searchInput.addEventListener('input', () => {
            if (this.filterDebounceTimeout !== null) {
                clearTimeout(this.filterDebounceTimeout);
            }
            this.filterDebounceTimeout = window.setTimeout(() => this.applyRowFilter(), 200);
        });

        // Export CSV handler
        this.exportBtn.addEventListener('click', () => {
            this.exportCurrentResults();
            this.resultsBtn.close();
        });

        // Bulk Export handler
        this.bulkExportBtn.addEventListener('click', () => {
            this.bulkExport();
            this.resultsBtn.close();
        });

        // Save changes handler
        this.saveBtn.addEventListener('click', () => {
            this.saveChanges();
            this.resultsBtn.close();
        });

        // Clear changes handler
        this.clearBtn.addEventListener('click', () => {
            this.clearChanges();
            this.resultsBtn.close();
        });

        // Editing checkbox handler
        this.editingCheckbox.addEventListener('change', () => {
            this.renderResults();
            this.updateSaveButtonState();
        });
    }

    // ============================================================
    // Storage Operations
    // ============================================================

    private async loadStoredData(): Promise<void> {
        await this.historyManager.load();
        this.renderLists();
    }

    // ============================================================
    // History & Favorites Logic
    // ============================================================

    private async saveToHistory(query: string): Promise<void> {
        await this.historyManager.saveToHistory(query);
        this.renderLists();
    }

    private async addToFavorites(query: string, label: string): Promise<void> {
        await this.historyManager.addToFavorites(query, label);
        this.renderLists();
    }

    private async removeFromHistory(id: string): Promise<void> {
        await this.historyManager.removeFromHistory(id);
        this.renderLists();
    }

    private async removeFromFavorites(id: string): Promise<void> {
        await this.historyManager.removeFromFavorites(id);
        this.renderLists();
    }

    private loadQuery(query: string): void {
        this.editor.setValue(query);
    }

    // ============================================================
    // Dropdown UI
    // ============================================================

    private switchDropdownTab(tabName: string): void {
        this.dropdownTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        this.historyList.style.display = tabName === 'history' ? '' : 'none';
        this.favoritesList.style.display = tabName === 'favorites' ? '' : 'none';
    }

    // ============================================================
    // List Rendering
    // ============================================================

    private renderLists(): void {
        this.renderHistoryList();
        this.renderFavoritesList();
    }

    private renderHistoryList(): void {
        const { history } = this.historyManager;

        if (history.length === 0) {
            this.historyList.innerHTML = `
                <div class="script-empty">
                    No queries yet.<br>Execute some SOQL to see history here.
                </div>
            `;
            return;
        }

        this.historyList.innerHTML = history
            .map(
                (item: any) => {
                    const query = (item as any).query as string | undefined;
                    return `
            <div class="script-item" data-id="${item.id}">
                <div class="script-preview">${escapeHtml(this.historyManager.getPreview(query || ''))}</div>
                <div class="script-meta">
                    <span>${this.historyManager.formatRelativeTime(item.timestamp)}</span>
                    <div class="script-actions">
                        <button class="script-action load" title="Load query">&#8629;</button>
                        <button class="script-action favorite" title="Add to favorites">&#9733;</button>
                        <button class="script-action delete" title="Delete">&times;</button>
                    </div>
                </div>
            </div>
        `;
                }
            )
            .join('');
    }

    private renderFavoritesList(): void{
        const { favorites } = this.historyManager;

        if (favorites.length === 0) {
            this.favoritesList.innerHTML = `
                <div class="script-empty">
                    No favorites yet.<br>Click &#9733; on a query to save it.
                </div>
            `;
            return;
        }

        this.favoritesList.innerHTML = favorites
            .map(
                (item: any) => {
                    const label = (item as any).label as string | undefined;
                    return `
            <div class="script-item" data-id="${item.id}">
                <div class="script-label">${escapeHtml(label || '')}</div>
                <div class="script-meta">
                    <span>${this.historyManager.formatRelativeTime(item.timestamp)}</span>
                    <div class="script-actions">
                        <button class="script-action load" title="Load query">&#8629;</button>
                        <button class="script-action delete" title="Delete">&times;</button>
                    </div>
                </div>
            </div>
        `;
                }
            )
            .join('');
    }

    private handleListClick(event: Event, listType: 'history' | 'favorites'): void {
        const item = (event.target as HTMLElement).closest('.script-item') as HTMLElement;
        if (!item) return;

        const { id } = item.dataset;
        if (!id) return;

        const list = listType === 'history' ? this.historyManager.history : this.historyManager.favorites;
        const scriptData = list.find((s: any) => s.id === id);
        if (!scriptData) return;

        const query = (scriptData as any).query as string;

        const action = (event.target as HTMLElement).closest('.script-action') as HTMLElement;
        if (action) {
            event.stopPropagation();

            if (action.classList.contains('load')) {
                this.loadQuery(query);
                this.historyModal.close();
            } else if (action.classList.contains('favorite')) {
                this.showFavoriteModal(query);
                this.historyModal.close();
            } else if (action.classList.contains('delete')) {
                if (listType === 'history') {
                    this.removeFromHistory(id);
                } else {
                    this.removeFromFavorites(id);
                }
            }
        } else {
            this.loadQuery(query);
            this.historyModal.close();
        }
    }

    private showFavoriteModal(query: string): void {
        this.pendingFavoriteQuery = query;
        const defaultLabel = this.historyManager.getPreview(query);

        this.favoriteInput.value = defaultLabel;
        this.favoriteModal.open();
        this.favoriteInput.focus();
        this.favoriteInput.select();
    }

    private handleFavoriteSave(): void {
        const label = this.favoriteInput.value.trim();
        if (label && this.pendingFavoriteQuery) {
            this.addToFavorites(this.pendingFavoriteQuery, label);
            this.favoriteModal.close();
            this.pendingFavoriteQuery = null;
        }
    }

    // ============================================================
    // Row Filter (Search)
    // ============================================================

    private applyRowFilter(): void {
        const filter = this.searchInput.value.trim().toLowerCase();
        const rows = this.resultsContainer.querySelectorAll<HTMLElement>('.query-results-table tbody tr');

        if (!filter) {
            rows.forEach(row => row.classList.remove('hidden'));
            return;
        }

        rows.forEach(row => {
            const text = row.textContent?.toLowerCase() || '';
            row.classList.toggle('hidden', !text.includes(filter));
        });
    }

    private clearRowFilter(): void {
        this.searchInput.value = '';
        const rows = this.resultsContainer.querySelectorAll<HTMLElement>('.query-results-table tbody tr');
        rows.forEach(row => row.classList.remove('hidden'));
    }

    // ============================================================
    // Data Transformations
    // ============================================================

    private normalizeQuery(query: string): string {
        return query.toLowerCase().replace(/\s+/g, ' ').trim();
    }

    private flattenColumnMetadata(columnMetadata: ColumnMetadata[], prefix = ''): Column[] {
        const columns: Column[] = [];

        for (const col of columnMetadata) {
            const { columnName } = col;
            const path = prefix ? `${prefix}.${columnName}` : columnName;

            // Check if this is a subquery (has aggregate=true and joinColumns)
            const isSubquery = col.aggregate && col.joinColumns && col.joinColumns.length > 0;

            if (isSubquery) {
                // For subqueries, add a single column representing the entire subquery
                const title = prefix ? path : col.displayName;
                columns.push({
                    title: title,
                    path: path,
                    aggregate: false,
                    isSubquery: true,
                    subqueryColumns: col.joinColumns,
                });
            } else if (col.joinColumns && col.joinColumns.length > 0) {
                // Regular parent relationship - flatten it
                columns.push(...this.flattenColumnMetadata(col.joinColumns, path));
            } else {
                // Regular scalar column
                const title = prefix ? path : col.displayName;
                columns.push({
                    title: title,
                    path: path,
                    aggregate: col.aggregate || false,
                    isSubquery: false,
                });
            }
        }

        return columns;
    }

    private extractColumnsFromRecord(record: SObject): Column[] {
        return Object.keys(record)
            .filter(key => key !== 'attributes')
            .map(key => ({
                title: key,
                path: key,
                aggregate: false,
                isSubquery: false,
            }));
    }

    private getValueByPath(record: SObject, path: string): any {
        if (!path) return undefined;

        const parts = path.split('.');
        let value: any = record;

        for (const part of parts) {
            if (value === null || value === undefined) return undefined;
            value = value[part];
        }

        return value;
    }

    // ============================================================
    // Query Execution
    // ============================================================

    private async executeQuery(): Promise<void> {
        const query = this.editor.getValue().trim();

        if (!query) {
            alert('Please enter a SOQL query.');
            return;
        }

        if (!isAuthenticated()) {
            alert('Not authenticated. Please authorize via the connection selector.');
            return;
        }

        const normalizedQuery = this.normalizeQuery(query);

        const existingTab = this.queryTabs.get(normalizedQuery);
        if (existingTab) {
            this.switchToTab(existingTab.id);
            await this.refreshTab(existingTab.id);
            await this.saveToHistory(query);
            return;
        }

        const tabId = this.createTab(query, normalizedQuery);
        this.switchToTab(tabId);
        await this.fetchQueryData(tabId);
        await this.saveToHistory(query);
    }

    private async fetchQueryData(tabId: string): Promise<void> {
        const tabData = this.getTabDataById(tabId);
        if (!tabData) return;

        this.updateStatus('Loading...', 'loading');
        tabData.error = undefined;
        tabData.loading = true;
        this.renderResults();

        try {
            const useToolingApi = this.toolingCheckbox.checked;
            const result = (await executeQueryWithColumns(tabData.query, useToolingApi)) as QueryResult;

            tabData.records = result.records;
            tabData.totalSize = result.totalSize;
            tabData.objectName = result.entityName;

            this.processColumnMetadata(result, tabData);

            tabData.isEditable = this.checkIfEditable(tabData);

            await this.fetchFieldMetadataIfEditable(tabData);

            this.updateStatus(
                `${tabData.totalSize} record${tabData.totalSize !== 1 ? 's' : ''}`,
                'success'
            );
            this.renderTabs();
        } catch (error) {
            tabData.records = [];
            tabData.columns = [];
            tabData.error = (error as Error).message;
            tabData.isEditable = false;
            this.updateStatus('Error', 'error');
        } finally {
            tabData.loading = false;
        }

        this.renderResults();
        this.clearRowFilter();
        this.updateExportButtonState();
        this.updateSaveButtonState();
    }

    private processColumnMetadata(result: QueryResult, tabData: TabData): void {
        if (result.columnMetadata.length > 0) {
            tabData.columns = this.flattenColumnMetadata(result.columnMetadata);
        } else if (tabData.records.length > 0) {
            tabData.columns = this.extractColumnsFromRecord(tabData.records[0]);
        } else {
            tabData.columns = [];
        }
    }

    private async fetchFieldMetadataIfEditable(tabData: TabData): Promise<void> {
        if (!tabData.isEditable || !tabData.objectName) {
            return;
        }

        try {
            const describe = await getObjectDescribe(tabData.objectName);
            tabData.fieldDescribe = {};
            for (const field of describe.fields) {
                tabData.fieldDescribe[field.name] = field;
            }
        } catch (err) {
            console.warn('Failed to fetch field metadata:', err);
            tabData.isEditable = false;
        }
    }

    private checkIfEditable(tabData: TabData): boolean {
        // Must have Id column
        const hasIdColumn = tabData.columns.some(col => col.path === 'Id');
        if (!hasIdColumn) return false;

        // Must not have aggregate functions
        const hasAggregate = tabData.columns.some(col => col.aggregate);
        if (hasAggregate) return false;

        // Must have a single object name
        if (!tabData.objectName) return false;

        return true;
    }

    // ============================================================
    // Tab Management
    // ============================================================

    private createTab(query: string, normalizedQuery: string): string {
        const tabId = `query-tab-${++this.tabCounter}`;
        const tabData: TabData = {
            id: tabId,
            query: query,
            normalizedQuery: normalizedQuery,
            objectName: null,
            records: [],
            columns: [],
            totalSize: 0,
            fieldDescribe: null,
            modifiedRecords: new Map(),
            isEditable: false,
            loading: false,
        };

        this.queryTabs.set(normalizedQuery, tabData);
        this.renderTabs();
        return tabId;
    }

    private switchToTab(tabId: string): void {
        this.activeTabId = tabId;

        // Restore the query to the editor when switching tabs
        const tabData = this.getTabDataById(tabId);
        if (tabData && tabData.query) {
            this.editor.setValue(tabData.query);
        }

        this.renderTabs();
        this.renderResults();
        this.clearRowFilter();
        this.updateExportButtonState();
    }

    private async refreshTab(tabId: string): Promise<void> {
        const tabData = this.getTabDataById(tabId);
        if (tabData) {
            await this.fetchQueryData(tabId);
        }
    }

    private getTabDataById(tabId: string | null): TabData | null {
        if (!tabId) return null;
        for (const tab of this.queryTabs.values()) {
            if (tab.id === tabId) {
                return tab;
            }
        }
        return null;
    }

    private closeTab(tabId: string): void {
        let keyToRemove: string | null = null;
        for (const [key, tab] of this.queryTabs) {
            if (tab.id === tabId) {
                keyToRemove = key;
                break;
            }
        }

        if (keyToRemove) {
            this.queryTabs.delete(keyToRemove);

            if (this.activeTabId === tabId) {
                const remaining = Array.from(this.queryTabs.values());
                if (remaining.length > 0) {
                    this.switchToTab(remaining[remaining.length - 1].id);
                } else {
                    this.activeTabId = null;
                    this.renderTabs();
                    this.renderResults();
                    this.updateExportButtonState();
                }
            } else {
                this.renderTabs();
            }
        }
    }

    private getTabLabel(tab: TabData): string {
        if (tab.objectName) {
            return tab.objectName;
        }

        const maxLength = 30;
        if (tab.query.length <= maxLength) return tab.query;
        return `${tab.query.substring(0, maxLength)}...`;
    }

    // ============================================================
    // UI Rendering
    // ============================================================

    private updateStatus(status: string, type: StatusType = ''): void {
        updateStatusBadge(this.statusSpan, status, type);
    }

    private renderTabs(): void {
        this.tabsContainer.innerHTML = '';

        if (this.queryTabs.size === 0) {
            this.tabsContainer.innerHTML =
                '<div class="query-tabs-empty">Run a query to see results</div>';
            return;
        }

        for (const tab of this.queryTabs.values()) {
            const tabEl = document.createElement('div');
            tabEl.className = `query-tab${tab.id === this.activeTabId ? ' active' : ''}`;
            tabEl.dataset.tabId = tab.id;

            const label = document.createElement('span');
            label.className = 'query-tab-label';
            label.textContent = this.getTabLabel(tab);
            label.title = tab.query;
            label.addEventListener('click', () => this.switchToTab(tab.id));

            const refreshBtn = document.createElement('button');
            refreshBtn.className = 'query-tab-refresh';
            refreshBtn.innerHTML = icons.refreshTab;
            refreshBtn.title = 'Refresh';
            refreshBtn.addEventListener('click', (e: Event) => {
                e.stopPropagation();
                this.refreshTab(tab.id);
            });

            const closeBtn = document.createElement('button');
            closeBtn.className = 'query-tab-close';
            closeBtn.innerHTML = icons.closeTab;
            closeBtn.title = 'Close';
            closeBtn.addEventListener('click', (e: Event) => {
                e.stopPropagation();
                this.closeTab(tab.id);
            });

            tabEl.appendChild(label);
            tabEl.appendChild(refreshBtn);
            tabEl.appendChild(closeBtn);
            this.tabsContainer.appendChild(tabEl);
        }
    }

    private renderResults(): void {
        if (!this.activeTabId) {
            this.resultsContainer.innerHTML =
                '<div class="query-results-empty">No query results to display</div>';
            return;
        }

        const tabData = this.getTabDataById(this.activeTabId);
        if (!tabData) {
            this.resultsContainer.innerHTML =
                '<div class="query-results-empty">No query results to display</div>';
            return;
        }

        if (tabData.loading) {
            this.resultsContainer.innerHTML =
                '<div class="query-results-loading"><div class="query-spinner"></div><div>Loading query results...</div></div>';
            return;
        }

        if (tabData.error) {
            this.resultsContainer.innerHTML = `<div class="query-results-error">${escapeHtml(tabData.error || '')}</div>`;
            return;
        }

        if (tabData.records.length === 0) {
            this.resultsContainer.innerHTML =
                '<div class="query-results-empty">No records found</div>';
            return;
        }

        const isEditMode = this.editingCheckbox.checked && tabData.isEditable;
        const table = this.createResultsTable(tabData, isEditMode);

        this.resultsContainer.innerHTML = '';
        this.resultsContainer.appendChild(table);

        if (isEditMode) {
            this.attachEditableListeners(tabData);
        }
    }

    private createResultsTable(tabData: TabData, isEditMode: boolean): HTMLTableElement {
        const table = document.createElement('table');
        table.className = 'query-results-table';
        if (isEditMode) {
            table.classList.add('query-results-editable');
        }

        table.appendChild(this.createTableHeader(tabData.columns));
        table.appendChild(this.createTableBody(tabData, isEditMode));

        return table;
    }

    private createTableHeader(columns: Column[]): HTMLTableSectionElement {
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        for (const col of columns) {
            const th = document.createElement('th');
            th.textContent = col.title;
            headerRow.appendChild(th);
        }

        thead.appendChild(headerRow);
        return thead;
    }

    private createTableBody(tabData: TabData, isEditMode: boolean): HTMLTableSectionElement {
        const tbody = document.createElement('tbody');

        for (const record of tabData.records) {
            const row = this.createRecordRow(record, tabData, isEditMode);
            tbody.appendChild(row);
        }

        return tbody;
    }

    private createRecordRow(record: SObject, tabData: TabData, isEditMode: boolean): HTMLTableRowElement {
        const recordId = this.getValueByPath(record, 'Id');
        const row = document.createElement('tr');
        row.dataset.recordId = recordId;

        for (const col of tabData.columns) {
            const td = this.createCell(record, col, tabData, isEditMode, recordId, row);
            row.appendChild(td);
        }

        return row;
    }

    private createCell(
        record: SObject,
        col: Column,
        tabData: TabData,
        isEditMode: boolean,
        recordId: string,
        row: HTMLTableRowElement
    ): HTMLTableCellElement {
        const td = document.createElement('td');
        const value = this.getValueByPath(record, col.path);

        if (col.isSubquery) {
            this.renderSubqueryCell(td, value, col, row);
        } else if (col.path === 'Id' && value && tabData.objectName) {
            this.renderIdCell(td, value as string, tabData.objectName);
        } else if (isEditMode && this.isFieldEditable(col.path, tabData)) {
            this.renderEditableCell(td, value, col, tabData, recordId);
        } else {
            this.renderReadOnlyCell(td, value, col);
        }

        return td;
    }

    private renderIdCell(td: HTMLTableCellElement, value: string, objectName: string): void {
        const connectionId = getActiveConnectionId();
        if (connectionId) {
            const link = document.createElement('a');
            link.href = `../../pages/record/record.html?objectType=${encodeURIComponent(objectName)}&recordId=${encodeURIComponent(value)}&connectionId=${encodeURIComponent(connectionId)}`;
            link.target = '_blank';
            link.textContent = value;
            link.className = 'query-id-link';
            td.appendChild(link);
        } else {
            td.textContent = value;
            td.title = value;
        }
    }

    private renderEditableCell2(td: HTMLTableCellElement, value: any, col: Column, tabData: TabData, recordId: string): void {
        const field = tabData.fieldDescribe?.[col.path];
        if (!field) return;

        const modifiedValue = tabData.modifiedRecords.get(recordId)?.[col.path];
        const displayValue = modifiedValue !== undefined ? modifiedValue : value;

        const input = this.createEditableInput(field, displayValue, recordId, col.path);
        td.appendChild(input);

        if (modifiedValue !== undefined) {
            td.classList.add('modified');
        }
    }

    private renderEditableCell(
        td: HTMLTableCellElement,
        value: any,
        col: Column,
        tabData: TabData,
        recordId: string
    ): void {
        const field = tabData.fieldDescribe?.[col.path];
        if (!field) return;

        const modifiedValue = tabData.modifiedRecords.get(recordId)?.[col.path];
        const displayValue = modifiedValue !== undefined ? modifiedValue : value;

        const input = this.createEditableInput(field, displayValue, recordId, col.path);
        td.appendChild(input);

        if (modifiedValue !== undefined) {
            td.classList.add('modified');
        }
    }

    private renderReadOnlyCell(td: HTMLTableCellElement, value: any, col: Column): void {
        const formatted = this.formatCellValue(value, col);
        td.textContent = formatted || '';
        td.title = formatted || '';
    }

    private renderSubqueryCell(
        td: HTMLTableCellElement,
        value: any,
        col: Column,
        parentRow: HTMLTableRowElement
    ): void {
        td.className = 'query-subquery-cell';

        if (!value || !value.records || value.records.length === 0) {
            td.textContent = '(0 records)';
            td.classList.add('query-subquery-empty');
            return;
        }

        const count = value.totalSize || value.records.length;
        const button = document.createElement('button');
        button.className = 'query-subquery-toggle';
        button.textContent = `▶ ${count} record${count !== 1 ? 's' : ''}`;
        button.dataset.expanded = 'false';

        button.addEventListener('click', (e: Event) => {
            e.stopPropagation();
            const isExpanded = button.dataset.expanded === 'true';

            if (isExpanded) {
                // Collapse
                button.textContent = `▶ ${count} record${count !== 1 ? 's' : ''}`;
                button.dataset.expanded = 'false';
                const detailRow = parentRow.nextElementSibling;
                if (detailRow && detailRow.classList.contains('query-subquery-detail')) {
                    detailRow.remove();
                }
            } else {
                // Expand
                button.textContent = `▼ ${count} record${count !== 1 ? 's' : ''}`;
                button.dataset.expanded = 'true';
                this.insertSubqueryDetailRow(parentRow, value, col);
            }
        });

        td.appendChild(button);
    }

    // Remove duplicate that I accidentally added
    private renderEditableCell3(td: HTMLTableCellElement, value: any, col: Column, tabData: TabData, recordId: string): void {
        this.renderEditableCell2(td, value, col, tabData, recordId);
    }

    private insertSubqueryDetailRow(
        parentRow: HTMLTableRowElement,
        subqueryData: any,
        col: Column
    ): void {
        // Remove existing detail row if any
        const existingDetail = parentRow.nextElementSibling;
        if (existingDetail && existingDetail.classList.contains('query-subquery-detail')) {
            existingDetail.remove();
        }

        const detailRow = document.createElement('tr');
        detailRow.className = 'query-subquery-detail';

        const detailCell = document.createElement('td');
        detailCell.colSpan = parentRow.children.length;

        // Create nested table for subquery results
        const nestedTable = document.createElement('table');
        nestedTable.className = 'query-subquery-table';

        // Get column names from subqueryColumns metadata
        const subqueryColumns = col.subqueryColumns || [];
        const flattenedSubCols = this.flattenColumnMetadata(subqueryColumns);

        // If no metadata, infer from first record
        const columns =
            flattenedSubCols.length > 0
                ? flattenedSubCols
                : this.extractColumnsFromRecord(subqueryData.records[0]);

        // Build header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        for (const subCol of columns) {
            const th = document.createElement('th');
            th.textContent = subCol.title;
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        nestedTable.appendChild(thead);

        // Build rows
        const tbody = document.createElement('tbody');
        for (const record of subqueryData.records) {
            const row = document.createElement('tr');
            for (const subCol of columns) {
                const td = document.createElement('td');
                const value = this.getValueByPath(record, subCol.path);
                const formatted = this.formatCellValue(value, subCol);
                td.textContent = formatted || '';
                td.title = formatted || '';
                row.appendChild(td);
            }
            tbody.appendChild(row);
        }
        nestedTable.appendChild(tbody);

        detailCell.appendChild(nestedTable);
        detailRow.appendChild(detailCell);

        // Insert after parent row
        parentRow.parentNode!.insertBefore(detailRow, parentRow.nextSibling);
    }

    private formatCellValue(value: any, col: Column): string | null {
        if (value === null || value === undefined) {
            return '';
        }

        if (col?.isSubquery && typeof value === 'object') {
            if (value.records) {
                return `[${value.totalSize || value.records.length} records]`;
            }
            if (Array.isArray(value)) {
                return `[${value.length} records]`;
            }
        }

        if (typeof value === 'object') {
            if (value.Name !== undefined) return value.Name;
            if (value.Id !== undefined) return value.Id;
            return JSON.stringify(value);
        }

        return String(value);
    }

    // ============================================================
    // CSV Export
    // ============================================================

    private exportCurrentResults(): void {
        const tabData = this.getTabDataById(this.activeTabId);
        if (!tabData || tabData.records.length === 0) return;

        const csv = this.recordsToCsv(tabData.records, tabData.columns);
        this.downloadCsv(csv, this.getExportFilename(tabData));
    }

    private recordsToCsv(records: SObject[], columns: Column[]): string {
        const rows: string[] = [];

        const headers = columns.map(col => this.escapeCsvField(col.title));
        rows.push(headers.join(','));

        for (const record of records) {
            const row = columns.map(col => {
                const value = this.getValueByPath(record, col.path);
                const formatted = this.formatCellValue(value, col);
                return this.escapeCsvField(formatted);
            });
            rows.push(row.join(','));
        }

        return rows.join('\n');
    }

    private escapeCsvField(value: string | null | undefined): string {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    private getExportFilename(tabData: TabData): string {
        const objectName = tabData.objectName || 'query';
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        return `${objectName}_${timestamp}.csv`;
    }

    private downloadCsv(content: string, filename: string): void {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    private async bulkExport(): Promise<void> {
        const query = this.editor.getValue().trim();

        if (!query) {
            alert('Please enter a SOQL query.');
            return;
        }

        if (!isAuthenticated()) {
            alert('Not authenticated. Please authorize via the connection selector.');
            return;
        }

        if (this.toolingCheckbox.checked) {
            alert('Bulk export is not supported with Tooling API.');
            return;
        }

        if (this.bulkExportInProgress) return;

        this.bulkExportInProgress = true;
        this.bulkExportBtn.disabled = true;

        try {
            const csv = await executeBulkQueryExport(query, (state: string, recordCount?: number) => {
                if (state === 'InProgress' || state === 'UploadComplete') {
                    this.updateStatus(`Processing: ${recordCount || 0} records`, 'loading');
                } else if (state === 'Creating job...') {
                    this.updateStatus('Creating bulk job...', 'loading');
                } else if (state === 'Downloading...') {
                    this.updateStatus('Downloading results...', 'loading');
                }
            });

            const objectMatch = query.match(/FROM\s+(\w+)/i);
            const objectName = objectMatch ? objectMatch[1] : 'export';
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
            const filename = `${objectName}_${timestamp}.csv`;

            this.downloadCsv(csv, filename);
            this.updateStatus('Export complete', 'success');
        } catch (error) {
            console.error('Bulk export error:', error);
            this.updateStatus('Export failed', 'error');
            alert(`Bulk export failed: ${(error as Error).message}`);
        } finally {
            this.bulkExportInProgress = false;
            this.bulkExportBtn.disabled = false;
        }
    }

    private updateExportButtonState(): void {
        const tabData = this.getTabDataById(this.activeTabId);
        const hasResults =
            tabData && tabData.records && tabData.records.length > 0 && !tabData.error;
        this.exportBtn.disabled = !hasResults;
        this.bulkExportBtn.disabled = !hasResults;
    }

    private updateSaveButtonState(): void {
        const tabData = this.getTabDataById(this.activeTabId);
        const isEditMode = this.editingCheckbox.checked && tabData?.isEditable;
        const hasModifications = tabData && tabData.modifiedRecords.size > 0;
        this.saveBtn.disabled = !isEditMode || !hasModifications;
        this.clearBtn.disabled = !isEditMode || !hasModifications;
    }

    // ============================================================
    // Field Editing
    // ============================================================

    private isFieldEditable(fieldPath: string, tabData: TabData): boolean {
        // Only direct fields (not relationships) are editable
        if (fieldPath.includes('.')) return false;

        const field = tabData.fieldDescribe?.[fieldPath];
        if (!field) return false;

        return field.updateable && !field.calculated;
    }

    private createEditableInput(
        field: FieldDescribe,
        value: any,
        recordId: string,
        fieldName: string
    ): HTMLInputElement | HTMLSelectElement {
        const formattedValue = this.formatValueForInput(value, field);

        if (field.type === 'boolean') {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'query-field-input';
            checkbox.checked = value === true;
            checkbox.dataset.recordId = recordId;
            checkbox.dataset.fieldName = fieldName;
            checkbox.dataset.fieldType = field.type;
            return checkbox;
        }

        if (field.type === 'picklist') {
            const select = document.createElement('select');
            select.className = 'query-field-input';
            select.dataset.recordId = recordId;
            select.dataset.fieldName = fieldName;
            select.dataset.fieldType = field.type;

            const noneOption = document.createElement('option');
            noneOption.value = '';
            noneOption.textContent = '--None--';
            select.appendChild(noneOption);

            for (const pv of field.picklistValues || []) {
                if (pv.active) {
                    const option = document.createElement('option');
                    option.value = pv.value;
                    option.textContent = pv.label;
                    if (pv.value === value) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                }
            }

            return select;
        }

        // Default: text input
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'query-field-input';
        input.value = formattedValue;
        input.dataset.recordId = recordId;
        input.dataset.fieldName = fieldName;
        input.dataset.fieldType = field.type;
        return input;
    }

    private formatValueForInput(value: any, field: FieldDescribe): string {
        if (value === null || value === undefined) return '';

        switch (field.type) {
            case 'boolean':
                return value ? 'true' : 'false';
            case 'datetime':
            case 'date':
            case 'double':
            case 'currency':
            case 'percent':
            case 'int':
                return String(value);
            default:
                return String(value);
        }
    }

    private parseValueFromInput(stringValue: string, field: FieldDescribe): any {
        if (stringValue === '' || stringValue === null) return null;

        switch (field.type) {
            case 'boolean':
                return stringValue === 'true' || stringValue === 'true';
            case 'int':
                const intVal = parseInt(stringValue, 10);
                return isNaN(intVal) ? null : intVal;
            case 'double':
            case 'currency':
            case 'percent':
                const floatVal = parseFloat(stringValue);
                return isNaN(floatVal) ? null : floatVal;
            default:
                return stringValue;
        }
    }

    private attachEditableListeners(tabData: TabData): void {
        const inputs = this.resultsContainer.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.query-field-input');

        inputs.forEach(input => {
            const handler = (e: Event) => {
                const target = e.target as HTMLInputElement | HTMLSelectElement;
                const { recordId, fieldName, fieldType } = target.dataset;
                if (!recordId || !fieldName || !fieldType) return;

                const field = tabData.fieldDescribe?.[fieldName];
                if (!field) return;

                let newValue: any;
                if (fieldType === 'boolean') {
                    newValue = (target as HTMLInputElement).checked;
                } else {
                    newValue = this.parseValueFromInput(target.value, field);
                }

                // Get original value from record
                const record = tabData.records.find(r => this.getValueByPath(r, 'Id') === recordId);
                if (!record) return;

                const originalValue = this.getValueByPath(record, fieldName);

                // Compare values
                const isChanged =
                    originalValue === null || originalValue === undefined
                        ? newValue !== null && newValue !== undefined && newValue !== ''
                        : String(originalValue) !== String(newValue ?? '');

                if (isChanged) {
                    // Mark as modified
                    if (!tabData.modifiedRecords.has(recordId)) {
                        tabData.modifiedRecords.set(recordId, {});
                    }
                    tabData.modifiedRecords.get(recordId)![fieldName] = newValue;
                    target.closest('td')?.classList.add('modified');
                } else {
                    // Remove modification
                    if (tabData.modifiedRecords.has(recordId)) {
                        const mods = tabData.modifiedRecords.get(recordId)!;
                        delete mods[fieldName];
                        if (Object.keys(mods).length === 0) {
                            tabData.modifiedRecords.delete(recordId);
                        }
                    }
                    target.closest('td')?.classList.remove('modified');
                }

                this.updateSaveButtonState();
            };

            if (input.type === 'checkbox') {
                input.addEventListener('change', handler);
            } else {
                input.addEventListener('input', handler);
            }
        });
    }

    private async saveChanges(): Promise<void> {
        const tabData = this.getTabDataById(this.activeTabId);
        if (!tabData || tabData.modifiedRecords.size === 0 || !tabData.objectName) {
            return;
        }

        this.updateStatus('Saving...', 'loading');
        this.saveBtn.disabled = true;

        const updatePromises: Promise<void>[] = [];
        const errors: Array<{ recordId: string; error: string }> = [];

        for (const [recordId, fields] of tabData.modifiedRecords.entries()) {
            updatePromises.push(
                updateRecord(tabData.objectName, recordId, fields)
                    .then(() => {
                        // Update the original record data
                        const record = tabData.records.find(
                            r => this.getValueByPath(r, 'Id') === recordId
                        );
                        if (record) {
                            for (const [fieldName, value] of Object.entries(fields)) {
                                (record as any)[fieldName] = value;
                            }
                        }
                    })
                    .catch(error => {
                        errors.push({ recordId, error: (error as Error).message });
                    })
            );
        }

        await Promise.all(updatePromises);

        if (errors.length === 0) {
            // Clear all modifications
            tabData.modifiedRecords.clear();
            this.updateStatus('Saved', 'success');
            this.renderResults();
        } else {
            this.updateStatus('Save Failed', 'error');
            const errorMsg = errors.map(e => `Record ${e.recordId}: ${e.error}`).join('\n');
            alert(`Failed to save some records:\n\n${errorMsg}`);
        }

        this.updateSaveButtonState();
    }

    private clearChanges(): void {
        const tabData = this.getTabDataById(this.activeTabId);
        if (!tabData || tabData.modifiedRecords.size === 0) {
            return;
        }

        tabData.modifiedRecords.clear();
        this.renderResults();
        this.updateSaveButtonState();
    }
}

customElements.define('query-tab', QueryTab);
