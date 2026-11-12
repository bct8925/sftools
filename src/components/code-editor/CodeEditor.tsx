// Code editor entry point used by every tool tab.
// Chrome build: Monaco. The VS Code build (vite.config.vscode.ts) swaps this module for
// ./NativeCodeEditor.tsx, so Monaco is not bundled into the VS Code extension.

export { MonacoEditor as CodeEditor } from '../monaco-editor/MonacoEditor';
export type { CodeEditorRef, CodeEditorProps, CodeEditorMarker, CodeEditorLanguage } from './types';
