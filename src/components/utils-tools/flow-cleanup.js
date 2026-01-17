// Flow Version Cleanup Tool
import template from './flow-cleanup.html?raw';
import './utils-tools.css';
import './search-box.js';
import { searchFlows, getFlowVersions, deleteInactiveFlowVersions } from '../../lib/salesforce.js';
import { escapeHtml } from '../../lib/text-utils.js';

class FlowCleanup extends HTMLElement {
    flowSearch = null;
    flowVersionsSection = null;
    flowInfo = null;
    deleteVersionsBtn = null;
    status = null;

    selectedFlowId = null;
    selectedFlowName = null;
    versions = [];

    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.attachEventListeners();
    }

    initElements() {
        this.flowSearch = this.querySelector('.flow-search');
        this.flowVersionsSection = this.querySelector('.flow-versions');
        this.flowInfo = this.querySelector('.flow-info');
        this.deleteVersionsBtn = this.querySelector('.delete-versions-btn');
        this.status = this.querySelector('.tool-status');

        // Configure search box
        this.flowSearch.setSearchFn(searchFlows);
        this.flowSearch.setRenderFn(flow => ({
            id: flow.Id,
            name: flow.DeveloperName
        }));
    }

    attachEventListeners() {
        this.flowSearch.addEventListener('select', (e) => this.handleFlowSelect(e.detail));
        this.deleteVersionsBtn.addEventListener('click', () => this.handleDeleteVersions());
    }

    async handleFlowSelect(flow) {
        this.selectedFlowId = flow.Id;
        this.selectedFlowName = flow.DeveloperName;

        this.setStatus('loading', 'Loading versions...');

        try {
            this.versions = await getFlowVersions(this.selectedFlowId);
            this.renderVersionInfo();
            this.status.classList.add('hidden');
        } catch (error) {
            this.setStatus('error', error.message);
        }
    }

    renderVersionInfo() {
        const activeVersion = this.versions.find(v => v.Status === 'Active');
        const inactiveVersions = this.versions.filter(v => v.Status !== 'Active');
        const inactiveCount = inactiveVersions.length;

        this.flowInfo.innerHTML = `
            <strong>${escapeHtml(this.selectedFlowName)}</strong><br>
            Total versions: ${this.versions.length}<br>
            Active version: ${activeVersion?.VersionNumber || 'None'}<br>
            Inactive versions: ${inactiveCount}
        `;

        this.deleteVersionsBtn.disabled = inactiveCount === 0;
        this.deleteVersionsBtn.textContent = inactiveCount === 0
            ? 'No Inactive Versions'
            : `Delete ${inactiveCount} Inactive Version${inactiveCount !== 1 ? 's' : ''}`;

        this.flowVersionsSection.classList.remove('hidden');
    }

    async handleDeleteVersions() {
        const inactiveVersions = this.versions.filter(v => v.Status !== 'Active');
        if (inactiveVersions.length === 0) return;

        if (!confirm(`Delete ${inactiveVersions.length} inactive flow version(s)?`)) return;

        this.setStatus('loading', 'Deleting versions...');
        this.deleteVersionsBtn.disabled = true;

        try {
            const versionIds = inactiveVersions.map(v => v.Id);
            const result = await deleteInactiveFlowVersions(versionIds);
            const count = result.deletedCount;
            this.setStatus('success', `Deleted ${count} version${count !== 1 ? 's' : ''}`);
            this.flowVersionsSection.classList.add('hidden');
        } catch (error) {
            this.setStatus('error', error.message);
            this.deleteVersionsBtn.disabled = false;
        }
    }

    setStatus(type, message) {
        this.status.classList.remove('hidden');
        const indicator = this.status.querySelector('.status-indicator');
        const text = this.status.querySelector('.tool-status-text');
        indicator.className = `status-indicator status-${type}`;
        text.textContent = message;
    }

}

customElements.define('flow-cleanup', FlowCleanup);
