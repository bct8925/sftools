// Flow Version Cleanup Tool
import { searchFlows, getFlowVersions, deleteInactiveFlowVersions } from '../../lib/salesforce.js';
import { escapeHtml } from '../../lib/text-utils.js';
import type { SObject } from '../../types/salesforce';
import './search-box.js';
import template from './flow-cleanup.html?raw';
import './utils-tools.css';

interface Flow extends SObject {
    DeveloperName: string;
}

interface FlowVersion extends SObject {
    Status: string;
    VersionNumber: number;
}

interface DeleteResult {
    deletedCount: number;
}

interface SearchResult {
    id: string;
    name: string;
}

class FlowCleanup extends HTMLElement {
    private flowSearch!: any; // SearchBox component - no type available
    private flowVersionsSection!: HTMLElement;
    private flowInfo!: HTMLElement;
    private deleteVersionsBtn!: HTMLButtonElement;
    private status!: HTMLElement;

    private selectedFlowId: string | null = null;
    private selectedFlowName: string | null = null;
    private versions: FlowVersion[] = [];

    connectedCallback(): void {
        this.innerHTML = template;
        this.initElements();
        this.attachEventListeners();
    }

    private initElements(): void {
        this.flowSearch = this.querySelector('.flow-search');
        this.flowVersionsSection = this.querySelector<HTMLElement>('.flow-versions')!;
        this.flowInfo = this.querySelector<HTMLElement>('.flow-info')!;
        this.deleteVersionsBtn = this.querySelector<HTMLButtonElement>('.delete-versions-btn')!;
        this.status = this.querySelector<HTMLElement>('.tool-status')!;

        // Configure search box
        this.flowSearch.setSearchFn(searchFlows);
        this.flowSearch.setRenderFn(
            (flow: Flow): SearchResult => ({
                id: flow.Id,
                name: flow.DeveloperName,
            })
        );
    }

    private attachEventListeners(): void {
        this.flowSearch.addEventListener('select', (e: CustomEvent<Flow>) =>
            this.handleFlowSelect(e.detail)
        );
        this.deleteVersionsBtn.addEventListener('click', this.handleDeleteVersions);
    }

    private handleFlowSelect = async (flow: Flow): Promise<void> => {
        this.selectedFlowId = flow.Id;
        this.selectedFlowName = flow.DeveloperName;

        this.setStatus('loading', 'Loading versions...');

        try {
            this.versions = (await getFlowVersions(this.selectedFlowId)) as FlowVersion[];
            this.renderVersionInfo();
            this.status.classList.add('hidden');
        } catch (error) {
            this.setStatus('error', (error as Error).message);
        }
    };

    private renderVersionInfo(): void {
        const activeVersion = this.versions.find(v => v.Status === 'Active');
        const inactiveVersions = this.versions.filter(v => v.Status !== 'Active');
        const inactiveCount = inactiveVersions.length;

        this.flowInfo.innerHTML = `
            <strong>${escapeHtml(this.selectedFlowName || '')}</strong><br>
            Total versions: ${this.versions.length}<br>
            Active version: ${activeVersion?.VersionNumber || 'None'}<br>
            Inactive versions: ${inactiveCount}
        `;

        this.deleteVersionsBtn.disabled = inactiveCount === 0;
        this.deleteVersionsBtn.textContent =
            inactiveCount === 0
                ? 'No Inactive Versions'
                : `Delete ${inactiveCount} Inactive Version${inactiveCount !== 1 ? 's' : ''}`;

        this.flowVersionsSection.classList.remove('hidden');
    }

    private handleDeleteVersions = async (): Promise<void> => {
        const inactiveVersions = this.versions.filter(v => v.Status !== 'Active');
        if (inactiveVersions.length === 0) return;

        if (!confirm(`Delete ${inactiveVersions.length} inactive flow version(s)?`)) return;

        this.setStatus('loading', 'Deleting versions...');
        this.deleteVersionsBtn.disabled = true;

        try {
            const versionIds = inactiveVersions.map(v => v.Id);
            const result = (await deleteInactiveFlowVersions(versionIds)) as DeleteResult;
            const count = result.deletedCount;
            this.setStatus('success', `Deleted ${count} version${count !== 1 ? 's' : ''}`);
            this.flowVersionsSection.classList.add('hidden');
        } catch (error) {
            this.setStatus('error', (error as Error).message);
            this.deleteVersionsBtn.disabled = false;
        }
    };

    private setStatus(type: string, message: string): void {
        this.status.classList.remove('hidden');
        const indicator = this.status.querySelector('.status-indicator') as HTMLElement;
        const text = this.status.querySelector('.tool-status-text') as HTMLElement;
        indicator.className = `status-indicator status-${type}`;
        text.textContent = message;
    }
}

customElements.define('flow-cleanup', FlowCleanup);
