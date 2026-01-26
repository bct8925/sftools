// Query Results Table - Data table with inline editing and subquery support
import { useState, useCallback, useMemo, Fragment } from 'react';
import type { SObject, FieldDescribe } from '../../types/salesforce';
import { flattenColumnMetadata, type QueryColumn } from '../../lib/column-utils';
import { getActiveConnectionId } from '../../lib/auth';
import { getValueByPath, formatCellValue } from '../../lib/csv-utils';
import { parseFieldValue } from '../../lib/value-utils';
import styles from './QueryTab.module.css';

interface QueryResultsTableProps {
  /** Records to display */
  records: SObject[];
  /** Column definitions */
  columns: QueryColumn[];
  /** Object name for record links */
  objectName: string | null;
  /** Field metadata for editing */
  fieldDescribe: Record<string, FieldDescribe> | null;
  /** Map of modified records and their changed fields */
  modifiedRecords: Map<string, Record<string, unknown>>;
  /** Whether edit mode is active */
  isEditMode: boolean;
  /** Called when a field value changes */
  onFieldChange: (recordId: string, fieldName: string, value: unknown, originalValue: unknown) => void;
  /** Filter text for row visibility */
  filterText: string;
}

/**
 * Results table component with inline editing and subquery expansion.
 */
export function QueryResultsTable({
  records,
  columns,
  objectName,
  fieldDescribe,
  modifiedRecords,
  isEditMode,
  onFieldChange,
  filterText,
}: QueryResultsTableProps) {
  // Track expanded subquery rows
  const [expandedSubqueries, setExpandedSubqueries] = useState<Set<string>>(new Set());

  // Filter records based on filterText
  const filteredRecords = useMemo(() => {
    if (!filterText.trim()) {
      return records;
    }
    const lowerFilter = filterText.toLowerCase();
    return records.filter((record) => {
      for (const col of columns) {
        const value = getValueByPath(record, col.path);
        const formatted = formatCellValue(value, col).toLowerCase();
        if (formatted.includes(lowerFilter)) {
          return true;
        }
      }
      return false;
    });
  }, [records, columns, filterText]);

  // Toggle subquery expansion
  const toggleSubquery = useCallback((rowId: string, colPath: string) => {
    const key = `${rowId}:${colPath}`;
    setExpandedSubqueries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Check if a field is editable
  const isFieldEditable = useCallback(
    (fieldPath: string): boolean => {
      if (fieldPath.includes('.')) return false;
      const field = fieldDescribe?.[fieldPath];
      if (!field) return false;
      return field.updateable && !field.calculated;
    },
    [fieldDescribe]
  );

  // Handle field input change
  const handleInputChange = useCallback(
    (recordId: string, fieldName: string, inputValue: string | boolean, originalValue: unknown) => {
      const field = fieldDescribe?.[fieldName];
      if (!field) return;

      let newValue: unknown;
      if (typeof inputValue === 'boolean') {
        newValue = inputValue;
      } else {
        newValue = parseFieldValue(inputValue, field);
      }

      onFieldChange(recordId, fieldName, newValue, originalValue);
    },
    [fieldDescribe, onFieldChange]
  );

  // Get the connection ID for record links
  const connectionId = getActiveConnectionId();

  // Render ID cell with link
  const renderIdCell = (value: string, objName: string) => {
    if (connectionId) {
      const href = `../../pages/record/record.html?objectType=${encodeURIComponent(objName)}&recordId=${encodeURIComponent(value)}&connectionId=${encodeURIComponent(connectionId)}`;
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={`${styles.idLink} query-id-link`} data-testid="query-id-link">
          {value}
        </a>
      );
    }
    return <span title={value}>{value}</span>;
  };

  // Render editable cell
  const renderEditableCell = (
    value: unknown,
    col: QueryColumn,
    recordId: string,
    modifiedValue: unknown
  ) => {
    const field = fieldDescribe?.[col.path];
    if (!field) return null;

    const displayValue = modifiedValue !== undefined ? modifiedValue : value;
    const isModified = modifiedValue !== undefined;

    if (field.type === 'boolean') {
      return (
        <input
          type="checkbox"
          className={`${styles.fieldInput} query-field-input`}
          checked={displayValue === true}
          onChange={(e) => handleInputChange(recordId, col.path, e.target.checked, value)}
          data-testid="query-field-input"
        />
      );
    }

    if (field.type === 'picklist' && field.picklistValues) {
      return (
        <select
          className={`${styles.fieldInput} query-field-input`}
          value={String(displayValue ?? '')}
          onChange={(e) => handleInputChange(recordId, col.path, e.target.value, value)}
          data-testid="query-field-input"
        >
          <option value="">--None--</option>
          {field.picklistValues
            .filter((pv) => pv.active)
            .map((pv) => (
              <option key={pv.value} value={pv.value}>
                {pv.label}
              </option>
            ))}
        </select>
      );
    }

    return (
      <input
        type="text"
        className={`${styles.fieldInput} query-field-input`}
        value={String(displayValue ?? '')}
        onChange={(e) => handleInputChange(recordId, col.path, e.target.value, value)}
        data-testid="query-field-input"
      />
    );
  };

  // Render subquery cell
  const renderSubqueryCell = (
    value: unknown,
    col: QueryColumn,
    recordId: string
  ) => {
    const subquery = value as { records?: SObject[]; totalSize?: number } | null;

    if (!subquery?.records || subquery.records.length === 0) {
      return <span className={styles.subqueryEmpty}>(0 records)</span>;
    }

    const count = subquery.totalSize || subquery.records.length;
    const key = `${recordId}:${col.path}`;
    const isExpanded = expandedSubqueries.has(key);

    return (
      <button
        className={styles.subqueryToggle}
        onClick={() => toggleSubquery(recordId, col.path)}
        data-testid="query-subquery-toggle"
        data-expanded={isExpanded ? 'true' : 'false'}
      >
        {isExpanded ? '\u25BC' : '\u25B6'} {count} record{count !== 1 ? 's' : ''}
      </button>
    );
  };

  // Render subquery detail row
  const renderSubqueryDetailRow = (
    parentRecord: SObject,
    col: QueryColumn,
    colSpan: number
  ) => {
    const key = `${parentRecord.Id}:${col.path}`;
    if (!expandedSubqueries.has(key)) return null;

    const subqueryData = getValueByPath(parentRecord, col.path) as {
      records?: SObject[];
    } | null;
    if (!subqueryData?.records) return null;

    // Get subquery columns
    let subColumns: QueryColumn[];
    if (col.subqueryColumns && col.subqueryColumns.length > 0) {
      subColumns = flattenColumnMetadata(col.subqueryColumns);
    } else if (subqueryData.records.length > 0) {
      subColumns = Object.keys(subqueryData.records[0])
        .filter((k) => k !== 'attributes')
        .map((k) => ({ title: k, path: k, aggregate: false, isSubquery: false }));
    } else {
      subColumns = [];
    }

    return (
      <tr key={`${key}-detail`} className={styles.subqueryDetail} data-testid="query-subquery-detail">
        <td colSpan={colSpan}>
          <table className={styles.subqueryTable} data-testid="query-subquery-table">
            <thead>
              <tr>
                {subColumns.map((sc) => (
                  <th key={sc.path}>{sc.title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subqueryData.records.map((subRecord, idx) => (
                <tr key={subRecord.Id || idx}>
                  {subColumns.map((sc) => {
                    const val = getValueByPath(subRecord, sc.path);
                    return (
                      <td key={sc.path} title={formatCellValue(val, sc)}>
                        {formatCellValue(val, sc)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </td>
      </tr>
    );
  };

  // Render a single cell
  const renderCell = (
    record: SObject,
    col: QueryColumn,
    recordId: string,
    modifiedFields: Record<string, unknown> | undefined
  ) => {
    const value = getValueByPath(record, col.path);
    const modifiedValue = modifiedFields?.[col.path];
    const isModified = modifiedValue !== undefined;

    // Subquery cell
    if (col.isSubquery) {
      return (
        <td key={col.path} className={styles.subqueryCell}>
          {renderSubqueryCell(value, col, recordId)}
        </td>
      );
    }

    // ID cell with link
    if (col.path === 'Id' && value && objectName) {
      return (
        <td key={col.path}>
          {renderIdCell(String(value), objectName)}
        </td>
      );
    }

    // Editable cell
    if (isEditMode && isFieldEditable(col.path)) {
      return (
        <td
          key={col.path}
          className={isModified ? styles.modified : undefined}
          data-modified={isModified ? 'true' : 'false'}
        >
          {renderEditableCell(value, col, recordId, modifiedValue)}
        </td>
      );
    }

    // Read-only cell
    const formatted = formatCellValue(value, col);
    return (
      <td key={col.path} title={formatted}>
        {formatted}
      </td>
    );
  };

  return (
    <table className={`${styles.resultsTable}${isEditMode ? ` ${styles.resultsEditable}` : ''}`}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.path}>{col.title}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filteredRecords.map((record) => {
          const recordId = String(record.Id);
          const modifiedFields = modifiedRecords.get(recordId);
          const subqueryColumns = columns.filter((c) => c.isSubquery);

          return (
            <Fragment key={recordId}>
              <tr data-record-id={recordId}>
                {columns.map((col) => renderCell(record, col, recordId, modifiedFields))}
              </tr>
              {/* Render expanded subquery rows */}
              {subqueryColumns.map((col) =>
                renderSubqueryDetailRow(record, col, columns.length)
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
