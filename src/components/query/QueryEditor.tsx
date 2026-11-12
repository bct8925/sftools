// Query Editor - code editor with SOQL autocomplete
import { useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { CodeEditor, type CodeEditorRef } from '../code-editor/CodeEditor';
import {
    soqlCompletionSource,
    activateSOQLAutocomplete,
    deactivateSOQLAutocomplete,
    clearState as clearAutocompleteState,
} from '../../api/soql-autocomplete';

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
    /** Show/hide line numbers */
    lineNumbers?: 'on' | 'off';
    /** Enable word wrap */
    wordWrap?: 'on' | 'off';
    /** Enable SOQL autocomplete suggestions */
    autocomplete?: 'on' | 'off';
    /** Additional CSS class */
    className?: string;
}

/**
 * SOQL Query Editor with autocomplete support.
 * Wraps CodeEditor with SOQL-specific autocomplete configuration.
 */
export const QueryEditor = forwardRef<QueryEditorRef, QueryEditorProps>(
    (
        { value, onChange, onExecute, lineNumbers, wordWrap, autocomplete = 'on', className },
        ref
    ) => {
        const editorRef = useRef<CodeEditorRef>(null);

        // Initialize SOQL autocomplete on mount and react to setting changes
        useEffect(() => {
            if (autocomplete === 'on') {
                activateSOQLAutocomplete();
            } else {
                deactivateSOQLAutocomplete();
            }
        }, [autocomplete]);

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
            <CodeEditor
                ref={editorRef}
                language="sql"
                completionSource={soqlCompletionSource}
                value={value}
                onChange={handleChange}
                onExecute={handleExecute}
                lineNumbers={lineNumbers}
                wordWrap={wordWrap}
                className={className}
                resizable={true}
                data-testid="query-editor"
            />
        );
    }
);

QueryEditor.displayName = 'QueryEditor';

// Export function to clear autocomplete state on connection change
export function clearQueryAutocompleteState(): void {
    clearAutocompleteState();
}
