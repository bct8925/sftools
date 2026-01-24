import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { MonacoEditor, type MonacoEditorRef } from '../monaco-editor/MonacoEditor';
import { filterLines } from '../../lib/apex-utils';
import styles from './ApexTab.module.css';

interface ApexOutputProps {
  output: string;
}

/**
 * Debug Log output with search/filter functionality
 * Displays execution results and debug logs with line filtering
 */
export function ApexOutput({ output }: ApexOutputProps) {
  const [searchText, setSearchText] = useState('');
  const editorRef = useRef<MonacoEditorRef>(null);
  const filterTimeoutRef = useRef<number | null>(null);

  // Apply filter with debouncing for performance on large logs
  const applyFilter = useCallback(() => {
    if (!editorRef.current) return;

    const filter = searchText.trim();
    const lines = output.split('\n');
    const filtered = filterLines(lines, filter);
    const result =
      filtered.length > 0
        ? filtered.join('\n')
        : `// No lines match "${searchText}"`;

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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (filterTimeoutRef.current !== null) {
        clearTimeout(filterTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="card" data-testid="apex-output">
      <div className="card-header">
        <div className="card-header-icon" style={{ backgroundColor: '#3ba755' }}>
          L
        </div>
        <h2>Debug Log</h2>
        <div className={styles.outputSearch}>
          <input
            type="text"
            className="search-input"
            placeholder="Filter..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            data-testid="apex-search-input"
          />
        </div>
      </div>
      <div className="card-body">
        <MonacoEditor
          ref={editorRef}
          language="text"
          readonly
          className="monaco-container monaco-container-lg"
          data-testid="apex-output-editor"
        />
      </div>
    </div>
  );
}
