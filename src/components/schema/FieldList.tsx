import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { FieldDescribe } from '../../types/salesforce';
import { filterFields, getFieldTypeDisplay } from '../../lib/schema-utils';
import { getObjectDescribe } from '../../api/salesforce';
import { icons } from '../../lib/icons';
import { ButtonIcon } from '../button-icon/ButtonIcon';
import { SfIcon } from '../sf-icon/SfIcon';
import styles from './SchemaPage.module.css';

interface FieldListProps {
  objectLabel: string;
  objectName: string;
  fields: FieldDescribe[];
  isLoading: boolean;
  instanceUrl: string;
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
  instanceUrl,
  onClose,
  onRefresh,
  onNavigateToObject,
  onEditFormula,
}: FieldListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [openMenuFieldName, setOpenMenuFieldName] = useState<string | null>(null);
  const [expandedFieldName, setExpandedFieldName] = useState<string | null>(null);
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

  // Toggle field detail expansion
  const handleFieldClick = useCallback((fieldName: string) => {
    setExpandedFieldName((prev) => (prev === fieldName ? null : fieldName));
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
              objectName={objectName}
              instanceUrl={instanceUrl}
              isMenuOpen={openMenuFieldName === field.name}
              isExpanded={expandedFieldName === field.name}
              onMenuToggle={handleMenuToggle}
              onReferenceClick={handleReferenceClick}
              onEditClick={handleEditClick}
              onFieldClick={handleFieldClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface FieldItemProps {
  field: FieldDescribe;
  objectName: string;
  instanceUrl: string;
  isMenuOpen: boolean;
  isExpanded: boolean;
  onMenuToggle: (fieldName: string) => void;
  onReferenceClick: (e: React.MouseEvent, objectName: string) => void;
  onEditClick: (field: FieldDescribe) => void;
  onFieldClick: (fieldName: string) => void;
}

function FieldItem({
  field,
  objectName,
  instanceUrl,
  isMenuOpen,
  isExpanded,
  onMenuToggle,
  onReferenceClick,
  onEditClick,
  onFieldClick,
}: FieldItemProps) {
  const typeDisplay = getFieldTypeDisplay(field);
  const isFormulaField =
    field.calculated && (field as FieldDescribe & { calculatedFormula?: string }).calculatedFormula;

  const [resolvedRelationship, setResolvedRelationship] = useState<string | null>(null);
  const [relationshipLoading, setRelationshipLoading] = useState(false);

  useEffect(() => {
    if (!isExpanded || field.type !== 'reference' || field.referenceTo.length === 0) {
      setResolvedRelationship(null);
      return;
    }

    let cancelled = false;
    setRelationshipLoading(true);

    getObjectDescribe(field.referenceTo[0])
      .then((describe) => {
        if (cancelled) return;
        const match = describe.childRelationships.find(
          (cr) => cr.childSObject === objectName && cr.field === field.name
        );
        setResolvedRelationship(
          match?.relationshipName
            ? `${field.referenceTo[0]}.${match.relationshipName}`
            : null
        );
      })
      .catch(() => {
        if (!cancelled) setResolvedRelationship(null);
      })
      .finally(() => {
        if (!cancelled) setRelationshipLoading(false);
      });

    return () => { cancelled = true; };
  }, [isExpanded, field.type, field.referenceTo, field.name, objectName]);

  const handleMenuButtonClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onMenuToggle(field.name);
    },
    [field.name, onMenuToggle]
  );

  const handleRowClick = useCallback(() => {
    onFieldClick(field.name);
  }, [field.name, onFieldClick]);

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

  const setupUrl = `${instanceUrl.replace('.salesforce.com', '.salesforce-setup.com')}/lightning/setup/ObjectManager/${objectName}/FieldsAndRelationships/${field.name}/view`;

  const isRequired = !field.nillable && field.createable;
  const hasPicklist = (field.type === 'picklist' || field.type === 'multipicklist') && field.picklistValues && field.picklistValues.length > 0;

  const numericTypes = new Set(['currency', 'double', 'percent', 'int']);
  const stringTypes = new Set(['string', 'textarea', 'phone', 'email', 'url', 'encryptedstring']);

  const sizeDisplay = stringTypes.has(field.type) && field.length > 0
    ? String(field.length)
    : numericTypes.has(field.type)
      ? `${field.precision}, ${field.scale}`
      : null;

  const properties: string[] = [];
  if (field.externalId) properties.push('External ID');
  if (field.unique) properties.push('Unique');
  if (field.autoNumber) properties.push('Auto Number');

  const dash = <span className={styles.fieldDetailMuted}>—</span>;

  return (
    <>
      <div
        className={`${styles.fieldItem}${isExpanded ? ` ${styles.expanded}` : ''}`}
        data-testid="schema-field-item"
        data-field-name={field.name}
        onClick={handleRowClick}
      >
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
          <a
            href={setupUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.fieldItemLink}
            onClick={(e) => e.stopPropagation()}
            title="Open in Salesforce Setup"
            dangerouslySetInnerHTML={{ __html: icons.externalLink }}
          />
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
      {isExpanded && (
        <div className={styles.fieldDetail}>
          <div className={styles.fieldDetailRow}>
            <span className={styles.fieldDetailLabel}>Description</span>
            <span className={styles.fieldDetailValue}>{field.description || dash}</span>
          </div>
          <div className={styles.fieldDetailRow}>
            <span className={styles.fieldDetailLabel}>Help Text</span>
            <span className={styles.fieldDetailValue}>{field.inlineHelpText || dash}</span>
          </div>
          <div className={styles.fieldDetailRow}>
            <span className={styles.fieldDetailLabel}>Required</span>
            <span className={styles.fieldDetailValue}>{isRequired ? 'Yes' : dash}</span>
          </div>
          <div className={styles.fieldDetailRow}>
            <span className={styles.fieldDetailLabel}>Default</span>
            <span className={styles.fieldDetailValue}>
              {field.defaultValue != null ? String(field.defaultValue) : dash}
            </span>
          </div>
          <div className={styles.fieldDetailRow}>
            <span className={styles.fieldDetailLabel}>Size</span>
            <span className={styles.fieldDetailValue}>{sizeDisplay || dash}</span>
          </div>
          <div className={styles.fieldDetailRow}>
            <span className={styles.fieldDetailLabel}>Properties</span>
            <span className={styles.fieldDetailValue}>
              {properties.length > 0 ? (
                <span className={styles.propertyTags}>
                  {properties.map((prop) => (
                    <span key={prop} className={styles.propertyTag}>{prop}</span>
                  ))}
                </span>
              ) : dash}
            </span>
          </div>
          <div className={styles.fieldDetailRow}>
            <span className={styles.fieldDetailLabel}>Relationship</span>
            <span className={styles.fieldDetailValue}>
              {relationshipLoading ? '…' : resolvedRelationship || dash}
            </span>
          </div>
          {hasPicklist && (
            <div className={styles.fieldDetailRow}>
              <span className={styles.fieldDetailLabel}>Picklist</span>
              <div className={styles.picklistValues}>
                {field.picklistValues!.map((pv) => (
                  <span
                    key={pv.value}
                    className={`${styles.picklistTag}${!pv.active ? ` ${styles.inactive}` : ''}`}
                    title={pv.label !== pv.value ? `${pv.label} (${pv.value})` : pv.value}
                  >
                    {pv.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
