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
    static observedAttributes = ['language', 'readonly', 'value', 'resizable'];

    editor = null;
    resizeHandle = null;
    isResizing = false;
    startY = 0;
    startHeight = 0;

    constructor() {
        super();
        // Custom elements are inline by default - need block to take up space
        this.style.display = 'block';
        this.style.position = 'relative';
    }

    connectedCallback() {
        this.initEditor();
        this.initResize();
    }

    disconnectedCallback() {
        this.cleanupResize();
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

    initResize() {
        // Check if resizable attribute is present and set to false
        const resizable = this.getAttribute('resizable');
        if (resizable === 'false') {
            return;
        }

        // Create resize handle
        this.resizeHandle = document.createElement('div');
        this.resizeHandle.className = 'monaco-resize-handle';
        this.appendChild(this.resizeHandle);

        // Bind event handlers
        this.handleMouseDown = this.onResizeStart.bind(this);
        this.handleMouseMove = this.onResizeMove.bind(this);
        this.handleMouseUp = this.onResizeEnd.bind(this);

        this.resizeHandle.addEventListener('mousedown', this.handleMouseDown);
    }

    cleanupResize() {
        if (this.resizeHandle) {
            this.resizeHandle.removeEventListener('mousedown', this.handleMouseDown);
            this.resizeHandle.remove();
            this.resizeHandle = null;
        }
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
    }

    onResizeStart(e) {
        e.preventDefault();
        this.isResizing = true;
        this.startY = e.clientY;
        this.startHeight = this.offsetHeight;

        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
    }

    onResizeMove(e) {
        if (!this.isResizing) return;

        const deltaY = e.clientY - this.startY;
        const newHeight = Math.max(100, this.startHeight + deltaY); // Min height 100px
        this.style.height = `${newHeight}px`;
    }

    onResizeEnd() {
        if (!this.isResizing) return;

        this.isResizing = false;
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
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
