// Monaco Editor Web Component
// Custom import with only the languages we need (sql, apex, json, xml, javascript)
import { monaco } from '../../lib/monaco-custom.js';
import type { editor } from 'monaco-editor';

// Suppress Monaco's internal "Canceled" promise rejections (benign cleanup noise)
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    if ((event.reason as Error | undefined)?.name === 'Canceled') {
        event.preventDefault();
    }
});

// Define custom themes that read from CSS variables
function defineCustomThemes(): void {
    // Get computed styles to read CSS variable values
    const styles = getComputedStyle(document.documentElement);
    const navBg = styles.getPropertyValue('--nav-bg').trim();

    // Define custom light theme
    monaco.editor.defineTheme('sftools-light', {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': navBg,
            'editorGutter.background': navBg,
        },
    });

    // Define custom dark theme
    monaco.editor.defineTheme('sftools-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': navBg,
            'editorGutter.background': navBg,
        },
    });
}

// Initialize custom themes on first load
defineCustomThemes();

function getMonacoTheme(): string {
    return document.documentElement.getAttribute('data-theme') === 'dark'
        ? 'sftools-dark'
        : 'sftools-light';
}

const defaultOptions: editor.IStandaloneEditorConstructionOptions = {
    minimap: { enabled: false },
    automaticLayout: true,
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    fontSize: 13,
};

class MonacoEditor extends HTMLElement {
    static observedAttributes = ['language', 'readonly', 'value', 'resizable'];

    public editor: editor.IStandaloneCodeEditor | null = null;
    private resizeHandle: HTMLDivElement | null = null;
    private isResizing = false;
    private startY = 0;
    private startHeight = 0;
    private themeObserver: MutationObserver | null = null;
    private handleMouseDown!: (e: MouseEvent) => void;
    private handleMouseMove!: (e: MouseEvent) => void;
    private handleMouseUp!: () => void;

    constructor() {
        super();
        // Custom elements are inline by default - need block to take up space
        this.style.display = 'block';
        this.style.position = 'relative';
    }

    connectedCallback(): void {
        this.initEditor();
        this.initResize();
        this.initThemeListener();
    }

    disconnectedCallback(): void {
        this.cleanupResize();
        this.cleanupThemeListener();
        if (this.editor) {
            this.editor.dispose();
            this.editor = null;
        }
    }

    private initEditor(): void {
        const language = this.getAttribute('language') || 'text';
        const readonly = this.hasAttribute('readonly');
        const value = this.getAttribute('value') || '';

        this.editor = monaco.editor.create(this, {
            ...defaultOptions,
            theme: getMonacoTheme(),
            language,
            readOnly: readonly,
            value,
        });

        // Dispatch execute event on Ctrl/Cmd+Enter
        this.editor.addAction({
            id: 'execute',
            label: 'Execute',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
            run: () => {
                this.dispatchEvent(new CustomEvent('execute', { bubbles: true }));
            },
        });
    }

    private initThemeListener(): void {
        // Watch for data-theme attribute changes on documentElement
        this.themeObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.attributeName === 'data-theme') {
                    this.updateEditorTheme();
                }
            }
        });
        this.themeObserver.observe(document.documentElement, { attributes: true });
    }

    private cleanupThemeListener(): void {
        if (this.themeObserver) {
            this.themeObserver.disconnect();
            this.themeObserver = null;
        }
    }

    private updateEditorTheme(): void {
        if (this.editor) {
            // Redefine themes with current CSS variable values
            defineCustomThemes();
            monaco.editor.setTheme(getMonacoTheme());
        }
    }

    private initResize(): void {
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

    private cleanupResize(): void {
        if (this.resizeHandle) {
            this.resizeHandle.removeEventListener('mousedown', this.handleMouseDown);
            this.resizeHandle.remove();
            this.resizeHandle = null;
        }
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
    }

    private onResizeStart(e: MouseEvent): void {
        e.preventDefault();
        this.isResizing = true;
        this.startY = e.clientY;
        this.startHeight = this.offsetHeight;

        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
    }

    private onResizeMove(e: MouseEvent): void {
        if (!this.isResizing) return;

        const deltaY = e.clientY - this.startY;
        const newHeight = Math.max(100, this.startHeight + deltaY); // Min height 100px
        this.style.height = `${newHeight}px`;
    }

    private onResizeEnd(): void {
        if (!this.isResizing) return;

        this.isResizing = false;
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }

    attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
        if (!this.editor) return;

        if (name === 'language') {
            monaco.editor.setModelLanguage(this.editor.getModel()!, newValue || 'text');
        } else if (name === 'readonly') {
            this.editor.updateOptions({ readOnly: this.hasAttribute('readonly') });
        } else if (name === 'value' && newValue !== this.editor.getValue()) {
            this.editor.setValue(newValue || '');
        }
    }

    public getValue(): string {
        return this.editor?.getValue() || '';
    }

    public setValue(value: string): void {
        this.editor?.setValue(value);
    }

    // Convenience method to append text (useful for streaming output)
    public appendValue(text: string): void {
        if (!this.editor) return;
        const model = this.editor.getModel()!;
        const lastLine = model.getLineCount();
        const lastCol = model.getLineMaxColumn(lastLine);
        this.editor.executeEdits('append', [
            {
                range: new monaco.Range(lastLine, lastCol, lastLine, lastCol),
                text: text,
            },
        ]);
        this.editor.revealLine(model.getLineCount());
    }

    // Clear all editor content
    public clear(): void {
        this.editor?.setValue('');
    }

    // Set error markers on the editor
    public setMarkers(markers: editor.IMarkerData[]): void {
        if (!this.editor) return;
        monaco.editor.setModelMarkers(this.editor.getModel()!, 'owner', markers);
    }

    // Clear all markers
    public clearMarkers(): void {
        this.setMarkers([]);
    }
}

customElements.define('monaco-editor', MonacoEditor);

export { monaco };
