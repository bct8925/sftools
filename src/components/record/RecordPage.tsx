import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FieldDescribe, SObject, SalesforceConnection } from '../../types/salesforce';
import {
  getObjectDescribe,
  getRecordWithRelationships,
  updateRecord,
} from '../../lib/salesforce.js';
import { setActiveConnection } from '../../lib/auth.js';
import { sortFields, filterFields, getChangedFields } from '../../lib/record-utils.js';
import { FieldRow } from './FieldRow';
import { RichTextModal } from './RichTextModal';
import { StatusBadge, type StatusType } from '../status-badge/StatusBadge';
import styles from './RecordPage.module.css';

interface StatusState {
  text: string;
  type: StatusType;
}

/**
 * Record Viewer page - displays and edits a single Salesforce record.
 * Parses URL params for recordId, objectType, and connectionId.
 */
export function RecordPage() {
  // URL parameters
  const [objectType, setObjectType] = useState<string | null>(null);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [instanceUrl, setInstanceUrl] = useState<string | null>(null);

  // Data state
  const [fieldDescribe, setFieldDescribe] = useState<Record<string, FieldDescribe>>({});
  const [nameFieldMap, setNameFieldMap] = useState<Record<string, string>>({});
  const [originalValues, setOriginalValues] = useState<Record<string, unknown>>({});
  const [currentValues, setCurrentValues] = useState<Record<string, unknown>>({});
  const [objectLabel, setObjectLabel] = useState<string>('Loading...');
  const [sortedFields, setSortedFields] = useState<FieldDescribe[]>([]);

  // UI state
  const [status, setStatus] = useState<StatusState>({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Modal state
  const [previewField, setPreviewField] = useState<FieldDescribe | null>(null);
  const [previewValue, setPreviewValue] = useState<unknown>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Computed values
  const changedFields = useMemo(
    () => getChangedFields(originalValues, currentValues, fieldDescribe),
    [originalValues, currentValues, fieldDescribe]
  );
  const changeCount = Object.keys(changedFields).length;
  const hasChanges = changeCount > 0;

  // Initialize from URL params and load connection
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const objType = params.get('objectType');
    const recId = params.get('recordId');
    const connId = params.get('connectionId');

    setObjectType(objType);
    setRecordId(recId);
    setConnectionId(connId);

    if (!objType || !recId || !connId) {
      setError('Missing required parameters');
      setIsLoading(false);
      return;
    }

    // Load connection and set as active
    loadConnection(connId).then((connection) => {
      if (!connection) {
        setError('Connection not found. Please re-authorize.');
        setIsLoading(false);
        return;
      }
      setInstanceUrl(connection.instanceUrl);
      setActiveConnection(connection);
    });
  }, []);

  // Load record when connection is set
  useEffect(() => {
    if (instanceUrl && objectType && recordId) {
      loadRecord();
    }
  }, [instanceUrl, objectType, recordId]);

  const loadConnection = async (id: string): Promise<SalesforceConnection | null> => {
    const { connections } = await chrome.storage.local.get(['connections']);
    return (connections as SalesforceConnection[] | undefined)?.find((c) => c.id === id) || null;
  };

  const loadRecord = async () => {
    if (!objectType || !recordId) return;

    setIsLoading(true);
    setError(null);
    setStatus({ text: 'Loading...', type: 'loading' });

    try {
      const describe = await getObjectDescribe(objectType);
      const { record, nameFieldMap: nfMap } = await getRecordWithRelationships(
        objectType,
        recordId,
        describe.fields
      );

      // Build field describe map
      const fieldMap: Record<string, FieldDescribe> = {};
      for (const field of describe.fields) {
        fieldMap[field.name] = field;
      }
      setFieldDescribe(fieldMap);
      setNameFieldMap(nfMap);

      // Sort and filter fields for display
      const sorted = sortFields(describe.fields);
      const filtered = filterFields(sorted);
      setSortedFields(filtered);

      setObjectLabel(describe.label);
      document.title = `${recordId} - Record Viewer - sftools`;

      setOriginalValues({ ...record });
      setCurrentValues({ ...record });

      setStatus({ text: 'Loaded', type: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setStatus({ text: 'Error', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = useCallback((fieldName: string, value: unknown) => {
    setCurrentValues((prev) => ({ ...prev, [fieldName]: value }));
  }, []);

  const handlePreviewClick = useCallback((field: FieldDescribe, value: unknown) => {
    setPreviewField(field);
    setPreviewValue(value);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setPreviewField(null);
    setPreviewValue(null);
  }, []);

  const handleSave = async () => {
    if (!hasChanges || !objectType || !recordId) return;

    setIsSaving(true);
    setStatus({ text: 'Saving...', type: 'loading' });

    try {
      await updateRecord(objectType, recordId, changedFields);

      // Update original values to match saved state
      setOriginalValues((prev) => ({ ...prev, ...changedFields }));

      setStatus({ text: 'Saved', type: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setStatus({ text: 'Save Failed', type: 'error' });
      alert(`Error saving record: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefresh = () => {
    loadRecord();
  };

  const handleOpenInOrg = () => {
    if (instanceUrl && objectType && recordId) {
      const url = `${instanceUrl}/lightning/r/${objectType}/${recordId}/view`;
      window.open(url, '_blank');
    }
  };

  // Render error state
  if (error && !isLoading) {
    return (
      <div data-testid="record-page">
        <header className="standalone-header">
          <div className="nav-brand">
            <img src="../../icon.png" alt="" />
            sftools
          </div>
          <span className="tool-name">Record Viewer</span>
        </header>
        <main className="content-area">
          <div className="card">
            <div className="card-header">
              <div className={`card-header-icon ${styles.headerIcon}`}>
                R
              </div>
              <h2>Record Details</h2>
            </div>
            <div className="card-body">
              <div className={styles.errorContainer}>
                <p className={styles.errorMessage}>{error}</p>
                <p className={styles.errorHint}>Please check the connection and try again.</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div data-testid="record-page">
      <header className="standalone-header">
        <div className="nav-brand">
          <img src="../../icon.png" alt="" />
          sftools
        </div>
        <span className="tool-name">Record Viewer</span>
      </header>

      <main className="content-area">
        <div className="card">
          <div className="card-header">
            <div className={`card-header-icon ${styles.headerIcon}`}>
              R
            </div>
            <h2>Record Details</h2>
          </div>
          <div className="card-body">
            <div className={styles.recordInfo}>
              <span className={styles.objectName} id="objectName">{objectLabel}</span>
              <span className={styles.recordId} id="recordId">{recordId}</span>
              <button
                className={`button-neutral ${styles.openInOrgBtn}`}
                onClick={handleOpenInOrg}
                id="openInOrgBtn"
              >
                Open in Org
              </button>
              <StatusBadge type={status.type} id="status">{status.text}</StatusBadge>
            </div>

            <div className={styles.fieldHeader}>
              <div>Field Label</div>
              <div>API Name</div>
              <div>Type</div>
              <div>Value</div>
              <div>Preview</div>
            </div>

            <div className={styles.fieldsContainer} id="fieldsContainer">
              {isLoading ? (
                <div className={styles.loadingContainer}>Loading record data...</div>
              ) : (
                sortedFields.map((field) => (
                  <FieldRow
                    key={field.name}
                    field={field}
                    value={currentValues[field.name]}
                    originalValue={originalValues[field.name]}
                    record={currentValues as SObject}
                    nameFieldMap={nameFieldMap}
                    connectionId={connectionId || ''}
                    onChange={handleFieldChange}
                    onPreviewClick={handlePreviewClick}
                  />
                ))
              )}
            </div>

            <div className={styles.actionsBar}>
              <button
                className={`button-brand ${styles.saveBtn}`}
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                id="saveBtn"
              >
                Save Changes
              </button>
              <button className="button-neutral" onClick={handleRefresh} disabled={isLoading} id="refreshBtn">
                Refresh
              </button>
              <span className={styles.changeCount} id="changeCount">
                {changeCount > 0
                  ? `${changeCount} field${changeCount > 1 ? 's' : ''} modified`
                  : ''}
              </span>
            </div>
          </div>
        </div>
      </main>

      <RichTextModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        field={previewField}
        value={previewValue}
      />
    </div>
  );
}
