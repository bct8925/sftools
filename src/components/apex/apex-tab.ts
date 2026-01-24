// Apex Tab - Anonymous Apex Execution with History & Favorites
import { isAuthenticated } from '../../lib/utils.js';
import { executeAnonymousApex } from '../../lib/salesforce.js';
import { updateStatusBadge } from '../../lib/ui-helpers.js';
import { HistoryManager } from '../../lib/history-manager.js';
import { escapeHtml } from '../../lib/text-utils.js';
import { getPreview, formatOutput, filterLines } from '../../lib/apex-utils.js';
import { monaco } from '../monaco-editor/monaco-editor.js';
import type { MonacoEditorElement } from '../../types/components';
import type { HistoryEntry, FavoriteEntry } from '../../lib/history-manager';
import type { StatusType } from '../../lib/ui-helpers';
import '../button-icon/button-icon.js';
import '../modal/modal-popup.js';
import template from './apex.html?raw';
import './apex.css';

class ApexTab extends HTMLElement {
    // DOM references
    private codeEditor!: MonacoEditorElement;
    private outputEditor!: MonacoEditorElement;
    private executeBtn!: HTMLButtonElement;
    private statusSpan!: HTMLElement;
    private searchInput!: HTMLInputElement;

    // Button components
    private historyBtn!: HTMLElement;
    private historyModal!: any; // modal-popup element

    // History dropdown elements
    private historyList!: HTMLElement;
    private favoritesList!: HTMLElement;
    private dropdownTabs!: NodeListOf<HTMLElement>;

    // History/Favorites manager
    private historyManager!: HistoryManager;
    private fullOutput = ''; // Store unfiltered output for search
    private filterDebounceTimeout: number | null = null;

    connectedCallback(): void {
        this.innerHTML = template;
        this.historyManager = new HistoryManager(
            { history: 'apexHistory', favorites: 'apexFavorites' },
            { contentProperty: 'code' }
        );
        this.initElements();
        this.initEditors();
        this.attachEventListeners();
        this.loadStoredData();
    }

    disconnectedCallback(): void {
        if (this.filterDebounceTimeout !== null) {
            clearTimeout(this.filterDebounceTimeout);
        }
    }

    private initElements(): void {
        this.executeBtn = this.querySelector<HTMLButtonElement>('.apex-execute-btn')!;
        this.statusSpan = this.querySelector<HTMLElement>('.apex-status')!;
        this.searchInput = this.querySelector<HTMLInputElement>('.search-input')!;

        // Button components
        this.historyBtn = this.querySelector<HTMLElement>('.apex-history-btn')!;
        this.historyModal = this.querySelector('.apex-history-modal')!;

        // History dropdown elements
        this.historyList = this.querySelector<HTMLElement>('.apex-history-list')!;
        this.favoritesList = this.querySelector<HTMLElement>('.apex-favorites-list')!;
        this.dropdownTabs = this.querySelectorAll<HTMLElement>('.dropdown-tab');
    }

    private initEditors(): void {
        this.codeEditor = this.querySelector<MonacoEditorElement>('.apex-editor')!;
        this.outputEditor = this.querySelector<MonacoEditorElement>('.apex-output-editor')!;

        this.codeEditor.setValue(`// Enter your Apex code here
System.debug('Hello from Anonymous Apex!');

// Example: Query and debug accounts
List<Account> accounts = [SELECT Id, Name FROM Account LIMIT 5];
for (Account acc : accounts) {
    System.debug('Account: ' + acc.Name);
}`);

        this.setOutput('// Output will appear here after execution');
    }

