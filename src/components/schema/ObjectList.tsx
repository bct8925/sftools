import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { SObjectDescribe } from '../../types/salesforce';
import { filterObjects } from '../../lib/schema-utils';
import { ButtonIcon } from '../button-icon/ButtonIcon';
import { icons } from '../../lib/icons';
import styles from './SchemaPage.module.css';

interface ObjectListProps {
  objects: SObjectDescribe[];
  selectedObjectName: string | null;
  isLoading: boolean;
  instanceUrl: string;
  onSelect: (objectName: string) => void;
  onRefresh: () => void;
}

/**
 * Searchable list of SObjects with filtering and selection.
 */
export function ObjectList({
  objects,
  selectedObjectName,
  isLoading,
  instanceUrl,
  onSelect,
  onRefresh,
}: ObjectListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // Filter objects based on search term
  const filteredObjects = useMemo(
    () => filterObjects(objects, searchTerm),
    [objects, searchTerm]
  );

  // Handle search input
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  // Handle object selection
  const handleObjectClick = useCallback(
    (objectName: string) => {
      onSelect(objectName);
    },
    [onSelect]
  );

  // Count display text
  const countText = useMemo(() => {
    const total = objects.length;
    const filtered = filteredObjects.length;
    return filtered === total ? `${total} objects` : `${filtered} of ${total} objects`;
  }, [objects.length, filteredObjects.length]);

  // Scroll to selected object when it changes
  useEffect(() => {
    if (selectedObjectName && listRef.current) {
      const selectedElement = listRef.current.querySelector(
        `[data-object-name="${selectedObjectName}"]`
      );
      if (selectedElement) {
        selectedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedObjectName]);

  return (
    <div className={`${styles.objectsPanel}${selectedObjectName ? ` ${styles.withFields}` : ''}`}>
      <div className={styles.objectsHeader}>
        <input
          type="text"
          className={`input ${styles.filterInput}`}
          placeholder="Filter objects..."
          value={searchTerm}
          onChange={handleSearchChange}
          data-testid="schema-object-filter"
        />
        <div className={styles.objectsHeaderRow}>
          <div className={styles.objectCount} data-testid="schema-object-count">{countText}</div>
          <ButtonIcon icon="refresh" title="Refresh objects" onClick={onRefresh} data-testid="schema-refresh-objects" />
        </div>
      </div>

      <div ref={listRef} className={styles.objectsList} data-testid="schema-objects-list">
        {isLoading ? (
          <div className={styles.loadingContainer} data-testid="schema-objects-loading">Loading objects...</div>
        ) : filteredObjects.length === 0 ? (
          <div className={styles.loadingContainer}>No objects found</div>
        ) : (
          filteredObjects.map((obj) => {
            const setupUrl = `${instanceUrl.replace('.salesforce.com', '.salesforce-setup.com')}/lightning/setup/ObjectManager/${obj.name}/Details/view`;
            return (
              <div
                key={obj.name}
                data-testid="schema-object-item"
                data-object-name={obj.name}
                className={`${styles.objectItem}${
                  obj.name === selectedObjectName ? ` ${styles.selected}` : ''
                }`}
                onClick={() => handleObjectClick(obj.name)}
              >
                <div className={styles.objectItemContent}>
                  <div className={styles.objectItemLabel}>{obj.label}</div>
                  <div className={styles.objectItemName}>{obj.name}</div>
                </div>
                <a
                  href={setupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.objectItemLink}
                  onClick={(e) => e.stopPropagation()}
                  title="Open in Salesforce Setup"
                  dangerouslySetInnerHTML={{ __html: icons.externalLink }}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * Public method to scroll to and select an object.
 * Call this when navigating from a reference field link.
 */
export function scrollToObject(
  listRef: React.RefObject<HTMLDivElement>,
  objectName: string
): void {
  if (listRef.current) {
    const element = listRef.current.querySelector(`[data-object-name="${objectName}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}
