import { useState, useCallback, useEffect, useRef } from 'react';
import { useConnection } from '../contexts/ConnectionContext';
import { SfIcon } from '../components/sf-icon/SfIcon';
import styles from './ConnectionSelector.module.css';

/**
 * Connection selector dropdown in the header.
 * Shows active connection with a dropdown to switch between orgs.
 */
export function ConnectionSelector() {
    const { connections, activeConnection, setActiveConnection } = useConnection();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const toggle = useCallback(() => {
        if (connections.length > 1) {
            setIsOpen(prev => !prev);
        }
    }, [connections.length]);

    const handleSelect = useCallback(
        (conn: (typeof connections)[number]) => {
            setActiveConnection(conn);
            setIsOpen(false);
        },
        [setActiveConnection]
    );

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    if (!activeConnection?.label) {
        return null;
    }

    return (
        <div className={styles.connectionSelector} ref={containerRef}>
            <button
                className={styles.selectorBtn}
                onClick={toggle}
                title={activeConnection.label}
                data-testid="connection-selector-btn"
            >
                <SfIcon name="salesforce1" className={styles.sfIcon} />
                <span className={styles.label}>{activeConnection.label}</span>
                {connections.length > 1 && <SfIcon name="chevrondown" className={styles.chevron} />}
            </button>

            {isOpen && connections.length > 1 && (
                <div className={styles.dropdown} data-testid="connection-dropdown">
                    {connections.map(conn => (
                        <button
                            key={conn.id}
                            className={`${styles.dropdownItem} ${conn.id === activeConnection.id ? styles.dropdownItemActive : ''}`}
                            onClick={() => handleSelect(conn)}
                        >
                            <span className={styles.dropdownLabel}>{conn.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
