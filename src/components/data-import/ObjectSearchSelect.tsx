// Searchable object picker for Data Import
import { useState, useCallback, useRef, useEffect } from 'react';
import { filterObjects } from '../../lib/schema-utils';
import type { SObjectDescribe } from '../../types/salesforce';
import styles from './DataImportTab.module.css';

interface ObjectSearchSelectProps {
    objects: SObjectDescribe[];
    value: string | null;
    onChange: (objectName: string | null) => void;
    disabled?: boolean;
    placeholder?: string;
}

export function ObjectSearchSelect({
    objects,
    value,
    onChange,
    disabled = false,
    placeholder = 'Search objects...',
}: ObjectSearchSelectProps) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedObject = objects.find(o => o.name === value) ?? null;
    const filtered = filterObjects(objects, query).slice(0, 50);

    const handleSelect = useCallback(
        (obj: SObjectDescribe) => {
            onChange(obj.name);
            setQuery('');
            setOpen(false);
        },
        [onChange]
    );

    const handleClear = useCallback(() => {
        onChange(null);
        setQuery('');
        setOpen(false);
    }, [onChange]);

    const handleInputFocus = useCallback(() => {
        setOpen(true);
    }, []);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
        setOpen(true);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={containerRef} className={styles.objectSearch}>
            {selectedObject && !open ? (
                <div className={styles.objectSelected}>
                    <span className={styles.objectSelectedName}>{selectedObject.label}</span>
                    <span className={styles.objectSelectedApi}>{selectedObject.name}</span>
                    {!disabled && (
                        <button
                            className={styles.objectClearBtn}
                            onClick={handleClear}
                            type="button"
                            aria-label="Clear selection"
                        >
                            ×
                        </button>
                    )}
                </div>
            ) : (
                <input
                    className="input"
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    placeholder={placeholder}
                    disabled={disabled}
                    autoComplete="off"
                />
            )}
            {open && filtered.length > 0 && (
                <ul className={styles.objectDropdown}>
                    {filtered.map(obj => (
                        <li
                            key={obj.name}
                            className={styles.objectDropdownItem}
                            onMouseDown={() => handleSelect(obj)}
                        >
                            <span className={styles.objectItemLabel}>{obj.label}</span>
                            <span className={styles.objectItemApi}>{obj.name}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
