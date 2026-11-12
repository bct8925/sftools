import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import type { editor } from 'monaco-editor';
import { monaco } from '../../lib/monaco-custom';
import { mergeCompletionSources } from '../../lib/completion';
import { registerMonacoCompletionSource } from './completion-provider';
import {
    hostCompletionSource,
    hostEditorOptions,
    prepareEditorLanguage,
    useEditorTheme,
} from './editor-host';
import type {
    CodeEditorLanguage,
    CodeEditorMarker,
    CodeEditorProps,
    CodeEditorRef,
} from '../code-editor/types';
import styles from './MonacoEditor.module.css';

export type MonacoLanguage = CodeEditorLanguage;

export type MonacoEditorRef = CodeEditorRef;

type MonacoEditorProps = CodeEditorProps;

function toMarkerSeverity(severity: CodeEditorMarker['severity']): monaco.MarkerSeverity {
    switch (severity) {
        case 'warning':
            return monaco.MarkerSeverity.Warning;
        case 'info':
            return monaco.MarkerSeverity.Info;
        default:
            return monaco.MarkerSeverity.Error;
    }
}

function toMarkerData(model: editor.ITextModel, marker: CodeEditorMarker): editor.IMarkerData {
    const lineCount = model.getLineCount();
    const line = Math.min(Math.max(1, marker.line), lineCount);
    return {
        severity: toMarkerSeverity(marker.severity),
        message: marker.message,
        startLineNumber: line,
        startColumn: marker.startColumn ?? 1,
        endLineNumber: line,
        endColumn: marker.endColumn ?? model.getLineMaxColumn(line),
    };
}

function mapLanguage(language: MonacoLanguage): string {
    return language === 'text' ? 'plaintext' : language;
}

/**
 * React Monaco Editor wrapper that drives the locally-bundled Monaco instance
 * directly (no `@monaco-editor/react`/`@monaco-editor/loader` dependency).
 *
 * Avoiding the loader is required to keep the extension free of any reference
 * to a remote CDN URL — otherwise the Chrome Web Store flags it as remotely
 * hosted code under Manifest V3.
 *
 * Supports theme synchronization, resize handle, and Ctrl+Enter execute.
 */
