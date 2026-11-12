// VS Code build of CodeEditor (swapped in for ./CodeEditor.tsx by vite.config.vscode.ts).
// The panel shows a lightweight text view; the real editing happens in a native VS Code
// document beside the panel, which gets VS Code's own editor, language support and
// completions. Both stay in sync through the extension host.

import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
    type KeyboardEvent,
} from 'react';
import { getPlatform } from '../../platform';
import {
    EDITOR_CHANGED,
    EDITOR_COMPLETE,
    EDITOR_DISPOSE,
    EDITOR_EXECUTE,
    EDITOR_MARKERS,
    EDITOR_OPEN,
    EDITOR_UPDATE,
    type EditorDocumentInfo,
    type HostMessage,
} from '../../platform/protocol';
import type { CompletionSource } from '../../lib/completion';
import type { CodeEditorLanguage, CodeEditorMarker, CodeEditorProps, CodeEditorRef } from './types';
import styles from './NativeCodeEditor.module.css';

export type { CodeEditorRef, CodeEditorProps, CodeEditorMarker, CodeEditorLanguage };

/** How long to batch panel-side changes before syncing them to the native document */
const SYNC_DELAY_MS = 100;

let editorCounter = 0;
const completionSources = new Map<string, () => CompletionSource | undefined>();
let unregisterCompletionHandler: (() => void) | null = null;

/** File extension for the native document, which picks its VS Code language */
export function getDocumentExtension(language: CodeEditorLanguage, readonly: boolean): string {
    switch (language) {
        case 'sql':
            return 'soql';
        case 'apex':
            // Read-only Apex views are debug logs
            return readonly ? 'log' : 'apex';
        case 'json':
            return 'json';
        case 'xml':
            return 'xml';
        case 'javascript':
            return 'js';
        default:
            return 'txt';
    }
}

function ensureCompletionHandler(): void {
    if (unregisterCompletionHandler) return;
    unregisterCompletionHandler = getPlatform().onRequest(
        EDITOR_COMPLETE,
        async (message: HostMessage) => {
            const source = completionSources.get(message.docId as string)?.();
            if (!source) return [];
            return source.provide(message.text as string, message.offset as number);
        }
    );
}

