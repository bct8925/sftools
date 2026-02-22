import { useState, useEffect, useCallback } from 'react';
import type { SObjectDescribe, FieldDescribe } from '../../types/salesforce';
import { getGlobalDescribe, getObjectDescribe } from '../../api/salesforce';
import { ObjectList } from './ObjectList';
import { FieldList } from './FieldList';
import { FormulaEditor } from './FormulaEditor';
import styles from './SchemaPage.module.css';

export interface SchemaPageProps {
    connectionId: string;
    instanceUrl: string;
}

/**
 * Schema Browser page - browse objects and fields in a Salesforce org.
 * Renders inline as a tab within the main app.
 */
export function SchemaPage({ connectionId, instanceUrl }: SchemaPageProps) {
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

    // Load objects on mount, reload on connection change
    useEffect(() => {
        setSelectedObject(null);
        setAllFields([]);
        setError(null);
        loadObjects();
    }, [connectionId, loadObjects]);

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

    const errorContent = (
        <div className={styles.errorContainer}>
            <p className={styles.errorMessage}>{error}</p>
            <p className={styles.errorHint}>Please check the connection and try again.</p>
        </div>
    );

    return (
        <div data-testid="schema-page">
            {error && !isLoadingObjects ? (
                errorContent
            ) : (
                <div className={`${styles.schemaContainer} ${styles.schemaContainerInline}`}>
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
            )}

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
