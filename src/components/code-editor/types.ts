// Shared contract for the code editor used by the tool tabs.
// Chrome renders it with Monaco (../monaco-editor/MonacoEditor.tsx); the VS Code
// extension renders it with native VS Code documents (./NativeCodeEditor.tsx).

import type { CompletionSource } from '../../lib/completion';

export type CodeEditorLanguage = 'sql' | 'apex' | 'json' | 'xml' | 'javascript' | 'text';

export interface CodeEditorMarker {
    message: string;
    /** 1-based line number */
    line: number;
    /** 1-based start column (defaults to 1) */
    startColumn?: number;
    /** 1-based end column (defaults to the end of the line) */
    endColumn?: number;
    severity?: 'error' | 'warning' | 'info';
}

export interface CodeEditorRef {
    /** Get the current editor content */
    getValue: () => string;
    /** Set the editor content */
    setValue: (value: string) => void;
    /** Append text to the end (useful for streaming output) */
    appendValue: (text: string) => void;
    /** Clear all editor content */
    clear: () => void;
    /** Set error markers on the editor */
    setMarkers: (markers: CodeEditorMarker[]) => void;
    /** Clear all markers */
    clearMarkers: () => void;
    /** Focus the editor */
    focus: () => void;
}

export interface CodeEditorProps {
    /** Editor language mode */
    language?: CodeEditorLanguage;
    /** Initial value */
    value?: string;
    /** Called when content changes */
    onChange?: (value: string) => void;
    /** Called on Ctrl/Cmd+Enter */
    onExecute?: () => void;
    /** Make editor read-only */
    readonly?: boolean;
    /** Enable vertical resize handle */
    resizable?: boolean;
    /** Show/hide line numbers */
    lineNumbers?: 'on' | 'off';
    /** Enable word wrap */
    wordWrap?: 'on' | 'off';
    /** Additional CSS class */
    className?: string;
    /** Test ID for the container element */
    'data-testid'?: string;
    /** Completion suggestions for this editor only */
    completionSource?: CompletionSource;
    /**
     * VS Code only: name for the native document (e.g. "Query"), and whether the
     * native editor opens automatically when the tool opens.
     */
    documentName?: string;
    openNativeEditor?: boolean;
}