export const CodeEditor = forwardRef<CodeEditorRef, CodeEditorProps>(
    (
        {
            language = 'text',
            value = '',
            onChange,
            onExecute,
            readonly = false,
            resizable = true,
            className,
            'data-testid': dataTestId,
            completionSource,
            documentName,
            openNativeEditor = false,
        },
        ref
    ) => {
        const docIdRef = useRef<string>('');
        if (!docIdRef.current) {
            docIdRef.current = `${documentName ?? language}-${++editorCounter}`;
        }
        const docId = docIdRef.current;
        const name = documentName ?? 'Untitled';
        const extension = getDocumentExtension(language, readonly);

        const [text, setText] = useState(value);
        const [markers, setMarkersState] = useState<CodeEditorMarker[]>([]);
        const textRef = useRef(value);
        const syncTimerRef = useRef<number | null>(null);
        const containerRef = useRef<HTMLDivElement>(null);
        const viewRef = useRef<HTMLTextAreaElement & HTMLPreElement>(null);
        const onChangeRef = useRef(onChange);
        const onExecuteRef = useRef(onExecute);
        const completionSourceRef = useRef(completionSource);
        onChangeRef.current = onChange;
        onExecuteRef.current = onExecute;
        completionSourceRef.current = completionSource;

        const flushToHost = useCallback(() => {
            if (syncTimerRef.current !== null) {
                window.clearTimeout(syncTimerRef.current);
                syncTimerRef.current = null;
            }
            getPlatform()
                .sendMessage({ type: EDITOR_UPDATE, docId, value: textRef.current })
                .catch(() => {});
        }, [docId]);

        const scheduleSync = useCallback(() => {
            if (syncTimerRef.current !== null) return;
            syncTimerRef.current = window.setTimeout(flushToHost, SYNC_DELAY_MS);
        }, [flushToHost]);

        const updateText = useCallback(
            (next: string, sync: boolean) => {
                textRef.current = next;
                setText(next);
                if (sync) scheduleSync();
            },
            [scheduleSync]
        );

        const openDocument = useCallback(
            (reveal: boolean) => {
                if (syncTimerRef.current !== null) {
                    window.clearTimeout(syncTimerRef.current);
                    syncTimerRef.current = null;
                }
                const info: EditorDocumentInfo = {
                    docId,
                    name,
                    extension,
                    value: textRef.current,
                    readonly,
                    reveal,
                };
                getPlatform()
                    .sendMessage({ type: EDITOR_OPEN, ...info })
                    .catch(error => console.error('[sftools] Failed to open editor:', error));
            },
            [docId, name, extension, readonly]
        );

        useImperativeHandle(ref, () => ({
            getValue: () => textRef.current,
            setValue: (val: string) => updateText(val, true),
            appendValue: (append: string) => {
                updateText(textRef.current + append, true);
                const view = viewRef.current;
                if (view) view.scrollTop = view.scrollHeight;
            },
            clear: () => updateText('', true),
            setMarkers: (next: CodeEditorMarker[]) => {
                setMarkersState(next);
                getPlatform()
                    .sendMessage({ type: EDITOR_MARKERS, docId, markers: next })
                    .catch(() => {});
            },
            clearMarkers: () => {
                setMarkersState([]);
                getPlatform()
                    .sendMessage({ type: EDITOR_MARKERS, docId, markers: [] })
                    .catch(() => {});
            },
            focus: () => viewRef.current?.focus(),
        }));

        // Register the native document, and listen for edits and Run from it
        useEffect(() => {
            const platform = getPlatform();
            openDocument(openNativeEditor);

            completionSources.set(docId, () => completionSourceRef.current);
            ensureCompletionHandler();

            const unsubscribe = platform.onMessage(message => {
                if (message.docId !== docId) return;
                if (message.type === EDITOR_CHANGED) {
                    const next = String(message.value ?? '');
                    if (next === textRef.current) return;
                    updateText(next, false);
                    onChangeRef.current?.(next);
                } else if (message.type === EDITOR_EXECUTE) {
                    onExecuteRef.current?.();
                }
            });

            return () => {
                unsubscribe();
                completionSources.delete(docId);
                if (syncTimerRef.current !== null) {
                    window.clearTimeout(syncTimerRef.current);
                }
                platform.sendMessage({ type: EDITOR_DISPOSE, docId }).catch(() => {});
            };
            // Mount-only: the document identity is fixed for the life of the editor
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        const handleInput = useCallback(
            (next: string) => {
                updateText(next, true);
                onChangeRef.current?.(next);
            },
            [updateText]
        );

        const handleKeyDown = useCallback(
            (e: KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    flushToHost();
                    onExecuteRef.current?.();
                    return;
                }
                if (e.key === 'Tab' && !e.shiftKey) {
                    e.preventDefault();
                    const target = e.currentTarget;
                    const { selectionStart, selectionEnd } = target;
                    const current = textRef.current;
                    const next =
                        current.substring(0, selectionStart) +
                        '    ' +
                        current.substring(selectionEnd);
                    handleInput(next);
                    requestAnimationFrame(() => {
                        target.selectionStart = target.selectionEnd = selectionStart + 4;
                    });
                }
            },
            [flushToHost, handleInput]
        );

        // Resize handle
        const handleResizeStart = useCallback((e: React.MouseEvent) => {
            e.preventDefault();
            const container = containerRef.current;
            if (!container) return;
            const startY = e.clientY;
            const startHeight = container.offsetHeight;
            const handleMouseMove = (moveEvent: MouseEvent) => {
                const newHeight = Math.max(100, startHeight + moveEvent.clientY - startY);
                container.style.height = `${newHeight}px`;
            };
            const handleMouseUp = () => {
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
                <div className={styles.toolbar}>
                    <span className={styles.docName}>
                        {name}.{extension}
                    </span>
                    <button
                        type="button"
                        className={styles.openButton}
                        onClick={() => openDocument(true)}
                        title="Open in a VS Code editor beside this panel"
                    >
                        Open in Editor
                    </button>
                </div>
                {readonly ? (
                    <pre ref={viewRef} className={styles.view} tabIndex={0}>
                        {text}
                    </pre>
                ) : (
                    <textarea
                        ref={viewRef}
                        className={styles.view}
                        value={text}
                        spellCheck={false}
                        onChange={e => handleInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={flushToHost}
                    />
                )}
                {markers.length > 0 && (
                    <ul className={styles.markers}>
                        {markers.map((marker, i) => (
                            <li key={i} className={styles[marker.severity ?? 'error']}>
                                Line {marker.line}: {marker.message}
                            </li>
                        ))}
                    </ul>
                )}
                {resizable && (
                    <div className={styles.resizeHandle} onMouseDown={handleResizeStart} />
                )}
            </div>
        );
    }
);

CodeEditor.displayName = 'CodeEditor';
