import { useState, useCallback, useEffect } from 'react';
import { useConnection } from '../../contexts/ConnectionContext.js';
import {
  searchFlows,
  getFlowVersions,
  deleteInactiveFlowVersions,
} from '../../lib/salesforce.js';
import type { SObject } from '../../types/salesforce';
import { SearchBox, type SearchBoxRenderData } from './SearchBox.js';
import styles from './FlowCleanup.module.css';

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

type StatusType = 'loading' | 'success' | 'error';

/**
 * Flow Version Cleanup Tool.
 * Searches flows and deletes inactive flow versions to reduce metadata size.
 */
export function FlowCleanup() {
  const { activeConnection } = useConnection();

  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [selectedFlowName, setSelectedFlowName] = useState<string | null>(null);
  const [versions, setVersions] = useState<FlowVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [status, setStatus] = useState<{
    type: StatusType;
    message: string;
  } | null>(null);

  // Clear state on connection change
  useEffect(() => {
    setSelectedFlowId(null);
    setSelectedFlowName(null);
    setVersions([]);
    setShowVersions(false);
    setStatus(null);
  }, [activeConnection?.id]);

  const handleFlowSelect = useCallback(async (flow: unknown) => {
    const flowObj = flow as Flow;
    setSelectedFlowId(flowObj.Id);
    setSelectedFlowName(flowObj.DeveloperName);

    setStatus({ type: 'loading', message: 'Loading versions...' });

    try {
      const flowVersions = (await getFlowVersions(flowObj.Id)) as FlowVersion[];
      setVersions(flowVersions);
      setShowVersions(true);
      setStatus(null);
    } catch (error) {
      setStatus({ type: 'error', message: (error as Error).message });
      setShowVersions(false);
    }
  }, []);

  const handleDeleteVersions = useCallback(async () => {
    const inactiveVersions = versions.filter((v) => v.Status !== 'Active');
    if (inactiveVersions.length === 0) return;

    if (!confirm(`Delete ${inactiveVersions.length} inactive flow version(s)?`)) return;

    setStatus({ type: 'loading', message: 'Deleting versions...' });

    try {
      const versionIds = inactiveVersions.map((v) => v.Id);
      const result = (await deleteInactiveFlowVersions(versionIds)) as DeleteResult;
      const count = result.deletedCount;
      setStatus({
        type: 'success',
        message: `Deleted ${count} version${count !== 1 ? 's' : ''}`,
      });
      setShowVersions(false);
    } catch (error) {
      setStatus({ type: 'error', message: (error as Error).message });
    }
  }, [versions]);

  const renderFlowSearch = useCallback((flow: unknown): SearchBoxRenderData => {
    const flowObj = flow as Flow;
    return {
      id: flowObj.Id,
      name: flowObj.DeveloperName,
    };
  }, []);

  const activeVersion = versions.find((v) => v.Status === 'Active');
  const inactiveVersions = versions.filter((v) => v.Status !== 'Active');
  const inactiveCount = inactiveVersions.length;

  return (
    <div className="card" data-testid="flow-cleanup">
      <div className="card-header">
        <div className="card-header-icon" style={{ backgroundColor: '#ff9a3c' }}>
          F
        </div>
        <h2>Flow Version Cleanup</h2>
      </div>
      <div className="card-body">
        <p className="tool-description">Delete inactive flow versions to reduce metadata size.</p>
        <SearchBox
          searchFn={searchFlows}
          renderFn={renderFlowSearch}
          label="FLOW SEARCH"
          placeholder="Search flows by name..."
          onSelect={handleFlowSelect}
          inputTestId="flow-cleanup-search"
          dropdownTestId="flow-cleanup-dropdown"
        />
        {showVersions && (
          <div className={styles.versions} data-testid="flow-cleanup-versions">
            <div className="tool-summary" data-testid="flow-cleanup-info">
              <strong>{selectedFlowName}</strong>
              <br />
              Total versions: {versions.length}
              <br />
              Active version: {activeVersion?.VersionNumber || 'None'}
              <br />
              Inactive versions: {inactiveCount}
            </div>
            <button
              className="button-brand"
              disabled={inactiveCount === 0}
              onClick={handleDeleteVersions}
              data-testid="flow-cleanup-delete-btn"
            >
              {inactiveCount === 0
                ? 'No Inactive Versions'
                : `Delete ${inactiveCount} Inactive Version${inactiveCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
        {status && (
          <div className="tool-status" data-testid="flow-cleanup-status">
            <span className={`status-indicator status-${status.type}`}></span>
            <span className="tool-status-text">{status.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
