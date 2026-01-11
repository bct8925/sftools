// Monaco Editor Web Component
// Custom import with only the languages we need (sql, apex, json, xml, javascript)
import { monaco } from '../../lib/monaco-custom.js';

const defaultOptions = {
    theme: 'vs-dark',
    minimap: { enabled: false },
    automaticLayout: true,
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    fontSize: 13
};

class MonacoEditor extends HTMLElement {
    static observedAttributes = ['language', 'readonly', 'value'];

    editor = null;

    constructor() {
        super();
        // Custom elements are inline by default - need block to take up space
        this.style.display = 'block';
    }

    connectedCallback() {
        this.initEditor();
    }

    disconnectedCallback() {
        if (this.editor) {
            this.editor.dispose();
            this.editor = null;
        }
    }

    initEditor() {
        const language = this.getAttribute('language') || 'text';
        const readonly = this.hasAttribute('readonly');
        const value = this.getAttribute('value') || '';

        this.editor = monaco.editor.create(this, {
            ...defaultOptions,
            language,
            readOnly: readonly,
            value
        });

        // Dispatch execute event on Ctrl/Cmd+Enter
        this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            this.dispatchEvent(new CustomEvent('execute', { bubbles: true }));
        });
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (!this.editor) return;

        if (name === 'language') {
            monaco.editor.setModelLanguage(this.editor.getModel(), newValue);
        } else if (name === 'readonly') {
            this.editor.updateOptions({ readOnly: this.hasAttribute('readonly') });
        } else if (name === 'value' && newValue !== this.editor.getValue()) {
            this.editor.setValue(newValue || '');
        }
    }

    getValue() {
        return this.editor?.getValue() || '';
    }

    setValue(value) {
        this.editor?.setValue(value);
    }

    // Convenience method to append text (useful for streaming output)
    appendValue(text) {
        if (!this.editor) return;
        const model = this.editor.getModel();
        const lastLine = model.getLineCount();
        const lastCol = model.getLineMaxColumn(lastLine);
        this.editor.executeEdits('append', [{
            range: new monaco.Range(lastLine, lastCol, lastLine, lastCol),
            text: text
        }]);
        this.editor.revealLine(model.getLineCount());
    }

    // Clear all editor content
    clear() {
        this.editor?.setValue('');
    }

    // Set error markers on the editor
    setMarkers(markers) {
        if (!this.editor) return;
        monaco.editor.setModelMarkers(this.editor.getModel(), 'owner', markers);
    }

    // Clear all markers
    clearMarkers() {
        this.setMarkers([]);
    }
}

customElements.define('monaco-editor', MonacoEditor);

export { monaco };
