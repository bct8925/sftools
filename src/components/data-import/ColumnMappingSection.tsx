// Column mapping section — lists all CSV columns and their Salesforce field targets
import { useMemo, useCallback } from 'react';
import { ColumnMappingRow } from './ColumnMappingRow';
import type { ColumnMapping, FieldDescribe, BulkIngestOperation } from '../../types/salesforce';
import styles from './DataImportTab.module.css';

interface ColumnMappingSectionProps {
    mappings: ColumnMapping[];
    eligibleFields: FieldDescribe[];
    operation: BulkIngestOperation;
    disabled: boolean;
    onToggle: (csvIndex: number) => void;
    onChangeTarget: (csvIndex: number, fieldApiName: string | null) => void;
}

export function ColumnMappingSection({
    mappings,
    eligibleFields,
    operation,
    disabled,
    onToggle,
    onChangeTarget,
}: ColumnMappingSectionProps) {
    // Compute once per render — passed to every row as stable prop
    const assignedFieldNames = useMemo(
        () =>
            new Set(
                mappings
                    .filter(m => m.fieldApiName !== null && m.included)
                    .map(m => m.fieldApiName!)
            ),
        [mappings]
    );

    // Stable callbacks — dispatch is stable from useReducer
    const handleToggle = useCallback((csvIndex: number) => onToggle(csvIndex), [onToggle]);

    const handleChangeTarget = useCallback(
        (csvIndex: number, fieldApiName: string | null) => onChangeTarget(csvIndex, fieldApiName),
        [onChangeTarget]
    );

    const mappedCount = mappings.filter(m => m.included && m.fieldApiName !== null).length;

    return (
        <div className="card">
            <div className="card-header">
                <h3>3. Column Mapping</h3>
                <span className={styles.mappingCount}>
                    {mappedCount} of {mappings.length} columns mapped
                </span>
            </div>
            <div className="card-body">
                {mappings.length === 0 ? (
                    <p className={styles.emptyMessage}>
                        Upload a CSV file to configure column mapping.
                    </p>
                ) : (
                    <>
                        <div className={styles.mappingHeader}>
                            <span className={styles.mappingHeaderCheckbox} />
                            <span className={styles.mappingHeaderCsv}>CSV Column</span>
                            <span className={styles.mappingHeaderField}>Salesforce Field</span>
                        </div>
                        <div className={styles.mappingList}>
                            {operation === 'delete'
                                ? mappings
                                      .filter(
                                          m =>
                                              m.fieldApiName === 'Id' ||
                                              m.csvHeader.toLowerCase() === 'id'
                                      )
                                      .slice(0, 1)
                                      .map(m => (
                                          <ColumnMappingRow
                                              key={m.csvIndex}
                                              mapping={m}
                                              eligibleFields={eligibleFields}
                                              assignedFieldNames={assignedFieldNames}
                                              onToggle={!disabled ? handleToggle : undefined}
                                              onChangeTarget={
                                                  !disabled ? handleChangeTarget : undefined
                                              }
                                          />
                                      ))
                                : mappings.map(m => (
                                      <ColumnMappingRow
                                          key={m.csvIndex}
                                          mapping={m}
                                          eligibleFields={eligibleFields}
                                          assignedFieldNames={assignedFieldNames}
                                          onToggle={!disabled ? handleToggle : undefined}
                                          onChangeTarget={
                                              !disabled ? handleChangeTarget : undefined
                                          }
                                      />
                                  ))}
                        </div>
                        <p className={styles.mappingNote}>
                            *Only fields eligible for this operation are shown.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