export const MonacoEditor = forwardRef<MonacoEditorRef, MonacoEditorProps>(
    (
        {
            language = 'text',
            value = '',
            onChange,
            onExecute,
            readonly = false,
            resizable = true,
            lineNumbers = 'on',
            wordWrap = 'off',
            className,
            'data-testid': dataTestId,
            completionSource,
        },
        ref
    ) => {
        const containerRef = useRef<HTMLDivElement>(null);
        const editorMountRef = useRef<HTMLDivElement>(null);
        const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
        const onChangeRef = useRef(onChange);
        const onExecuteRef = useRef(onExecute);

        // Keep callback refs current so the change/execute listeners stay
        // stable across renders without recreating the editor instance.
        onChangeRef.current = onChange;
        onExecuteRef.current = onExecute;

        // Sync theme with the host (sftools' theme in Chrome, the color theme in VS Code)
        const theme = useEditorTheme();
        prepareEditorLanguage(language);

        // Expose imperative methods
        useImperativeHandle(ref, () => ({
            getValue: () => editorRef.current?.getValue() ?? '',
            setValue: (val: string) => editorRef.current?.setValue(val),
            appendValue: (text: string) => {
                const ed = editorRef.current;
                if (!ed) return;
                const model = ed.getModel();
                if (!model) return;
                const lastLine = model.getLineCount();
                const lastCol = model.getLineMaxColumn(lastLine);
                ed.executeEdits('append', [
                    {
                        range: new monaco.Range(lastLine, lastCol, lastLine, lastCol),
                        text,
                    },
                ]);
                ed.revealLine(model.getLineCount());
            },
            clear: () => editorRef.current?.setValue(''),
            setMarkers: (markers: CodeEditorMarker[]) => {
                const model = editorRef.current?.getModel();
                if (model) {
                    monaco.editor.setModelMarkers(
                        model,
                        'sftools',
                        markers.map(m => toMarkerData(model, m))
                    );
                }
            },
            clearMarkers: () => {
                const model = editorRef.current?.getModel();
                if (model) {
                    monaco.editor.setModelMarkers(model, 'sftools', []);
                }
            },
            focus: () => editorRef.current?.focus(),
        }));

        // Create the editor on mount, dispose on unmount. Initial-only props
        // (value, language, theme, options) are read once here. Subsequent
        // prop changes are handled by the dedicated effects below.
        useEffect(() => {
            const mountTarget = editorMountRef.current;
            if (!mountTarget) return;

            const editorInstance = monaco.editor.create(mountTarget, {
                value,
                language: mapLanguage(language),
                theme,
                readOnly: readonly,
                minimap: { enabled: false },
                automaticLayout: true,
                scrollBeyondLastLine: false,
                lineNumbers,
                lineNumbersMinChars: lineNumbers === 'on' ? 3 : 0,
                lineDecorationsWidth: lineNumbers === 'on' ? undefined : 6,
                wordWrap,
                ...hostEditorOptions(),
            });

            editorRef.current = editorInstance;

            // Expose editor on container element for test helpers
            if (containerRef.current) {
                (containerRef.current as any).editor = editorInstance;
            }

            // Add Ctrl+Enter execute action
            editorInstance.addAction({
                id: 'execute',
                label: 'Execute',
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
                run: () => {
                    onExecuteRef.current?.();
                },
            });

            // Forward content changes via the ref so prop updates don't
            // require recreating the editor.
            const changeSubscription = editorInstance.onDidChangeModelContent(() => {
                onChangeRef.current?.(editorInstance.getValue());
            });

            return () => {
                changeSubscription.dispose();
                editorInstance.dispose();
                editorRef.current = null;
                if (containerRef.current) {
                    delete (containerRef.current as any).editor;
                }
            };
            // Mount-only: subsequent prop changes flow through the effects below.
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        // The editor's own suggestions first, then the host's (VS Code's providers)
        const mergedCompletionSource = useMemo(
            () =>
                mergeCompletionSources(
                    completionSource,
                    readonly ? undefined : hostCompletionSource(language)
                ),
            [completionSource, language, readonly]
        );

        // Register completions that apply to this editor's model only
        useEffect(() => {
            const editorInstance = editorRef.current;
            if (!mergedCompletionSource || !editorInstance) return;
            const disposable = registerMonacoCompletionSource(
                mapLanguage(language),
                mergedCompletionSource,
                model => model === editorInstance.getModel()
            );
            return () => disposable.dispose();
        }, [mergedCompletionSource, language]);

        // Update language when the prop changes
        useEffect(() => {
            const model = editorRef.current?.getModel();
            if (model) {
                monaco.editor.setModelLanguage(model, mapLanguage(language));
            }
        }, [language]);

        // Update theme when the resolved theme changes
        useEffect(() => {
            if (editorRef.current) {
                monaco.editor.setTheme(theme);
            }
        }, [theme]);

        // Update reactive editor options when the relevant props change
        useEffect(() => {
            editorRef.current?.updateOptions({
                readOnly: readonly,
                lineNumbers,
                lineNumbersMinChars: lineNumbers === 'on' ? 3 : 0,
                lineDecorationsWidth: lineNumbers === 'on' ? undefined : 6,
                wordWrap,
            });
        }, [readonly, lineNumbers, wordWrap]);

        // Resize handle logic
        const resizeStateRef = useRef({ isResizing: false, startY: 0, startHeight: 0 });

        const handleResizeStart = useCallback((e: React.MouseEvent) => {
            e.preventDefault();
            if (!containerRef.current) return;

            resizeStateRef.current = {
                isResizing: true,
                startY: e.clientY,
                startHeight: containerRef.current.offsetHeight,
            };

            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';

            const handleMouseMove = (moveEvent: MouseEvent) => {
                if (!resizeStateRef.current.isResizing || !containerRef.current) return;
                const deltaY = moveEvent.clientY - resizeStateRef.current.startY;
                const newHeight = Math.max(100, resizeStateRef.current.startHeight + deltaY);
                containerRef.current.style.height = `${newHeight}px`;
            };

            const handleMouseUp = () => {
                resizeStateRef.current.isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }, []);

        return (
            <div
                ref={containerRef}
                className={`${styles.container}${className ? ` ${className}` : ''}`}
                data-testid={dataTestId}
            >
                <div ref={editorMountRef} className={styles.editorMount} />
                {resizable && (
                    <div className={styles.resizeHandle} onMouseDown={handleResizeStart} />
                )}
            </div>
        );
    }
);

MonacoEditor.displayName = 'MonacoEditor';

// Re-export monaco for advanced use cases
export { monaco };
