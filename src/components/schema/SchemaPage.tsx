import { useState, useEffect, useCallback } from 'react';
import type {
  SObjectDescribe,
  FieldDescribe,
  SalesforceConnection,
} from '../../types/salesforce';
import { getGlobalDescribe, getObjectDescribe } from '../../lib/salesforce.js';
import { setActiveConnection } from '../../lib/auth.js';
import { ObjectList } from './ObjectList';
import { FieldList } from './FieldList';
import { FormulaEditor } from './FormulaEditor';
import styles from './SchemaPage.module.css';

/**
 * Schema Browser page - browse objects and fields in a Salesforce org.
 * Parses connectionId from URL params.
 */
export function SchemaPage() {
  // URL parameters
  const [connectionId, setConnectionId] = useState<string | null>(null);

  // Objects state
  const [allObjects, setAllObjects] = useState<SObjectDescribe[]>([]);
  const [isLoadingObjects, setIsLoadingObjects] = useState(true);

  // Selected object state
  const [selectedObject, setSelectedObject] = useState<SObjectDescribe | null>(null);
  const [allFields, setAllFields] = useState<FieldDescribe[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);

  // Formula editor state
  const [editingField, setEditingField] = useState<FieldDescribe | null>(null);
  const [isFormulaEditorOpen, setIsFormulaEditorOpen] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Initialize from URL params and load connection
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connId = params.get('connectionId');
    setConnectionId(connId);

    if (!connId) {
      setError('Missing connection ID');
      setIsLoadingObjects(false);
      return;
    }

    loadConnection(connId).then((connection) => {
      if (!connection) {
        setError('Connection not found. Please re-authorize.');
        setIsLoadingObjects(false);
        return;
      }
      setActiveConnection(connection);
      loadObjects();
    });
  }, []);

  const loadConnection = async (id: string): Promise<SalesforceConnection | null> => {
    const { connections } = await chrome.storage.local.get(['connections']);
    return (connections as SalesforceConnection[] | undefined)?.find((c) => c.id === id) || null;
  };

  const loadObjects = async (bypassCache = false) => {
    setIsLoadingObjects(true);
    setError(null);

    try {
      const describe = await getGlobalDescribe(bypassCache);
      const queryableObjects = describe.sobjects
        .filter((obj) => obj.queryable)
        .sort((a, b) => a.name.localeCompare(b.name));
      setAllObjects(queryableObjects);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setIsLoadingObjects(false);
    }
  };

  const handleRefreshObjects = useCallback(() => {
    loadObjects(true);
  }, []);

  const handleSelectObject = useCallback(
    async (objectName: string) => {
      const obj = allObjects.find((o) => o.name === objectName);
      if (!obj) return;

      setSelectedObject(obj);
      await loadFields(objectName);
    },
    [allObjects]
  );

  const loadFields = async (objectName: string, bypassCache = false) => {
    setIsLoadingFields(true);

    try {
      const describe = await getObjectDescribe(objectName, bypassCache);
      const sortedFields = [...(describe.fields || [])].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      setAllFields(sortedFields);
    } catch (err) {
      // Set error state or show in field list
      setAllFields([]);
    } finally {
      setIsLoadingFields(false);
    }
  };

  const handleRefreshFields = useCallback(() => {
    if (selectedObject) {
      loadFields(selectedObject.name, true);
    }
  }, [selectedObject]);

  const handleCloseFields = useCallback(() => {
    setSelectedObject(null);
    setAllFields([]);
  }, []);

  const handleNavigateToObject = useCallback(
    (objectName: string) => {
      const obj = allObjects.find((o) => o.name === objectName);
      if (obj) {
        handleSelectObject(objectName);
      }
    },
    [allObjects, handleSelectObject]
  );

  const handleEditFormula = useCallback((field: FieldDescribe) => {
    setEditingField(field);
    setIsFormulaEditorOpen(true);
  }, []);

  const handleCloseFormulaEditor = useCallback(() => {
    setIsFormulaEditorOpen(false);
    setEditingField(null);
  }, []);

  const handleFormulaSaveSuccess = useCallback(() => {
    // Reload fields to reflect changes
    if (selectedObject) {
      loadFields(selectedObject.name);
    }
  }, [selectedObject]);

  // Render error state
  if (error && !isLoadingObjects) {
    return (
      <div data-testid="schema-page">
        <header className="standalone-header">
          <div className="nav-brand">
            <img src="../../icon.png" alt="" />
            sftools
          </div>
          <span className="tool-name">Schema Browser</span>
        </header>
        <main className="content-area">
          <div className="card schema-card">
            <div className="card-header">
              <div className="card-header-icon" style={{ backgroundColor: '#0070d2' }}>
                S
              </div>
              <h2>Schema Browser</h2>
            </div>
            <div className={`card-body ${styles.schemaCardBody}`}>
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
    <div data-testid="schema-page">
      <header className="standalone-header">
        <div className="nav-brand">
          <img src="../../icon.png" alt="" />
          sftools
        </div>
        <span className="tool-name">Schema Browser</span>
      </header>

      <main className="content-area">
        <div className="card schema-card">
          <div className="card-header">
            <div className="card-header-icon" style={{ backgroundColor: '#0070d2' }}>
              S
            </div>
            <h2>Schema Browser</h2>
          </div>
          <div className={`card-body ${styles.schemaCardBody}`}>
            <div className={styles.schemaContainer}>
              <ObjectList
                objects={allObjects}
                selectedObjectName={selectedObject?.name || null}
                isLoading={isLoadingObjects}
                onSelect={handleSelectObject}
                onRefresh={handleRefreshObjects}
              />

              {selectedObject && (
                <FieldList
                  objectLabel={selectedObject.label}
                  objectName={selectedObject.name}
                  fields={allFields}
                  isLoading={isLoadingFields}
                  onClose={handleCloseFields}
                  onRefresh={handleRefreshFields}
                  onNavigateToObject={handleNavigateToObject}
                  onEditFormula={handleEditFormula}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      <FormulaEditor
        isOpen={isFormulaEditorOpen}
        onClose={handleCloseFormulaEditor}
        field={editingField}
        objectName={selectedObject?.name || ''}
        objectLabel={selectedObject?.label || ''}
        allFields={allFields}
        onSaveSuccess={handleFormulaSaveSuccess}
      />
    </div>
  );
}
