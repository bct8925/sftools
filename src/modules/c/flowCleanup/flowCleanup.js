// Flow Version Cleanup Tool - LWC version
import { LightningElement, track } from 'lwc';
import { searchFlows, getFlowVersions, deleteInactiveFlowVersions } from '../../../lib/salesforce.js';

export default class FlowCleanup extends LightningElement {
    @track status = { visible: false, type: '', message: '' };
    @track showVersionsSection = false;
    @track selectedFlowName = '';
    @track totalVersions = 0;
    @track activeVersionNumber = 'None';
    @track inactiveCount = 0;
    @track deleteButtonText = 'Delete Inactive Versions';
    @track deleteDisabled = true;

    _selectedFlowId = null;
    _versions = [];

    renderedCallback() {
        // Configure search box after render
        const searchBox = this.template.querySelector('c-search-box');
        if (searchBox && !searchBox._configured) {
            searchBox.setSearchFn(searchFlows);
            searchBox.setRenderFn((flow) => ({
                id: flow.Id,
                name: flow.DeveloperName
            }));
            searchBox._configured = true;
        }
    }

    async handleFlowSelect(event) {
        const flow = event.detail;
        this._selectedFlowId = flow.Id;
        this.selectedFlowName = flow.DeveloperName;

        this.setStatus('loading', 'Loading versions...');

        try {
            this._versions = await getFlowVersions(this._selectedFlowId);
            this.renderVersionInfo();
            this.status = { visible: false, type: '', message: '' };
        } catch (error) {
            this.setStatus('error', error.message);
        }
    }

    renderVersionInfo() {
        const activeVersion = this._versions.find((v) => v.Status === 'Active');
        const inactiveVersions = this._versions.filter((v) => v.Status !== 'Active');

        this.totalVersions = this._versions.length;
        this.activeVersionNumber = activeVersion?.VersionNumber || 'None';
        this.inactiveCount = inactiveVersions.length;

        this.deleteDisabled = this.inactiveCount === 0;
        this.deleteButtonText =
            this.inactiveCount === 0
                ? 'No Inactive Versions'
                : `Delete ${this.inactiveCount} Inactive Version${this.inactiveCount !== 1 ? 's' : ''}`;

        this.showVersionsSection = true;
    }

    async handleDeleteVersions() {
        const inactiveVersions = this._versions.filter((v) => v.Status !== 'Active');
        if (inactiveVersions.length === 0) return;

        if (!confirm(`Delete ${inactiveVersions.length} inactive flow version(s)?`)) return;

        this.setStatus('loading', 'Deleting versions...');
        this.deleteDisabled = true;

        try {
            const versionIds = inactiveVersions.map((v) => v.Id);
            const result = await deleteInactiveFlowVersions(versionIds);
            const count = result.deletedCount;
            this.setStatus('success', `Deleted ${count} version${count !== 1 ? 's' : ''}`);
            this.showVersionsSection = false;
        } catch (error) {
            this.setStatus('error', error.message);
            this.deleteDisabled = false;
        }
    }

    setStatus(type, message) {
        this.status = { visible: true, type, message };
    }

    get statusClass() {
        return `tool-status ${this.status.visible ? '' : 'hidden'}`;
    }

    get statusIndicatorClass() {
        return `status-indicator status-${this.status.type}`;
    }

    get versionsClass() {
        return `flow-versions ${this.showVersionsSection ? '' : 'hidden'}`;
    }
}
