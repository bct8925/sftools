// Monaco Editor setup for Chrome Extension compatibility
import * as monaco from 'monaco-editor';

import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker&inline';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker&inline';

self.MonacoEnvironment = {
    getWorker: function (_, label) {
        if (label === 'json') return new jsonWorker();
        return new editorWorker();
    }
};

// Default editor options
const defaultOptions = {
    theme: 'vs-dark',
    minimap: { enabled: false },
    automaticLayout: true,
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    fontSize: 13
};

/**
 * Create a Monaco editor instance with default options
 * @param {HTMLElement} container - The container element
 * @param {Object} options - Editor options to merge with defaults
 * @returns {monaco.editor.IStandaloneCodeEditor}
 */
export function createEditor(container, options = {}) {
    return monaco.editor.create(container, {
        ...defaultOptions,
        ...options
    });
}

/**
 * Create a read-only Monaco editor for displaying output
 * @param {HTMLElement} container - The container element
 * @param {Object} options - Additional options
 * @returns {monaco.editor.IStandaloneCodeEditor}
 */
export function createReadOnlyEditor(container, options = {}) {
    return createEditor(container, {
        readOnly: true,
        ...options
    });
}

export { monaco };
