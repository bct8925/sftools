// Code editor entry point used by every tool tab.
// Monaco in both builds; see ../monaco-editor/editor-host.ts for the VS Code differences.

export { MonacoEditor as CodeEditor } from '../monaco-editor/MonacoEditor';
export type { CodeEditorRef, CodeEditorProps, CodeEditorMarker, CodeEditorLanguage } from './types';
