import type { Page, Locator } from 'playwright';

/**
 * Helper class for interacting with Monaco Editor instances
 */
export class MonacoHelpers {
    private page: Page;
    private selector: string;
    private container: Locator;

    constructor(page: Page, selector: string) {
        this.page = page;
        this.selector = selector;
        this.container = page.locator(selector);
    }

    /**
     * Wait for Monaco editor to be fully initialized
     */
    async waitForReady(): Promise<void> {
        await this.page.waitForFunction(
            (sel: string) => {
                const container = document.querySelector(sel) as any;
                return container && container.editor && container.editor.getModel();
            },
            this.selector,
            { timeout: 10000 }
        );
    }

    /**
     * Get the current value of the editor
     */
    async getValue(): Promise<string> {
        return this.page.evaluate((sel: string) => {
            const container = document.querySelector(sel) as any;
            return container?.editor?.getValue() || '';
        }, this.selector);
    }

    /**
     * Set the value of the editor
     */
    async setValue(value: string): Promise<void> {
        await this.page.evaluate(
            ({ sel, val }: { sel: string; val: string }) => {
                const container = document.querySelector(sel) as any;
                container?.editor?.setValue(val);
            },
            { sel: this.selector, val: value }
        );
    }

    /**
     * Append text to the editor and scroll to bottom
     */
    async appendValue(text: string): Promise<void> {
        await this.page.evaluate(
            ({ sel, txt }: { sel: string; txt: string }) => {
                const container = document.querySelector(sel) as any;
                if (container?.appendValue) {
                    container.appendValue(txt);
                } else if (container?.editor) {
                    const model = container.editor.getModel();
                    const lastLine = model.getLineCount();
                    const lastColumn = model.getLineMaxColumn(lastLine);
                    container.editor.executeEdits('', [
                        {
                            range: {
                                startLineNumber: lastLine,
                                startColumn: lastColumn,
                                endLineNumber: lastLine,
                                endColumn: lastColumn,
                            },
                            text: txt,
                        },
                    ]);
                }
            },
            { sel: this.selector, txt: text }
        );
    }

    /**
     * Clear the editor content
     */
    async clear(): Promise<void> {
        await this.setValue('');
    }

    /**
     * Press Ctrl/Cmd+Enter to trigger execute event
     */
    async pressExecuteShortcut(): Promise<void> {
        // Focus the editor first
        await this.container.click();

        // Use Ctrl+Enter (or Cmd+Enter on Mac)
        const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
        await this.page.keyboard.press(`${modifier}+Enter`);
    }

    /**
     * Get error markers from the editor
     */
    async getMarkers(): Promise<any[]> {
        return this.page.evaluate((sel: string) => {
            const container = document.querySelector(sel) as any;
            const model = container?.editor?.getModel();
            if (!model) return [];

            // Access Monaco namespace from window
            const monaco = (window as any).monaco;
            if (!monaco) return [];

            return monaco.editor.getModelMarkers({ resource: model.uri });
        }, this.selector);
    }

    /**
     * Get the line count of the editor
     */
    async getLineCount(): Promise<number> {
        return this.page.evaluate((sel: string) => {
            const container = document.querySelector(sel) as any;
            return container?.editor?.getModel()?.getLineCount() || 0;
        }, this.selector);
    }

    /**
     * Focus a specific line in the editor
     */
    async focusLine(lineNumber: number): Promise<void> {
        await this.page.evaluate(
            ({ sel, line }: { sel: string; line: number }) => {
                const container = document.querySelector(sel) as any;
                container?.editor?.setPosition({ lineNumber: line, column: 1 });
                container?.editor?.focus();
            },
            { sel: this.selector, line: lineNumber }
        );
    }

    /**
     * Check if the editor is readonly
     */
    async isReadonly(): Promise<boolean> {
        return this.page.evaluate((sel: string) => {
            const container = document.querySelector(sel) as any;
            // Monaco readOnly option ID is 81
            return container?.editor?.getOption(81) === true;
        }, this.selector);
    }
}
