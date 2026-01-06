// Apex Tab - Anonymous Apex Execution with History & Favorites
import template from './apex.html?raw';
import './apex.css';
import { monaco } from '../monaco-editor/monaco-editor.js';
import { isAuthenticated } from '../../lib/utils.js';
import { executeAnonymousApex } from '../../lib/salesforce.js';

const MAX_HISTORY = 30;

class ApexTab extends HTMLElement {
    // DOM references
    codeEditor = null;
    outputEditor = null;
    executeBtn = null;
    statusSpan = null;

    // Dropdown DOM references
    dropdown = null;
    dropdownTrigger = null;
    historyList = null;
    favoritesList = null;
    dropdownTabs = [];

    // In-memory cache
    history = [];
    favorites = [];

    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.initEditors();
        this.attachEventListeners();
        this.loadStoredData();
    }

    initElements() {
        this.executeBtn = this.querySelector('.apex-execute-btn');
        this.statusSpan = this.querySelector('.apex-status');

        // Dropdown elements
        this.dropdown = this.querySelector('.apex-header-dropdown');
        this.dropdownTrigger = this.querySelector('.apex-dropdown-trigger');
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

        this.outputEditor.setValue('// Output will appear here after execution');
    }

    attachEventListeners() {
        this.executeBtn.addEventListener('click', () => this.executeApex());
        this.codeEditor.addEventListener('execute', () => this.executeApex());

        // Dropdown trigger
        this.dropdownTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });

        // Dropdown tab switching
        this.dropdownTabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // List click delegation
        this.historyList.addEventListener('click', (e) => this.handleListClick(e, 'history'));
        this.favoritesList.addEventListener('click', (e) => this.handleListClick(e, 'favorites'));

        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            if (!this.dropdown.contains(e.target)) {
                this.closeDropdown();
            }
        });
    }

    // ============================================================
    // Storage Operations
    // ============================================================

    async loadStoredData() {
        const data = await chrome.storage.local.get(['apexHistory', 'apexFavorites']);
        this.history = data.apexHistory || [];
        this.favorites = data.apexFavorites || [];
        this.renderLists();
    }

    async saveHistory() {
        await chrome.storage.local.set({ apexHistory: this.history });
    }

    async saveFavorites() {
        await chrome.storage.local.set({ apexFavorites: this.favorites });
    }

    // ============================================================
    // History & Favorites Logic
    // ============================================================

    async saveToHistory(code) {
        const trimmedCode = code.trim();
        if (!trimmedCode) return;

        // If already in favorites, just update the timestamp
        const favoriteIndex = this.favorites.findIndex(item => item.code.trim() === trimmedCode);
        if (favoriteIndex !== -1) {
            this.favorites[favoriteIndex].timestamp = Date.now();
            await this.saveFavorites();
            this.renderLists();
            return;
        }

        // Remove duplicate if exists
        const existingIndex = this.history.findIndex(item => item.code.trim() === trimmedCode);
        if (existingIndex !== -1) {
            this.history.splice(existingIndex, 1);
        }

        // Add to beginning
        this.history.unshift({
            id: Date.now().toString(),
            code: trimmedCode,
            timestamp: Date.now()
        });

        // Trim to max size
        if (this.history.length > MAX_HISTORY) {
            this.history = this.history.slice(0, MAX_HISTORY);
        }

        await this.saveHistory();
        this.renderLists();
    }

    async addToFavorites(code, label) {
        const trimmedCode = code.trim();
        if (!trimmedCode || !label.trim()) return;

        this.favorites.unshift({
            id: Date.now().toString(),
            code: trimmedCode,
            label: label.trim(),
            timestamp: Date.now()
        });

        await this.saveFavorites();
        this.renderLists();
    }

    async removeFromHistory(id) {
        this.history = this.history.filter(item => item.id !== id);
        await this.saveHistory();
        this.renderLists();
    }

    async removeFromFavorites(id) {
        this.favorites = this.favorites.filter(item => item.id !== id);
        await this.saveFavorites();
        this.renderLists();
    }

    loadScript(code) {
        this.codeEditor.setValue(code);
    }

    // ============================================================
    // Dropdown UI
    // ============================================================

    toggleDropdown() {
        this.dropdown.classList.toggle('open');
    }

    closeDropdown() {
        this.dropdown.classList.remove('open');
    }

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
        if (this.history.length === 0) {
            this.historyList.innerHTML = `
                <div class="apex-script-empty">
                    No scripts yet.<br>Execute some Apex to see history here.
                </div>
            `;
            return;
        }

        this.historyList.innerHTML = this.history.map(item => `
            <div class="apex-script-item" data-id="${item.id}">
                <div class="apex-script-preview">${this.escapeHtml(this.getPreview(item.code))}</div>
                <div class="apex-script-meta">
                    <span>${this.formatRelativeTime(item.timestamp)}</span>
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
        if (this.favorites.length === 0) {
            this.favoritesList.innerHTML = `
                <div class="apex-script-empty">
                    No favorites yet.<br>Click &#9733; on a script to save it.
                </div>
            `;
            return;
        }

        this.favoritesList.innerHTML = this.favorites.map(item => `
            <div class="apex-script-item" data-id="${item.id}">
                <div class="apex-script-label">${this.escapeHtml(item.label)}</div>
                <div class="apex-script-meta">
                    <span>${this.formatRelativeTime(item.timestamp)}</span>
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
        const list = listType === 'history' ? this.history : this.favorites;
        const scriptData = list.find(s => s.id === id);
        if (!scriptData) return;

        // Check which action button was clicked
        const action = event.target.closest('.apex-script-action');
        if (action) {
            event.stopPropagation();

            if (action.classList.contains('load')) {
                this.loadScript(scriptData.code);
                this.closeDropdown();
            } else if (action.classList.contains('favorite')) {
                this.showFavoriteModal(scriptData.code);
                this.closeDropdown();
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
            this.closeDropdown();
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

    formatRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return new Date(timestamp).toLocaleDateString();
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

    updateStatus(text, type) {
        this.statusSpan.textContent = text;
        this.statusSpan.className = `status-badge${type ? ` status-${type}` : ''}`;
    }

    // ============================================================
    // Main Execution Handler
    // ============================================================

    async executeApex() {
        const apexCode = this.codeEditor.getValue().trim();

        if (!apexCode) {
            this.outputEditor.setValue('// Please enter Apex code to execute');
            return;
        }

        if (!isAuthenticated()) {
            alert('Not authenticated. Please authorize via the extension popup first.');
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
                this.outputEditor.setValue(`// ${status}`);
            });

            this.setEditorMarkers(result.execution);

            if (!result.execution.compiled) {
                this.updateStatus('Compile Error', 'error');
            } else if (!result.execution.success) {
                this.updateStatus('Runtime Error', 'error');
            } else {
                this.updateStatus('Success', 'success');
            }

            this.outputEditor.setValue(this.formatOutput(result.execution, result.debugLog));

            // Save to history after execution
            await this.saveToHistory(apexCode);

        } catch (error) {
            this.updateStatus('Error', 'error');
            this.outputEditor.setValue(`Error: ${error.message}`);
            console.error('Apex execution error:', error);
        } finally {
            this.executeBtn.disabled = false;
        }
    }
}

customElements.define('apex-tab', ApexTab);
