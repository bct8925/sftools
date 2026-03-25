// Individual column mapping row — memo-wrapped for list performance
import { memo, useMemo, useCallback } from 'react';
import type { ColumnMapping, FieldDescribe } from '../../types/salesforce';
import styles from './DataImportTab.module.css';

// Stable default no-op to avoid creating new function references
const NOOP = () => {};

interface ColumnMappingRowProps {
    mapping: ColumnMapping;
    eligibleFields: FieldDescribe[];
    assignedFieldNames: Set<string>;
    onToggle?: (csvIndex: number) => void;
    onChangeTarget?: (csvIndex: number, fieldApiName: string | null) => void;
}

export const ColumnMappingRow = memo(function ColumnMappingRow({
    mapping,
    eligibleFields,
    assignedFieldNames,
    onToggle = NOOP,
    onChangeTarget = NOOP,
}: ColumnMappingRowProps) {
    // Fields available for this row: not assigned elsewhere, or currently assigned here
    const availableFields = useMemo(
        () =>
            eligibleFields.filter(
                f => !assignedFieldNames.has(f.name) || f.name === mapping.fieldApiName
            ),
        [eligibleFields, assignedFieldNames, mapping.fieldApiName]
    );

    const handleToggle = useCallback(() => {
        onToggle(mapping.csvIndex);
    }, [onToggle, mapping.csvIndex]);

    const handleSelectChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            onChangeTarget(mapping.csvIndex, e.target.value || null);
        },
        [onChangeTarget, mapping.csvIndex]
    );

    const isAutoMapped = mapping.mappingSource === 'api-name' || mapping.mappingSource === 'label';

    return (
        <div className={styles.mappingRow}>
            <input
                type="checkbox"
                className={styles.mappingCheckbox}
                checked={mapping.included}
                onChange={handleToggle}
                aria-label={`Include column ${mapping.csvHeader}`}
            />
            <span className={styles.mappingCsvHeader} title={mapping.csvHeader}>
                {mapping.csvHeader}
                {isAutoMapped && mapping.included && (
                    <span className={styles.autoMappedDot} title="Auto-mapped" aria-hidden="true">
                        •
                    </span>
                )}
            </span>
            <select
                className={`input ${styles.mappingSelect}`}
                value={mapping.fieldApiName ?? ''}
                onChange={handleSelectChange}
                disabled={!mapping.included}
                aria-label={`Target field for ${mapping.csvHeader}`}
            >
                <option value="">-- Do not import --</option>
                {availableFields.map(f => (
                    <option key={f.name} value={f.name}>
                        {f.label} ({f.name})
                    </option>
                ))}
            </select>
        </div>
    );
});
