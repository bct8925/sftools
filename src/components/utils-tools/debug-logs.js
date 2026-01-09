// Debug Logs Tool - Trace flags and log management
import template from './debug-logs.html?raw';
import './utils-tools.css';
import { isAuthenticated } from '../../lib/utils.js';
import { getCurrentUserId, searchUsers, enableTraceFlagForUser, deleteAllDebugLogs, deleteAllTraceFlags } from '../../lib/salesforce.js';

class DebugLogs extends HTMLElement {
    // Trace flag elements
    enableForMeBtn = null;
    userSearchInput = null;
    userResults = null;
    traceStatus = null;

    // Cleanup elements
    deleteFlagsBtn = null;
    deleteLogsBtn = null;
    deleteStatus = null;

    searchTimeout = null;

    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.attachEventListeners();
    }

    initElements() {
        // Trace flag
        this.enableForMeBtn = this.querySelector('.enable-for-me-btn');
        this.userSearchInput = this.querySelector('.user-search');
        this.userResults = this.querySelector('.user-results');
        this.traceStatus = this.querySelector('.trace-status');

        // Cleanup
        this.deleteFlagsBtn = this.querySelector('.delete-flags-btn');
        this.deleteLogsBtn = this.querySelector('.delete-logs-btn');
        this.deleteStatus = this.querySelector('.delete-status');
    }

    attachEventListeners() {
        // Trace flag
        this.enableForMeBtn.addEventListener('click', () => this.handleEnableForMe());
        this.userSearchInput.addEventListener('input', () => this.handleSearchInput());
        this.userResults.addEventListener('click', (e) => this.handleUserSelect(e));

        // Cleanup
        this.deleteFlagsBtn.addEventListener('click', () => this.handleDeleteFlags());
        this.deleteLogsBtn.addEventListener('click', () => this.handleDeleteLogs());
    }

    // ============================================================
    // Trace Flag Methods
    // ============================================================

    async handleEnableForMe() {
        if (!isAuthenticated()) {
            alert('Not authenticated. Please authorize via the connection selector.');
            return;
        }

        this.setStatus(this.traceStatus, 'loading', 'Enabling trace flag...');
        this.enableForMeBtn.disabled = true;

        try {
            const userId = await getCurrentUserId();
            await enableTraceFlagForUser(userId);
            this.setStatus(this.traceStatus, 'success', 'Trace flag enabled for 30 minutes');
        } catch (error) {
            this.setStatus(this.traceStatus, 'error', error.message);
        } finally {
            this.enableForMeBtn.disabled = false;
        }
    }

    handleSearchInput() {
        clearTimeout(this.searchTimeout);
        const searchTerm = this.userSearchInput.value.trim();

        if (searchTerm.length < 2) {
            this.userResults.classList.add('hidden');
            return;
        }

        this.searchTimeout = setTimeout(() => this.doUserSearch(searchTerm), 300);
    }

    async doUserSearch(searchTerm) {
        if (!isAuthenticated()) return;

        try {
            const users = await searchUsers(searchTerm);
            this.renderUserResults(users);
        } catch (error) {
            console.error('User search error:', error);
        }
    }

    renderUserResults(users) {
        if (users.length === 0) {
            this.userResults.innerHTML = '<div class="tool-no-results">No users found</div>';
        } else {
            this.userResults.innerHTML = users.map(u => `
                <div class="tool-result-item" data-id="${u.Id}">
                    <div>
                        <span class="tool-result-name">${this.escapeHtml(u.Name)}</span>
                        <span class="tool-result-detail">${this.escapeHtml(u.Username)}</span>
                    </div>
                </div>
            `).join('');
        }
        this.userResults.classList.remove('hidden');
    }

    async handleUserSelect(e) {
        const item = e.target.closest('.tool-result-item');
        if (!item) return;

        const userId = item.dataset.id;
        const userName = item.querySelector('.tool-result-name').textContent;

        this.userResults.classList.add('hidden');
        this.userSearchInput.value = userName;

        this.setStatus(this.traceStatus, 'loading', 'Enabling trace flag...');

        try {
            await enableTraceFlagForUser(userId);
            this.setStatus(this.traceStatus, 'success', 'Trace flag enabled for 30 minutes');
        } catch (error) {
            this.setStatus(this.traceStatus, 'error', error.message);
        }
    }

    // ============================================================
    // Cleanup Methods
    // ============================================================

    async handleDeleteFlags() {
        if (!isAuthenticated()) {
            alert('Not authenticated. Please authorize via the connection selector.');
            return;
        }

        if (!confirm('Delete ALL trace flags? This cannot be undone.')) {
            return;
        }

        this.setStatus(this.deleteStatus, 'loading', 'Deleting trace flags...');
        this.deleteFlagsBtn.disabled = true;

        try {
            const result = await deleteAllTraceFlags();
            const count = result.deletedCount;
            this.setStatus(this.deleteStatus, 'success', `Deleted ${count} trace flag${count !== 1 ? 's' : ''}`);
        } catch (error) {
            this.setStatus(this.deleteStatus, 'error', error.message);
        } finally {
            this.deleteFlagsBtn.disabled = false;
        }
    }

    async handleDeleteLogs() {
        if (!isAuthenticated()) {
            alert('Not authenticated. Please authorize via the connection selector.');
            return;
        }

        if (!confirm('Delete ALL debug logs? This cannot be undone.')) {
            return;
        }

        this.setStatus(this.deleteStatus, 'loading', 'Deleting logs...');
        this.deleteLogsBtn.disabled = true;

        try {
            const result = await deleteAllDebugLogs();
            const count = result.deletedCount;
            this.setStatus(this.deleteStatus, 'success', `Deleted ${count} log${count !== 1 ? 's' : ''}`);
        } catch (error) {
            this.setStatus(this.deleteStatus, 'error', error.message);
        } finally {
            this.deleteLogsBtn.disabled = false;
        }
    }

    // ============================================================
    // Utility Methods
    // ============================================================

    setStatus(statusEl, type, message) {
        statusEl.classList.remove('hidden');
        const indicator = statusEl.querySelector('.tool-status-indicator');
        const text = statusEl.querySelector('.tool-status-text');
        indicator.className = `tool-status-indicator status-${type}`;
        text.textContent = message;
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

customElements.define('debug-logs', DebugLogs);