    private attachEventListeners(): void {
        this.executeBtn.addEventListener('click', this.executeApex);
        this.codeEditor.addEventListener('execute', this.executeApex);

        // History modal
        this.historyBtn.addEventListener('click', () => this.historyModal.toggle());

        // History dropdown tab switching
        this.dropdownTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                if (tabName) this.switchTab(tabName);
            });
        });

        // List click delegation
        this.historyList.addEventListener('click', (e: Event) => this.handleListClick(e, 'history'));
        this.favoritesList.addEventListener('click', (e: Event) =>
            this.handleListClick(e, 'favorites')
        );

        // Search filtering with debounce for performance on large logs
        this.searchInput.addEventListener('input', () => {
            if (this.filterDebounceTimeout !== null) {
                clearTimeout(this.filterDebounceTimeout);
            }
            this.filterDebounceTimeout = window.setTimeout(() => this.applyFilter(), 200);
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

    private async saveToHistory(code: string): Promise<void> {
        await this.historyManager.saveToHistory(code);
        this.renderLists();
    }

    private async addToFavorites(code: string, label: string): Promise<void> {
        await this.historyManager.addToFavorites(code, label);
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

    private loadScript(code: string): void {
        this.codeEditor.setValue(code);
    }

    // ============================================================
    // Dropdown UI
    // ============================================================

    private switchTab(tabName: string): void {
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
                    No scripts yet.<br>Execute some Apex to see history here.
                </div>
            `;
            return;
        }

        this.historyList.innerHTML = history
            .map(
                (item: HistoryEntry) => `
            <div class="script-item" data-id="${item.id}">
                <div class="script-preview">${escapeHtml(getPreview((item as any).code))}</div>
                <div class="script-meta">
                    <span>${this.historyManager.formatRelativeTime(item.timestamp)}</span>
                    <div class="script-actions">
                        <button class="script-action load" title="Load script">&#8629;</button>
                        <button class="script-action favorite" title="Add to favorites">&#9733;</button>
                        <button class="script-action delete" title="Delete">&times;</button>
                    </div>
                </div>
            </div>
        `
            )
            .join('');
    }

    private renderFavoritesList(): void {
        const { favorites } = this.historyManager;

        if (favorites.length === 0) {
            this.favoritesList.innerHTML = `
                <div class="script-empty">
                    No favorites yet.<br>Click &#9733; on a script to save it.
                </div>
            `;
            return;
        }

        this.favoritesList.innerHTML = favorites
            .map(
                (item: FavoriteEntry) => `
            <div class="script-item" data-id="${item.id}">
                <div class="script-label">${escapeHtml(item.label)}</div>
                <div class="script-meta">
                    <span>${this.historyManager.formatRelativeTime(item.timestamp)}</span>
                    <div class="script-actions">
                        <button class="script-action load" title="Load script">&#8629;</button>
                        <button class="script-action delete" title="Delete">&times;</button>
                    </div>
                </div>
            </div>
        `
            )
            .join('');
    }

    private handleListClick(event: Event, listType: 'history' | 'favorites'): void {
        const item = (event.target as HTMLElement).closest('.script-item') as HTMLElement;
        if (!item) return;

        const { id } = item.dataset;
        if (!id) return;

        const list = listType === 'history' ? this.historyManager.history : this.historyManager.favorites;
        const scriptData = list.find((s: HistoryEntry | FavoriteEntry) => s.id === id);
        if (!scriptData) return;

        const code = (scriptData as any).code as string;

        // Check which action button was clicked
        const action = (event.target as HTMLElement).closest('.script-action') as HTMLElement;
        if (action) {
            event.stopPropagation();

            if (action.classList.contains('load')) {
                this.loadScript(code);
                this.historyModal.close();
            } else if (action.classList.contains('favorite')) {
                this.showFavoriteModal(code);
                this.historyModal.close();
            } else if (action.classList.contains('delete')) {
                if (listType === 'history') {
                    this.removeFromHistory(id);
                } else {
                    this.removeFromFavorites(id);
                }
            }
        } else {
            // Click on item itself loads the script
            this.loadScript(code);
            this.historyModal.close();
        }
    }

    private showFavoriteModal(code: string): void {
        const defaultLabel = getPreview(code);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay show';
        modal.innerHTML = `
            <div class="modal-dialog apex-favorite-dialog">
                <h3>Add to Favorites</h3>
                <input type="text" class="apex-favorite-input" placeholder="Enter a label for this script" value="${escapeHtml(defaultLabel)}">
                <div class="modal-buttons">
                    <button class="button-neutral apex-favorite-cancel">Cancel</button>
                    <button class="button-brand apex-favorite-save">Save</button>
                </div>
            </div>
        `;

        const input = modal.querySelector<HTMLInputElement>('.apex-favorite-input')!;
        const cancelBtn = modal.querySelector<HTMLButtonElement>('.apex-favorite-cancel')!;
        const saveBtn = modal.querySelector<HTMLButtonElement>('.apex-favorite-save')!;

        const close = () => modal.remove();

        cancelBtn.addEventListener('click', close);
        modal.addEventListener('click', (e: Event) => {
            if (e.target === modal) close();
        });

        saveBtn.addEventListener('click', () => {
            const label = input.value.trim();
            if (label) {
                this.addToFavorites(code, label);
                close();
            }
        });

        input.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                saveBtn.click();
            } else if (e.key === 'Escape') {
                close();
            }
        });

        document.body.appendChild(modal);
        input.focus();
        input.select();
    }

    // ============================================================
    // Output Search/Filter
    // ============================================================

    private setOutput(text: string): void {
        this.fullOutput = text;
        this.applyFilter();
    }

    private applyFilter(): void {
        const filter = this.searchInput.value.trim();
        const lines = this.fullOutput.split('\n');
        const filtered = filterLines(lines, filter);
        const result =
            filtered.length > 0
                ? filtered.join('\n')
                : `// No lines match "${this.searchInput.value}"`;
        this.outputEditor.setValue(result);
    }

    // ============================================================
    // UI Helpers
    // ============================================================

    private setEditorMarkers(result: any): void {
        const model = this.codeEditor.editor?.getModel();
        if (!model) return;

        monaco.editor.setModelMarkers(model, 'apex', []);

        const markers = [];

        if (!result.compiled && result.compileProblem && result.line) {
            markers.push({
                severity: monaco.MarkerSeverity.Error,
                message: result.compileProblem,
                startLineNumber: result.line,
                startColumn: result.column || 1,
                endLineNumber: result.line,
                endColumn: result.column ? result.column + 10 : model.getLineMaxColumn(result.line),
            });
        } else if (!result.success && result.exceptionMessage && result.line) {
            markers.push({
                severity: monaco.MarkerSeverity.Error,
                message: result.exceptionMessage,
                startLineNumber: result.line,
                startColumn: 1,
                endLineNumber: result.line,
                endColumn: model.getLineMaxColumn(result.line),
            });
        }

        if (markers.length > 0) {
            monaco.editor.setModelMarkers(model, 'apex', markers);
        }
    }

    private updateStatus(text: string, type: StatusType = ''): void {
        updateStatusBadge(this.statusSpan, text, type);
    }

    // ============================================================
    // Main Execution Handler
    // ============================================================

    private executeApex = async (): Promise<void> => {
        const apexCode = this.codeEditor.getValue().trim();

        if (!apexCode) {
            this.setOutput('// Please enter Apex code to execute');
            return;
        }

        if (!isAuthenticated()) {
            alert('Not authenticated. Please authorize via the connection selector.');
            return;
        }

        // Clear previous markers
        const model = this.codeEditor.editor?.getModel();
        if (model) {
            monaco.editor.setModelMarkers(model, 'apex', []);
        }

        this.executeBtn.disabled = true;

        try {
            const result = await executeAnonymousApex(apexCode, (status: string) => {
                this.updateStatus(status, 'loading');
                this.setOutput(`// ${status}`);
            });

            this.setEditorMarkers(result.execution);

            if (!result.execution.compiled) {
                this.updateStatus('Compile Error', 'error');
            } else if (!result.execution.success) {
                this.updateStatus('Runtime Error', 'error');
            } else {
                this.updateStatus('Success', 'success');
            }

            this.setOutput(formatOutput(result.execution, result.debugLog));

            // Save to history after execution
            await this.saveToHistory(apexCode);
        } catch (error) {
            this.updateStatus('Error', 'error');
            this.setOutput(`Error: ${(error as Error).message}`);
            console.error('Apex execution error:', error);
        } finally {
            this.executeBtn.disabled = false;
        }
    };
}

customElements.define('apex-tab', ApexTab);
