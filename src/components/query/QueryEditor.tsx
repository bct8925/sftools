// Query Editor - Monaco editor with SOQL autocomplete
import { useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { MonacoEditor, type MonacoEditorRef } from '../monaco-editor/MonacoEditor';
import {
  registerSOQLCompletionProvider,
  activateSOQLAutocomplete,
  clearState as clearAutocompleteState,
} from '../../lib/soql-autocomplete.js';

export interface QueryEditorRef {
  getValue: () => string;
  setValue: (value: string) => void;
  focus: () => void;
}

interface QueryEditorProps {
  /** Initial value for the editor */
  value?: string;
  /** Called when content changes */
  onChange?: (value: string) => void;
  /** Called on Ctrl/Cmd+Enter */
  onExecute?: () => void;
  /** Additional CSS class */
  className?: string;
}

// Track if autocomplete provider is registered (global singleton)
let autocompleteRegistered = false;

/**
 * SOQL Query Editor with Monaco and autocomplete support.
 * Wraps MonacoEditor with SOQL-specific autocomplete configuration.
 */
export const QueryEditor = forwardRef<QueryEditorRef, QueryEditorProps>(
  ({ value, onChange, onExecute, className }, ref) => {
    const editorRef = useRef<MonacoEditorRef>(null);

    // Initialize SOQL autocomplete on mount
    useEffect(() => {
      // Register provider once globally
      if (!autocompleteRegistered) {
        registerSOQLCompletionProvider();
        autocompleteRegistered = true;
      }
      // Activate for this component
      activateSOQLAutocomplete();

      // Cleanup - don't deactivate as query-tab is persistent
      return () => {
        // Note: Don't deactivate autocomplete here - the component might remount
        // and autocomplete stays active for the query tab lifetime
      };
    }, []);

    // Expose imperative methods
    useImperativeHandle(ref, () => ({
      getValue: () => editorRef.current?.getValue() ?? '',
      setValue: (val: string) => editorRef.current?.setValue(val),
      focus: () => editorRef.current?.focus(),
    }));

    const handleChange = useCallback(
      (val: string) => {
        onChange?.(val);
      },
      [onChange]
    );

    const handleExecute = useCallback(() => {
      onExecute?.();
    }, [onExecute]);

    return (
      <MonacoEditor
        ref={editorRef}
        language="sql"
        value={value}
        onChange={handleChange}
        onExecute={handleExecute}
        className={className}
        resizable={true}
      />
    );
  }
);

QueryEditor.displayName = 'QueryEditor';

// Export function to clear autocomplete state on connection change
export function clearQueryAutocompleteState(): void {
  clearAutocompleteState();
}
