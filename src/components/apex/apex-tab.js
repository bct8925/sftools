// Apex Tab - Anonymous Apex Execution with History & Favorites
import template from './apex.html?raw';
import './apex.css';
import { monaco } from '../monaco-editor/monaco-editor.js';
import '../button-icon/button-icon.js';
import '../modal-popup/modal-popup.js';
import { isAuthenticated } from '../../lib/utils.js';
import { executeAnonymousApex } from '../../lib/salesforce.js';
import { updateStatusBadge } from '../../lib/ui-helpers.js';
import { HistoryManager } from '../../lib/history-manager.js';

class ApexTab extends HTMLElement {
    // DOM references
    codeEditor = null;
    outputEditor = null;
    executeBtn = null;
    statusSpan = null;
    searchInput = null;

    // Button components
    historyBtn = null;
    historyModal = null;

    // History dropdown elements
    historyList = null;
    favoritesList = null;
    dropdownTabs = [];

    // History/Favorites manager
    historyManager = null;
    fullOutput = '';  // Store unfiltered output for search

    connectedCallback() {
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

    initElements() {
        this.executeBtn = this.querySelector('.apex-execute-btn');
        this.statusSpan = this.querySelector('.apex-status');
        this.searchInput = this.querySelector('.apex-search-input');

        // Button components
        this.historyBtn = this.querySelector('.apex-history-btn');
        this.historyModal = this.querySelector('.apex-history-modal');

        // History dropdown elements
        this.historyList = this.querySelector('.apex-history-list');
        this.favoritesList = this.querySelector('.apex-favorites-list');
        this.dropdownTabs = this.querySelectorAll('.apex-dropdown-tab');
    }

    initEditors() {
        this.codeEditor = this.querySelector('.apex-editor');
        this.outputEditor = this.querySelector('.apex-output-editor');

        this.codeEditor.setValue(`// Enter your Apex code here
System.debug('Hello from Anonymous Apex!');

// Example: Query and debug accounts
List<Account> accounts = [SELECT Id, Name FROM Account LIMIT 5];
for (Account acc : accounts) {
    System.debug('Account: ' + acc.Name);
}`);

        this.setOutput('// Output will appear here after execution');
    }

    attachEventListeners() {
        this.executeBtn.addEventListener('click', () => this.executeApex());
        this.codeEditor.addEventListener('execute', () => this.executeApex());

        // History modal
        this.historyBtn.addEventListener('toggle', () => this.historyModal.toggle());

        // History dropdown tab switching
        this.dropdownTabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // List click delegation
        this.historyList.addEventListener('click', (e) => this.handleListClick(e, 'history'));
        this.favoritesList.addEventListener('click', (e) => this.handleListClick(e, 'favorites'));

        // Search filtering
        this.searchInput.addEventListener('input', () => this.applyFilter());
    }

    // ============================================================
    // Storage Operations
    // ============================================================

    async loadStoredData() {
        await this.historyManager.load();
        this.renderLists();
    }

    // ============================================================
    // History & Favorites Logic
    // ============================================================

    async saveToHistory(code) {
        await this.historyManager.saveToHistory(code);
        this.renderLists();
    }

    async addToFavorites(code, label) {
        await this.historyManager.addToFavorites(code, label);
        this.renderLists();
    }

    async removeFromHistory(id) {
        await this.historyManager.removeFromHistory(id);
        this.renderLists();
    }

    async removeFromFavorites(id) {
        await this.historyManager.removeFromFavorites(id);
        this.renderLists();
    }

    loadScript(code) {
        this.codeEditor.setValue(code);
    }

    // ============================================================
    // Dropdown UI
    // ============================================================

    switchTab(tabName) {
        this.dropdownTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        this.historyList.style.display = tabName === 'history' ? '' : 'none';
        this.favoritesList.style.display = tabName === 'favorites' ? '' : 'none';
    }

    // ============================================================
    // List Rendering
    // ============================================================

    renderLists() {
        this.renderHistoryList();
        this.renderFavoritesList();
    }

    renderHistoryList() {
        const history = this.historyManager.history;

        if (history.length === 0) {
            this.historyList.innerHTML = `
                <div class="apex-script-empty">
                    No scripts yet.<br>Execute some Apex to see history here.
                </div>
            `;
            return;
        }

        this.historyList.innerHTML = history.map(item => `
            <div class="apex-script-item" data-id="${item.id}">
                <div class="apex-script-preview">${this.escapeHtml(this.getPreview(item.code))}</div>
                <div class="apex-script-meta">
                    <span>${this.historyManager.formatRelativeTime(item.timestamp)}</span>
                    <div class="apex-script-actions">
                        <button class="apex-script-action load" title="Load script">&#8629;</button>
                        <button class="apex-script-action favorite" title="Add to favorites">&#9733;</button>
                        <button class="apex-script-action delete" title="Delete">&times;</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderFavoritesList() {
        const favorites = this.historyManager.favorites;

        if (favorites.length === 0) {
            this.favoritesList.innerHTML = `
                <div class="apex-script-empty">
                    No favorites yet.<br>Click &#9733; on a script to save it.
                </div>
            `;
            return;
        }

        this.favoritesList.innerHTML = favorites.map(item => `
            <div class="apex-script-item" data-id="${item.id}">
                <div class="apex-script-label">${this.escapeHtml(item.label)}</div>
                <div class="apex-script-meta">
                    <span>${this.historyManager.formatRelativeTime(item.timestamp)}</span>
                    <div class="apex-script-actions">
                        <button class="apex-script-action load" title="Load script">&#8629;</button>
                        <button class="apex-script-action delete" title="Delete">&times;</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    handleListClick(event, listType) {
        const item = event.target.closest('.apex-script-item');
        if (!item) return;

        const id = item.dataset.id;
        const list = listType === 'history' ? this.historyManager.history : this.historyManager.favorites;
        const scriptData = list.find(s => s.id === id);
        if (!scriptData) return;

        // Check which action button was clicked
        const action = event.target.closest('.apex-script-action');
        if (action) {
            event.stopPropagation();

            if (action.classList.contains('load')) {
                this.loadScript(scriptData.code);
                this.historyModal.close();
            } else if (action.classList.contains('favorite')) {
                this.showFavoriteModal(scriptData.code);
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
            this.loadScript(scriptData.code);
            this.historyModal.close();
        }
    }

    showFavoriteModal(code) {
        const defaultLabel = this.getPreview(code);

        const modal = document.createElement('div');
        modal.className = 'apex-favorite-modal';
        modal.innerHTML = `
            <div class="apex-favorite-dialog">
                <h3>Add to Favorites</h3>
                <input type="text" class="apex-favorite-input" placeholder="Enter a label for this script" value="${this.escapeHtml(defaultLabel)}">
                <div class="apex-favorite-buttons">
                    <button class="button-neutral apex-favorite-cancel">Cancel</button>
                    <button class="button-brand apex-favorite-save">Save</button>
                </div>
            </div>
        `;

        const input = modal.querySelector('.apex-favorite-input');
        const cancelBtn = modal.querySelector('.apex-favorite-cancel');
        const saveBtn = modal.querySelector('.apex-favorite-save');

        const close = () => modal.remove();

        cancelBtn.addEventListener('click', close);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close();
        });

        saveBtn.addEventListener('click', () => {
            const label = input.value.trim();
            if (label) {
                this.addToFavorites(code, label);
                close();
            }
        });

        input.addEventListener('keydown', (e) => {
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

    setOutput(text) {
        this.fullOutput = text;
        this.applyFilter();
    }

    applyFilter() {
        const filter = this.searchInput.value.trim().toLowerCase();
        if (!filter) {
            this.outputEditor.setValue(this.fullOutput);
            return;
        }

        const lines = this.fullOutput.split('\n');
        const filtered = lines.filter(line => line.toLowerCase().includes(filter));
        const result = filtered.length > 0
            ? filtered.join('\n')
            : `// No lines match "${this.searchInput.value}"`;
        this.outputEditor.setValue(result);
    }

    clearFilter() {
        this.searchInput.value = '';
        this.outputEditor.setValue(this.fullOutput);
    }

    // ============================================================
    // Utility Methods
    // ============================================================

    getPreview(code) {
        // Get first non-empty, non-comment line
        const lines = code.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('//')) {
                return trimmed.length > 50 ? trimmed.substring(0, 50) + '...' : trimmed;
            }
        }
        // Fallback to first line
        const firstLine = lines[0]?.trim() || 'Empty script';
        return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============================================================
    // UI Helpers
    // ============================================================

    setEditorMarkers(result) {
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
                endColumn: result.column ? result.column + 10 : model.getLineMaxColumn(result.line)
            });
        } else if (!result.success && result.exceptionMessage && result.line) {
            markers.push({
                severity: monaco.MarkerSeverity.Error,
                message: result.exceptionMessage,
                startLineNumber: result.line,
                startColumn: 1,
                endLineNumber: result.line,
                endColumn: model.getLineMaxColumn(result.line)
            });
        }

        if (markers.length > 0) {
            monaco.editor.setModelMarkers(model, 'apex', markers);
        }
    }

    formatOutput(result, debugLog) {
        const lines = [];

        if (!result.compiled) {
            lines.push('=== COMPILATION ERROR ===');
            lines.push(`Line ${result.line}, Column ${result.column || 1}`);
            lines.push(result.compileProblem);
            lines.push('');
        } else if (!result.success) {
            lines.push('=== RUNTIME EXCEPTION ===');
            if (result.line) {
                lines.push(`Line ${result.line}`);
            }
            lines.push(result.exceptionMessage || 'Unknown exception');
            if (result.exceptionStackTrace) {
                lines.push('');
                lines.push('Stack Trace:');
                lines.push(result.exceptionStackTrace);
            }
            lines.push('');
        } else {
            lines.push('=== EXECUTION SUCCESSFUL ===');
            lines.push('');
        }

        if (debugLog) {
            lines.push('=== DEBUG LOG ===');
            lines.push(debugLog);
        } else {
            lines.push('(No debug log available)');
        }

        return lines.join('\n');
    }

    updateStatus(text, type = '') {
        updateStatusBadge(this.statusSpan, text, type);
    }

    // ============================================================
    // Main Execution Handler
    // ============================================================

    async executeApex() {
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
            const result = await executeAnonymousApex(apexCode, (status) => {
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

            this.setOutput(this.formatOutput(result.execution, result.debugLog));

            // Save to history after execution
            await this.saveToHistory(apexCode);

        } catch (error) {
            this.updateStatus('Error', 'error');
            this.setOutput(`Error: ${error.message}`);
            console.error('Apex execution error:', error);
        } finally {
            this.executeBtn.disabled = false;
        }
    }
}

customElements.define('apex-tab', ApexTab);
