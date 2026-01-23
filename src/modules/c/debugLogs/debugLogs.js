// Debug Logs Tool - LWC version of trace flags and log management
import { LightningElement, track } from 'lwc';
import { isAuthenticated } from '../../../lib/utils.js';
import {
    getCurrentUserId,
    searchUsers,
    enableTraceFlagForUser,
    deleteAllDebugLogs,
    deleteAllTraceFlags
} from '../../../lib/salesforce.js';

export default class DebugLogs extends LightningElement {
    // Trace flag state
    @track traceStatus = { visible: false, type: '', message: '' };
    @track userResults = [];
    @track showUserResults = false;
    @track enableForMeDisabled = false;

    // Cleanup state
    @track deleteStatus = { visible: false, type: '', message: '' };
    @track deleteFlagsDisabled = false;
    @track deleteLogsDisabled = false;

    _searchTimeout = null;

    disconnectedCallback() {
        if (this._searchTimeout) {
            clearTimeout(this._searchTimeout);
        }
    }

    // ============================================================
    // Trace Flag Methods
    // ============================================================

    async handleEnableForMe() {
        if (!isAuthenticated()) {
            alert('Not authenticated. Please authorize via the connection selector.');
            return;
        }

        this.setTraceStatus('loading', 'Enabling trace flag...');
        this.enableForMeDisabled = true;

        try {
            const userId = await getCurrentUserId();
            await enableTraceFlagForUser(userId);
            this.setTraceStatus('success', 'Trace flag enabled for 30 minutes');
        } catch (error) {
            this.setTraceStatus('error', error.message);
        } finally {
            this.enableForMeDisabled = false;
        }
    }

    handleSearchInput(event) {
        clearTimeout(this._searchTimeout);
        const searchTerm = event.target.value.trim();

        if (searchTerm.length < 2) {
            this.showUserResults = false;
            return;
        }

        this._searchTimeout = setTimeout(() => this.doUserSearch(searchTerm), 300);
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
            this.userResults = [];
        } else {
            this.userResults = users.map((user) => ({
                id: user.Id,
                name: user.Name,
                username: user.Username
            }));
        }
        this.showUserResults = true;
    }

    async handleUserSelect(event) {
        const item = event.currentTarget;
        const userId = item.dataset.id;
        const userName = item.dataset.name;

        this.showUserResults = false;

        const input = this.template.querySelector('.user-search');
        if (input) {
            input.value = userName;
        }

        this.setTraceStatus('loading', 'Enabling trace flag...');

        try {
            await enableTraceFlagForUser(userId);
            this.setTraceStatus('success', 'Trace flag enabled for 30 minutes');
        } catch (error) {
            this.setTraceStatus('error', error.message);
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

        this.setDeleteStatus('loading', 'Deleting trace flags...');
        this.deleteFlagsDisabled = true;

        try {
            const result = await deleteAllTraceFlags();
            const count = result.deletedCount;
            this.setDeleteStatus('success', `Deleted ${count} trace flag${count !== 1 ? 's' : ''}`);
        } catch (error) {
            this.setDeleteStatus('error', error.message);
        } finally {
            this.deleteFlagsDisabled = false;
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

        this.setDeleteStatus('loading', 'Deleting logs...');
        this.deleteLogsDisabled = true;

        try {
            const result = await deleteAllDebugLogs();
            const count = result.deletedCount;
            this.setDeleteStatus('success', `Deleted ${count} log${count !== 1 ? 's' : ''}`);
        } catch (error) {
            this.setDeleteStatus('error', error.message);
        } finally {
            this.deleteLogsDisabled = false;
        }
    }

    // ============================================================
    // Status Methods
    // ============================================================

    setTraceStatus(type, message) {
        this.traceStatus = { visible: true, type, message };
    }

    setDeleteStatus(type, message) {
        this.deleteStatus = { visible: true, type, message };
    }

    get traceStatusClass() {
        return `tool-status ${this.traceStatus.visible ? '' : 'hidden'}`;
    }

    get traceIndicatorClass() {
        return `status-indicator status-${this.traceStatus.type}`;
    }

    get deleteStatusClass() {
        return `tool-status ${this.deleteStatus.visible ? '' : 'hidden'}`;
    }

    get deleteIndicatorClass() {
        return `status-indicator status-${this.deleteStatus.type}`;
    }

    get userResultsClass() {
        return `tool-results user-results ${this.showUserResults ? '' : 'hidden'}`;
    }

    get hasNoUsers() {
        return this.showUserResults && this.userResults.length === 0;
    }

    get hasUserResults() {
        return this.userResults.length > 0;
    }
}
