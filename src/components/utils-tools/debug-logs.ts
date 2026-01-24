// Debug Logs Tool - Trace flags and log management
import { isAuthenticated } from '../../lib/utils.js';
import {
    getCurrentUserId,
    searchUsers,
    enableTraceFlagForUser,
    deleteAllDebugLogs,
    deleteAllTraceFlags,
} from '../../lib/salesforce.js';
import { escapeHtml } from '../../lib/text-utils.js';
import type { SObject } from '../../types/salesforce';
import template from './debug-logs.html?raw';
import './utils-tools.css';

interface User extends SObject {
    Name: string;
    Username: string;
}

interface DeleteResult {
    deletedCount: number;
}

class DebugLogs extends HTMLElement {
    // Trace flag elements
    private enableForMeBtn!: HTMLButtonElement;
    private userSearchInput!: HTMLInputElement;
    private userResults!: HTMLElement;
    private traceStatus!: HTMLElement;

    // Cleanup elements
    private deleteFlagsBtn!: HTMLButtonElement;
    private deleteLogsBtn!: HTMLButtonElement;
    private deleteStatus!: HTMLElement;

    private searchTimeout: number | null = null;

    connectedCallback(): void {
        this.innerHTML = template;
        this.initElements();
        this.attachEventListeners();
    }

    disconnectedCallback(): void {
        if (this.searchTimeout !== null) {
            clearTimeout(this.searchTimeout);
        }
    }

    private initElements(): void {
        // Trace flag
        this.enableForMeBtn = this.querySelector<HTMLButtonElement>('.enable-for-me-btn')!;
        this.userSearchInput = this.querySelector<HTMLInputElement>('.user-search')!;
        this.userResults = this.querySelector<HTMLElement>('.user-results')!;
        this.traceStatus = this.querySelector<HTMLElement>('.trace-status')!;

        // Cleanup
        this.deleteFlagsBtn = this.querySelector<HTMLButtonElement>('.delete-flags-btn')!;
        this.deleteLogsBtn = this.querySelector<HTMLButtonElement>('.delete-logs-btn')!;
        this.deleteStatus = this.querySelector<HTMLElement>('.delete-status')!;
    }

    private attachEventListeners(): void {
        // Trace flag
        this.enableForMeBtn.addEventListener('click', this.handleEnableForMe);
        this.userSearchInput.addEventListener('input', this.handleSearchInput);
        this.userResults.addEventListener('click', this.handleUserSelect);

        // Cleanup
        this.deleteFlagsBtn.addEventListener('click', this.handleDeleteFlags);
        this.deleteLogsBtn.addEventListener('click', this.handleDeleteLogs);
    }

    // ============================================================
    // Trace Flag Methods
    // ============================================================

    private handleEnableForMe = async (): Promise<void> => {
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
            this.setStatus(this.traceStatus, 'error', (error as Error).message);
        } finally {
            this.enableForMeBtn.disabled = false;
        }
    };

    private handleSearchInput = (): void => {
        if (this.searchTimeout !== null) {
            clearTimeout(this.searchTimeout);
        }
        const searchTerm = this.userSearchInput.value.trim();

        if (searchTerm.length < 2) {
            this.userResults.classList.add('hidden');
            return;
        }

        this.searchTimeout = window.setTimeout(() => this.doUserSearch(searchTerm), 300);
    };

    private async doUserSearch(searchTerm: string): Promise<void> {
        if (!isAuthenticated()) return;

        try {
            const users = await searchUsers(searchTerm);
            this.renderUserResults(users as User[]);
        } catch (error) {
            console.error('User search error:', error);
        }
    }

    private renderUserResults(users: User[]): void {
        if (users.length === 0) {
            this.userResults.innerHTML = '<div class="tool-no-results">No users found</div>';
        } else {
            this.userResults.innerHTML = users
                .map(
                    u => `
                <div class="tool-result-item" data-id="${u.Id}">
                    <div>
                        <span class="tool-result-name">${escapeHtml(u.Name)}</span>
                        <span class="tool-result-detail">${escapeHtml(u.Username)}</span>
                    </div>
                </div>
            `
                )
                .join('');
        }
        this.userResults.classList.remove('hidden');
    }

    private handleUserSelect = async (e: Event): Promise<void> => {
        const item = (e.target as HTMLElement).closest('.tool-result-item') as HTMLElement | null;
        if (!item) return;

        const userId = item.dataset.id;
        if (!userId) return;

        const userName = item.querySelector('.tool-result-name')?.textContent || '';

        this.userResults.classList.add('hidden');
        this.userSearchInput.value = userName;

        this.setStatus(this.traceStatus, 'loading', 'Enabling trace flag...');

        try {
            await enableTraceFlagForUser(userId);
            this.setStatus(this.traceStatus, 'success', 'Trace flag enabled for 30 minutes');
        } catch (error) {
            this.setStatus(this.traceStatus, 'error', (error as Error).message);
        }
    };

    // ============================================================
    // Cleanup Methods
    // ============================================================

    private handleDeleteFlags = async (): Promise<void> => {
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
            const result = (await deleteAllTraceFlags()) as DeleteResult;
            const count = result.deletedCount;
            this.setStatus(
                this.deleteStatus,
                'success',
                `Deleted ${count} trace flag${count !== 1 ? 's' : ''}`
            );
        } catch (error) {
            this.setStatus(this.deleteStatus, 'error', (error as Error).message);
        } finally {
            this.deleteFlagsBtn.disabled = false;
        }
    };

    private handleDeleteLogs = async (): Promise<void> => {
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
            const result = (await deleteAllDebugLogs()) as DeleteResult;
            const count = result.deletedCount;
            this.setStatus(
                this.deleteStatus,
                'success',
                `Deleted ${count} log${count !== 1 ? 's' : ''}`
            );
        } catch (error) {
            this.setStatus(this.deleteStatus, 'error', (error as Error).message);
        } finally {
            this.deleteLogsBtn.disabled = false;
        }
    };

    // ============================================================
    // Utility Methods
    // ============================================================

    private setStatus(statusEl: HTMLElement, type: string, message: string): void {
        statusEl.classList.remove('hidden');
        const indicator = statusEl.querySelector('.status-indicator') as HTMLElement;
        const text = statusEl.querySelector('.tool-status-text') as HTMLElement;
        indicator.className = `status-indicator status-${type}`;
        text.textContent = message;
    }
}

customElements.define('debug-logs', DebugLogs);
