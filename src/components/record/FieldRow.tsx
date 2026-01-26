import { useCallback, type ChangeEvent } from 'react';
import type { FieldDescribe, SObject } from '../../types/salesforce';
import { formatValue, parseValue, formatPreviewHtml } from '../../lib/record-utils';
import styles from './RecordPage.module.css';

interface FieldRowProps {
  field: FieldDescribe;
  value: unknown;
  originalValue: unknown;
  record: SObject;
  nameFieldMap: Record<string, string>;
  connectionId: string;
  onChange: (fieldName: string, value: unknown) => void;
  onPreviewClick: (field: FieldDescribe, value: unknown) => void;
}

/**
 * Single field row with label, API name, type, editable value input, and preview.
 */
export function FieldRow({
  field,
  value,
  originalValue,
  record,
  nameFieldMap,
  connectionId,
  onChange,
  onPreviewClick,
}: FieldRowProps) {
  const displayValue = formatValue(value, field);
  const isEditable = field.updateable && !field.calculated;
  const isModified = isValueModified(originalValue, value);

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const newValue = parseValue(e.target.value, field);
      onChange(field.name, newValue);
    },
    [field, onChange]
  );

  const handlePreviewClick = useCallback(() => {
    onPreviewClick(field, value);
  }, [field, value, onPreviewClick]);

  const typeDisplay = getTypeDisplay(field);
  const previewContent = renderPreview(
    field,
    value,
    record,
    nameFieldMap,
    connectionId,
    handlePreviewClick
  );

  return (
    <div className={`${styles.fieldRow} field-row${isModified ? ` ${styles.modified} modified` : ''}`} data-field={field.name}>
      <div className={styles.fieldLabel} title={field.label}>
        {field.label}
      </div>
      <div className={styles.fieldApiName} title={field.name}>
        {field.name}
      </div>
      <div className={styles.fieldType}>{typeDisplay}</div>
      <div className={`${styles.fieldValue} field-value`}>
        {field.type === 'picklist' && isEditable ? (
          <select
            className={`select ${styles.fieldInput} field-input`}
            value={String(value ?? '')}
            onChange={handleInputChange}
          >
            <option value="">--None--</option>
            {(field.picklistValues || [])
              .filter((pv) => pv.active)
              .map((pv) => (
                <option key={pv.value} value={pv.value}>
                  {pv.label}
                </option>
              ))}
          </select>
        ) : (
          <input
            type="text"
            className={`input ${styles.fieldInput} field-input`}
            value={displayValue}
            onChange={handleInputChange}
            disabled={!isEditable}
          />
        )}
      </div>
      <div className={styles.fieldPreview}>{previewContent}</div>
    </div>
  );
}

function isValueModified(originalValue: unknown, currentValue: unknown): boolean {
  const originalStr =
    originalValue === null || originalValue === undefined ? '' : String(originalValue);
  const currentStr =
    currentValue === null || currentValue === undefined ? '' : String(currentValue);
  return originalStr !== currentStr;
}

function getTypeDisplay(field: FieldDescribe): string {
  if (field.calculated) {
    return (field as FieldDescribe & { calculatedFormula?: string }).calculatedFormula
      ? `${field.type} (formula)`
      : `${field.type} (rollup)`;
  }
  return field.type;
}

function renderPreview(
  field: FieldDescribe,
  value: unknown,
  record: SObject,
  nameFieldMap: Record<string, string>,
  connectionId: string,
  onPreviewClick: () => void
): React.ReactNode {
  if (value === null || value === undefined) return null;

  const previewHtml = formatPreviewHtml(value, field, record, nameFieldMap, connectionId);

  // Handle special placeholders from formatPreviewHtml
  if (previewHtml === '__PREVIEW_BUTTON__') {
    return (
      <button className={styles.fieldPreviewBtn} onClick={onPreviewClick}>
        Preview
      </button>
    );
  }

  if (previewHtml === '__CHECKBOX_CHECKED__') {
    return <input type="checkbox" checked disabled />;
  }

  if (previewHtml === '__CHECKBOX_UNCHECKED__') {
    return <input type="checkbox" disabled />;
  }

  if (previewHtml.startsWith('__LINK__')) {
    const parts = previewHtml.split('__');
    const relatedName = parts[2];
    const displayType = parts[3];
    const relatedType = parts[4];
    const recordId = parts[5];
    const connId = parts[6];
    const url = `record.html?objectType=${encodeURIComponent(relatedType)}&recordId=${encodeURIComponent(recordId)}&connectionId=${encodeURIComponent(connId)}`;

    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        {relatedName} ({displayType})
      </a>
    );
  }

  // Format preview text for display
  const previewText = getPreviewText(value, field, record, nameFieldMap);
  return <span title={previewText}>{previewHtml}</span>;
}

function getPreviewText(
  value: unknown,
  field: FieldDescribe,
  record: SObject,
  nameFieldMap: Record<string, string>
): string {
  if (value === null || value === undefined) return '';

  switch (field.type) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'datetime':
      return new Date(String(value)).toLocaleString();
    case 'date':
      return new Date(`${value}T00:00:00`).toLocaleDateString();
    case 'reference':
      if (field.relationshipName && field.referenceTo?.length > 0) {
        const related = record[field.relationshipName] as SObject | undefined;
        const relatedType = field.referenceTo[0];
        const nameField = nameFieldMap[relatedType];
        const relatedName = nameField ? related?.[nameField] : null;
        if (relatedName) {
          const displayType = field.name === 'OwnerId' ? 'User/Group' : relatedType;
          return `${relatedName} (${displayType})`;
        }
      }
      return String(value);
    default:
      return String(value);
  }
}
