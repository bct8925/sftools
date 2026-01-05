// Apex Tab - Anonymous Apex Execution
import template from './apex.html?raw';
import { monaco } from '../monaco-editor/monaco-editor.js';
import { isAuthenticated } from '../../lib/utils.js';
import { executeAnonymousApex } from '../../lib/salesforce.js';

class ApexTab extends HTMLElement {
    // DOM references
    codeEditor = null;
    outputEditor = null;
    executeBtn = null;
    statusSpan = null;

    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.initEditors();
        this.attachEventListeners();
    }

    initElements() {
        this.executeBtn = this.querySelector('.apex-execute-btn');
        this.statusSpan = this.querySelector('.apex-status');
    }

    initEditors() {
        this.codeEditor = this.querySelector('.apex-editor');
        this.outputEditor = this.querySelector('.apex-output-editor');

        this.codeEditor.setValue(`// Enter your Apex code here
System.debug('Hello from Anonymous Apex!');

// Example: Query and debug accounts
List<Account> accounts = [SELECT Id, Name FROM Account LIMIT 5];
for (Account acc : accounts) {
    System.debug('Account: ' + acc.Name);
}`);

        this.outputEditor.setValue('// Output will appear here after execution');
    }

    attachEventListeners() {
        this.executeBtn.addEventListener('click', () => this.executeApex());
        this.codeEditor.addEventListener('execute', () => this.executeApex());
    }

    // ============================================================
    // UI Helpers
    // ============================================================

    setEditorMarkers(result) {
        const model = this.codeEditor.editor?.getModel();
        if (!model) return;

        monaco.editor.setModelMarkers(model, 'apex', []);

        const markers = [];

        if (!result.compiled && result.compileProblem && result.line) {
            markers.push({
                severity: monaco.MarkerSeverity.Error,
                message: result.compileProblem,
                startLineNumber: result.line,
                startColumn: result.column || 1,
                endLineNumber: result.line,
                endColumn: result.column ? result.column + 10 : model.getLineMaxColumn(result.line)
            });
        } else if (!result.success && result.exceptionMessage && result.line) {
            markers.push({
                severity: monaco.MarkerSeverity.Error,
                message: result.exceptionMessage,
                startLineNumber: result.line,
                startColumn: 1,
                endLineNumber: result.line,
                endColumn: model.getLineMaxColumn(result.line)
            });
        }

        if (markers.length > 0) {
            monaco.editor.setModelMarkers(model, 'apex', markers);
        }
    }

    formatOutput(result, debugLog) {
        const lines = [];

        if (!result.compiled) {
            lines.push('=== COMPILATION ERROR ===');
            lines.push(`Line ${result.line}, Column ${result.column || 1}`);
            lines.push(result.compileProblem);
            lines.push('');
        } else if (!result.success) {
            lines.push('=== RUNTIME EXCEPTION ===');
            if (result.line) {
                lines.push(`Line ${result.line}`);
            }
            lines.push(result.exceptionMessage || 'Unknown exception');
            if (result.exceptionStackTrace) {
                lines.push('');
                lines.push('Stack Trace:');
                lines.push(result.exceptionStackTrace);
            }
            lines.push('');
        } else {
            lines.push('=== EXECUTION SUCCESSFUL ===');
            lines.push('');
        }

        if (debugLog) {
            lines.push('=== DEBUG LOG ===');
            lines.push(debugLog);
        } else {
            lines.push('(No debug log available)');
        }

        return lines.join('\n');
    }

    updateStatus(text, type) {
        this.statusSpan.textContent = text;
        this.statusSpan.className = `status-badge${type ? ` status-${type}` : ''}`;
    }

    // ============================================================
    // Main Execution Handler
    // ============================================================

    async executeApex() {
        const apexCode = this.codeEditor.getValue().trim();

        if (!apexCode) {
            this.outputEditor.setValue('// Please enter Apex code to execute');
            return;
        }

        if (!isAuthenticated()) {
            alert('Not authenticated. Please authorize via the extension popup first.');
            return;
        }

        // Clear previous markers
        const model = this.codeEditor.editor?.getModel();
        if (model) {
            monaco.editor.setModelMarkers(model, 'apex', []);
        }

        this.executeBtn.disabled = true;

        try {
            const result = await executeAnonymousApex(apexCode, (status) => {
                this.updateStatus(status, 'loading');
                this.outputEditor.setValue(`// ${status}`);
            });

            this.setEditorMarkers(result.execution);

            if (!result.execution.compiled) {
                this.updateStatus('Compile Error', 'error');
            } else if (!result.execution.success) {
                this.updateStatus('Runtime Error', 'error');
            } else {
                this.updateStatus('Success', 'success');
            }

            this.outputEditor.setValue(this.formatOutput(result.execution, result.debugLog));

        } catch (error) {
            this.updateStatus('Error', 'error');
            this.outputEditor.setValue(`Error: ${error.message}`);
            console.error('Apex execution error:', error);
        } finally {
            this.executeBtn.disabled = false;
        }
    }
}

customElements.define('apex-tab', ApexTab);
