import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
} from 'react';
import Editor, { loader, type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { monaco } from '../../lib/monaco-custom.js';
import { useMonacoTheme } from './useMonacoTheme';
import styles from './MonacoEditor.module.css';

// Configure @monaco-editor/react to use our custom Monaco instance
loader.config({ monaco });

export type MonacoLanguage = 'sql' | 'apex' | 'json' | 'xml' | 'javascript' | 'text';

export interface MonacoEditorRef {
  /** Get the current editor content */
  getValue: () => string;
  /** Set the editor content */
  setValue: (value: string) => void;
  /** Append text to the end (useful for streaming output) */
  appendValue: (text: string) => void;
  /** Clear all editor content */
  clear: () => void;
  /** Set error markers on the editor */
  setMarkers: (markers: editor.IMarkerData[]) => void;
  /** Clear all markers */
  clearMarkers: () => void;
  /** Focus the editor */
  focus: () => void;
  /** Get the underlying Monaco editor instance */
  getEditor: () => editor.IStandaloneCodeEditor | null;
}

interface MonacoEditorProps {
  /** Editor language mode */
  language?: MonacoLanguage;
  /** Initial/controlled value */
  value?: string;
  /** Called when content changes */
  onChange?: (value: string) => void;
  /** Called on Ctrl/Cmd+Enter */
  onExecute?: () => void;
  /** Make editor read-only */
  readonly?: boolean;
  /** Enable vertical resize handle */
  resizable?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Test ID for the container element */
  'data-testid'?: string;
}

/**
 * React Monaco Editor using @monaco-editor/react with custom sftools setup.
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
      className,
      'data-testid': dataTestId,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const onExecuteRef = useRef(onExecute);

    // Keep onExecute ref up to date for the keybinding
    onExecuteRef.current = onExecute;

    // Sync theme with document
    const theme = useMonacoTheme();

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
      setMarkers: (markers: editor.IMarkerData[]) => {
        const model = editorRef.current?.getModel();
        if (model) {
          monaco.editor.setModelMarkers(model, 'sftools', markers);
        }
      },
      clearMarkers: () => {
        const model = editorRef.current?.getModel();
        if (model) {
          monaco.editor.setModelMarkers(model, 'sftools', []);
        }
      },
      focus: () => editorRef.current?.focus(),
      getEditor: () => editorRef.current,
    }));

    // Handle editor mount
    const handleMount: OnMount = useCallback((editor) => {
      editorRef.current = editor;

      // Expose editor on container element for test helpers
      if (containerRef.current) {
        (containerRef.current as any).editor = editor;
      }

      // Add Ctrl+Enter execute action
      editor.addAction({
        id: 'execute',
        label: 'Execute',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        run: () => {
          onExecuteRef.current?.();
        },
      });
    }, []);

    // Handle content changes
    const handleChange = useCallback(
      (val: string | undefined) => {
        onChange?.(val ?? '');
      },
      [onChange]
    );

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
        <Editor
          language={language === 'text' ? 'plaintext' : language}
          value={value}
          onChange={handleChange}
          onMount={handleMount}
          theme={theme}
          options={{
            readOnly: readonly,
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            fontSize: 13,
          }}
        />
        {resizable && (
          <div
            className={styles.resizeHandle}
            onMouseDown={handleResizeStart}
          />
        )}
      </div>
    );
  }
);

MonacoEditor.displayName = 'MonacoEditor';

// Re-export monaco for advanced use cases
export { monaco };
