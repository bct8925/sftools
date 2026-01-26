import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { FieldDescribe } from '../../types/salesforce';
import { filterFields, getFieldTypeDisplay } from '../../lib/schema-utils';
import { icons } from '../../lib/icons';
import { ButtonIcon } from '../button-icon/ButtonIcon';
import { SfIcon } from '../sf-icon/SfIcon';
import styles from './SchemaPage.module.css';

interface FieldListProps {
  objectLabel: string;
  objectName: string;
  fields: FieldDescribe[];
  isLoading: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onNavigateToObject: (objectName: string) => void;
  onEditFormula: (field: FieldDescribe) => void;
}

/**
 * Field list panel showing all fields for a selected object.
 * Supports filtering, reference navigation, and formula editing.
 */
export function FieldList({
  objectLabel,
  objectName,
  fields,
  isLoading,
  onClose,
  onRefresh,
  onNavigateToObject,
  onEditFormula,
}: FieldListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [openMenuFieldName, setOpenMenuFieldName] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter fields based on search term
  const filteredFields = useMemo(() => filterFields(fields, searchTerm), [fields, searchTerm]);

  // Handle search input
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  // Handle reference link click
  const handleReferenceClick = useCallback(
    (e: React.MouseEvent, refObjectName: string) => {
      e.preventDefault();
      onNavigateToObject(refObjectName);
    },
    [onNavigateToObject]
  );

  // Toggle field menu
  const handleMenuToggle = useCallback((fieldName: string) => {
    setOpenMenuFieldName((prev) => (prev === fieldName ? null : fieldName));
  }, []);

  // Handle edit action
  const handleEditClick = useCallback(
    (field: FieldDescribe) => {
      setOpenMenuFieldName(null);
      onEditFormula(field);
    },
    [onEditFormula]
  );

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest(`.${styles.fieldMenuButton}`) &&
        !target.closest(`.${styles.fieldMenu}`)
      ) {
        setOpenMenuFieldName(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Clear search when object changes
  useEffect(() => {
    setSearchTerm('');
  }, [objectName]);

  return (
    <div ref={containerRef} className={styles.fieldsPanel} data-testid="schema-fields-panel">
      <div className={styles.fieldsHeader}>
        <div className={styles.fieldsHeaderTop}>
          <h3 data-testid="schema-selected-object-label">{objectLabel}</h3>
          <div className={styles.fieldsHeaderActions}>
            <ButtonIcon icon="refresh" title="Refresh fields" onClick={onRefresh} data-testid="schema-refresh-fields" />
            <button className={styles.closeBtn} onClick={onClose} title="Close" data-testid="schema-close-fields">
              <SfIcon name="close" />
            </button>
          </div>
        </div>
        <div className={styles.selectedObjectName} data-testid="schema-selected-object-name">{objectName}</div>
        <input
          type="text"
          className={`input ${styles.filterInput}`}
          placeholder="Filter fields..."
          value={searchTerm}
          onChange={handleSearchChange}
          data-testid="schema-field-filter"
        />
      </div>

      <div className={styles.fieldHeader}>
        <div>Field Label</div>
        <div>API Name</div>
        <div>Type</div>
      </div>

      <div className={styles.fieldsList} data-testid="schema-fields-list">
        {isLoading ? (
          <div className={styles.loadingContainer} data-testid="schema-fields-loading">Loading fields...</div>
        ) : filteredFields.length === 0 ? (
          <div className={styles.loadingContainer}>No fields found</div>
        ) : (
          filteredFields.map((field) => (
            <FieldItem
              key={field.name}
              field={field}
              isMenuOpen={openMenuFieldName === field.name}
              onMenuToggle={handleMenuToggle}
              onReferenceClick={handleReferenceClick}
              onEditClick={handleEditClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface FieldItemProps {
  field: FieldDescribe;
  isMenuOpen: boolean;
  onMenuToggle: (fieldName: string) => void;
  onReferenceClick: (e: React.MouseEvent, objectName: string) => void;
  onEditClick: (field: FieldDescribe) => void;
}

function FieldItem({
  field,
  isMenuOpen,
  onMenuToggle,
  onReferenceClick,
  onEditClick,
}: FieldItemProps) {
  const typeDisplay = getFieldTypeDisplay(field);
  const isFormulaField =
    field.calculated && (field as FieldDescribe & { calculatedFormula?: string }).calculatedFormula;

  const handleMenuButtonClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onMenuToggle(field.name);
    },
    [field.name, onMenuToggle]
  );

  const handleEditClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEditClick(field);
    },
    [field, onEditClick]
  );

  // Render type cell with optional reference links
  const renderTypeCell = () => {
    if (typeDisplay.isReference && typeDisplay.referenceTo) {
      const links = typeDisplay.referenceTo.map((objName, idx) => (
        <span key={objName}>
          {idx > 0 && ', '}
          <a
            href="#"
            className={styles.referenceLink}
            onClick={(e) => onReferenceClick(e, objName)}
          >
            {objName}
          </a>
        </span>
      ));
      return <>reference ({links})</>;
    }
    return typeDisplay.text;
  };

  return (
    <div className={styles.fieldItem} data-testid="schema-field-item" data-field-name={field.name}>
      <div className={styles.fieldItemLabel} data-testid="schema-field-label" title={field.label}>
        {field.label}
      </div>
      <div className={styles.fieldItemName} title={field.name}>
        {field.name}
      </div>
      <div className={styles.fieldItemType} data-testid="schema-field-type" title={typeDisplay.text}>
        {renderTypeCell()}
      </div>
      <div className={styles.fieldItemActions}>
        {isFormulaField && (
          <>
            <button
              className={styles.fieldMenuButton}
              onClick={handleMenuButtonClick}
              aria-label="More options"
              dangerouslySetInnerHTML={{ __html: icons.verticalDots }}
            />
            <div className={`${styles.fieldMenu}${isMenuOpen ? ` ${styles.show}` : ''}`}>
              <div className={styles.fieldMenuItem} onClick={handleEditClick}>
                Edit
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
