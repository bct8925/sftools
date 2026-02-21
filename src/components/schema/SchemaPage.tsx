import { useState, useEffect, useCallback } from 'react';
import type { SObjectDescribe, FieldDescribe, SalesforceConnection } from '../../types/salesforce';
import { getGlobalDescribe, getObjectDescribe } from '../../api/salesforce';
import { setActiveConnection } from '../../auth/auth';
import { ObjectList } from './ObjectList';
import { FieldList } from './FieldList';
import { FormulaEditor } from './FormulaEditor';
import styles from './SchemaPage.module.css';

export interface SchemaPageProps {
    connectionId?: string;
    instanceUrl?: string;
}

/**
 * Schema Browser page - browse objects and fields in a Salesforce org.
 * Supports inline mode (props from context) and standalone mode (URL params).
 */
export function SchemaPage({
    connectionId: propConnectionId,
    instanceUrl: propInstanceUrl,
}: SchemaPageProps = {}) {
    const isStandalone = !propConnectionId;

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

    // Active connection state (standalone only)
    const [resolvedInstanceUrl, setResolvedInstanceUrl] = useState<string>('');

    const instanceUrl = isStandalone ? resolvedInstanceUrl : propInstanceUrl || '';

    const loadObjects = useCallback(async (bypassCache = false) => {
        setIsLoadingObjects(true);
        setError(null);

        try {
            const describe = await getGlobalDescribe(bypassCache);
            const queryableObjects = describe.sobjects
                .filter(obj => obj.queryable)
                .sort((a, b) => a.name.localeCompare(b.name));
            setAllObjects(queryableObjects);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(message);
        } finally {
            setIsLoadingObjects(false);
        }
    }, []);

    // Standalone mode: initialize from URL params and load connection
    useEffect(() => {
        if (!isStandalone) return;

        const params = new URLSearchParams(window.location.search);
        const connId = params.get('connectionId');

        if (!connId) {
            setError('Missing connection ID');
            setIsLoadingObjects(false);
            return;
        }

        const loadConnection = async (id: string): Promise<SalesforceConnection | null> => {
            const { connections } = await chrome.storage.local.get(['connections']);
            return (
                (connections as SalesforceConnection[] | undefined)?.find(c => c.id === id) || null
            );
        };

        loadConnection(connId).then(connection => {
            if (!connection) {
                setError('Connection not found. Please re-authorize.');
                setIsLoadingObjects(false);
                return;
            }
            setActiveConnection(connection);
            setResolvedInstanceUrl(connection.instanceUrl);
            loadObjects();
        });
    }, [isStandalone, loadObjects]);

    // Inline mode: load objects when props are provided, reload on connection change
    useEffect(() => {
        if (isStandalone) return;

        setSelectedObject(null);
        setAllFields([]);
        setError(null);
        loadObjects();
    }, [isStandalone, propConnectionId, loadObjects]);

    const handleRefreshObjects = useCallback(() => {
        loadObjects(true);
    }, [loadObjects]);

    const loadFields = useCallback(async (objectName: string, bypassCache = false) => {
        setIsLoadingFields(true);

        try {
            const describe = await getObjectDescribe(objectName, bypassCache);
            const sortedFields = [...(describe.fields || [])].sort((a, b) =>
                a.name.localeCompare(b.name)
            );
            setAllFields(sortedFields);
        } catch {
            setAllFields([]);
        } finally {
            setIsLoadingFields(false);
        }
    }, []);

    const handleSelectObject = useCallback(
        async (objectName: string) => {
            const obj = allObjects.find(o => o.name === objectName);
            if (!obj) return;

            setSelectedObject(obj);
            await loadFields(objectName);
        },
        [allObjects, loadFields]
    );

    const handleRefreshFields = useCallback(() => {
        if (selectedObject) {
            loadFields(selectedObject.name, true);
        }
    }, [selectedObject, loadFields]);

    const handleCloseFields = useCallback(() => {
        setSelectedObject(null);
        setAllFields([]);
    }, []);

    const handleNavigateToObject = useCallback(
        (objectName: string) => {
            const obj = allObjects.find(o => o.name === objectName);
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
        if (selectedObject) {
            loadFields(selectedObject.name);
        }
    }, [selectedObject, loadFields]);

    const schemaContent = (
        <div
            className={`${styles.schemaContainer} ${!isStandalone ? styles.schemaContainerInline : ''}`}
        >
            <ObjectList
                objects={allObjects}
                selectedObjectName={selectedObject?.name || null}
                isLoading={isLoadingObjects}
                instanceUrl={instanceUrl}
                onSelect={handleSelectObject}
                onRefresh={handleRefreshObjects}
            />

            {selectedObject && (
                <FieldList
                    objectLabel={selectedObject.label}
                    objectName={selectedObject.name}
                    fields={allFields}
                    isLoading={isLoadingFields}
                    instanceUrl={instanceUrl}
                    onClose={handleCloseFields}
                    onRefresh={handleRefreshFields}
                    onNavigateToObject={handleNavigateToObject}
                    onEditFormula={handleEditFormula}
                />
            )}
        </div>
    );

    const errorContent = (
        <div className={styles.errorContainer}>
            <p className={styles.errorMessage}>{error}</p>
            <p className={styles.errorHint}>Please check the connection and try again.</p>
        </div>
    );

    const formulaEditor = (
        <FormulaEditor
            isOpen={isFormulaEditorOpen}
            onClose={handleCloseFormulaEditor}
            field={editingField}
            objectName={selectedObject?.name || ''}
            objectLabel={selectedObject?.label || ''}
            allFields={allFields}
            onSaveSuccess={handleFormulaSaveSuccess}
        />
    );

    // Inline mode: render content directly without standalone chrome
    if (!isStandalone) {
        return (
            <div data-testid="schema-page">
                {error && !isLoadingObjects ? errorContent : schemaContent}
                {formulaEditor}
            </div>
        );
    }

    // Standalone mode: render with header and card wrapper
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
                            <div className={`card-header-icon ${styles.headerIcon}`}>S</div>
                            <h2>Schema Browser</h2>
                        </div>
                        <div className={`card-body ${styles.schemaCardBody}`}>{errorContent}</div>
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
                        <div className={`card-header-icon ${styles.headerIcon}`}>S</div>
                        <h2>Schema Browser</h2>
                    </div>
                    <div className={`card-body ${styles.schemaCardBody}`}>{schemaContent}</div>
                </div>
            </main>

            {formulaEditor}
        </div>
    );
}
