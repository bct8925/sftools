// Operation and Object selection section
import { useCallback } from 'react';
import { ObjectSearchSelect } from './ObjectSearchSelect';
import type { BulkIngestOperation, FieldDescribe, SObjectDescribe } from '../../types/salesforce';
import styles from './DataImportTab.module.css';

interface OperationSectionProps {
    operation: BulkIngestOperation;
    objectName: string | null;
    externalIdField: string | null;
    objects: SObjectDescribe[];
    fields: FieldDescribe[];
    disabled: boolean;
    onOperationChange: (op: BulkIngestOperation) => void;
    onObjectChange: (name: string | null) => void;
    onExternalIdFieldChange: (field: string | null) => void;
}

const OPERATIONS: { value: BulkIngestOperation; label: string }[] = [
    { value: 'insert', label: 'Insert' },
    { value: 'update', label: 'Update' },
    { value: 'upsert', label: 'Upsert' },
    { value: 'delete', label: 'Delete' },
];

function filterObjectsByOperation(
    objects: SObjectDescribe[],
    operation: BulkIngestOperation
): SObjectDescribe[] {
    switch (operation) {
        case 'insert':
            return objects.filter(o => o.createable);
        case 'update':
            return objects.filter(o => o.updateable);
        case 'upsert':
            return objects.filter(o => o.createable || o.updateable);
        case 'delete':
            return objects.filter(o => o.deletable);
    }
}

export function OperationSection({
    operation,
    objectName,
    externalIdField,
    objects,
    fields,
    disabled,
    onOperationChange,
    onObjectChange,
    onExternalIdFieldChange,
}: OperationSectionProps) {
    const handleOperationChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            onOperationChange(e.target.value as BulkIngestOperation);
        },
        [onOperationChange]
    );

    const handleExternalIdFieldChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            onExternalIdFieldChange(e.target.value || null);
        },
        [onExternalIdFieldChange]
    );

    const eligibleObjects = filterObjectsByOperation(objects, operation);
    const externalIdFields = fields.filter(f => f.externalId || f.name === 'Id');

    return (
        <div className="card" data-testid="data-import-operation-section">
            <div className="card-header">
                <h3>1. Operation &amp; Object</h3>
            </div>
            <div className="card-body">
                <div className={styles.formRow}>
                    <label className={styles.formLabel}>Operation</label>
                    <select
                        className="input"
                        value={operation}
                        onChange={handleOperationChange}
                        disabled={disabled}
                        data-testid="data-import-operation-select"
                    >
                        {OPERATIONS.map(op => (
                            <option key={op.value} value={op.value}>
                                {op.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className={styles.formRow}>
                    <label className={styles.formLabel}>Object</label>
                    <ObjectSearchSelect
                        objects={eligibleObjects}
                        value={objectName}
                        onChange={onObjectChange}
                        disabled={disabled}
                        placeholder="Search objects..."
                    />
                </div>

                {operation === 'upsert' && objectName && (
                    <div className={styles.formRow}>
                        <label className={styles.formLabel}>External ID Field</label>
                        <select
                            className="input"
                            value={externalIdField ?? ''}
                            onChange={handleExternalIdFieldChange}
                            disabled={disabled}
                        >
                            <option value="">-- Select external ID field --</option>
                            {externalIdFields.map(f => (
                                <option key={f.name} value={f.name}>
                                    {f.label} ({f.name})
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
        </div>
    );
}
