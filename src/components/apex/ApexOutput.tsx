import { useState, useCallback, useRef, useEffect } from 'react';
import { MonacoEditor, type MonacoEditorRef } from '../monaco-editor/MonacoEditor';
import { CollapseChevron } from '../collapse-chevron/CollapseChevron';
import { filterLines } from '../../lib/apex-utils';
import styles from './ApexTab.module.css';

interface ApexOutputProps {
    output: string;
    className?: string;
}

/**
 * Debug Log output with search/filter functionality
 * Displays execution results and debug logs with line filtering
 */
export function ApexOutput({ output, className }: ApexOutputProps) {
    const [searchText, setSearchText] = useState('');
    const [isCollapsed, setIsCollapsed] = useState(false);
    const handleToggle = useCallback(() => setIsCollapsed(prev => !prev), []);
    const editorRef = useRef<MonacoEditorRef>(null);
    const filterTimeoutRef = useRef<number | null>(null);

    // Apply filter with debouncing for performance on large logs
    const applyFilter = useCallback(() => {
        if (!editorRef.current) return;

        const filter = searchText.trim();
        const lines = output.split('\n');
        const filtered = filterLines(lines, filter);
        const result =
            filtered.length > 0 ? filtered.join('\n') : `// No lines match "${searchText}"`;

        editorRef.current.setValue(result);
    }, [output, searchText]);

    // Debounce filter application
    useEffect(() => {
        if (filterTimeoutRef.current !== null) {
            clearTimeout(filterTimeoutRef.current);
        }

        filterTimeoutRef.current = window.setTimeout(() => {
            applyFilter();
        }, 200);

        return () => {
            if (filterTimeoutRef.current !== null) {
                clearTimeout(filterTimeoutRef.current);
            }
        };
    }, [applyFilter]);

    return (
        <div
            className={`card ${className || ''}${isCollapsed ? ` ${styles.outputCardCollapsed}` : ''}`}
            data-testid="apex-output"
        >
            <div className="card-header">
                <div className={`card-header-icon ${styles.outputHeaderIcon}`}>L</div>
                <h2 className="card-collapse-title" onClick={handleToggle}>
                    Debug Log
                </h2>
                <CollapseChevron isOpen={!isCollapsed} onClick={handleToggle} />
                <div className={styles.outputSearch}>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Filter..."
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        data-testid="apex-search-input"
                    />
                </div>
            </div>
            <div className={`card-body ${styles.outputCardBody}`} hidden={isCollapsed}>
                <MonacoEditor
                    ref={editorRef}
                    language="apex"
                    readonly
                    resizable={false}
                    className={styles.outputEditor}
                    data-testid="apex-output-editor"
                />
            </div>
        </div>
    );
}
