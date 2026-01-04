// Anonymous Apex Execution Tab Module - UI Controller
import { createEditor, createReadOnlyEditor, monaco } from '../lib/monaco.js';
import { isAuthenticated } from '../lib/utils.js';
import { executeAnonymousApex } from '../lib/salesforce.js';

let codeEditor = null;
let outputEditor = null;

// ============================================================
// UI Helpers
// ============================================================

/**
 * Set Monaco editor markers for compilation/runtime errors
 */
function setEditorMarkers(editor, result) {
    const model = editor.getModel();
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

/**
 * Format the output for the output editor
 */
function formatOutput(result, debugLog) {
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

/**
 * Update status display
 */
function updateStatus(text, type) {
    const statusSpan = document.getElementById('apex-status');
    statusSpan.textContent = text;
    statusSpan.className = `status-badge${type ? ` status-${type}` : ''}`;
}

// ============================================================
// Main Execution Handler
// ============================================================

/**
 * Execute anonymous Apex (main entry point)
 */
async function executeApex() {
    const apexCode = codeEditor.getValue().trim();

    if (!apexCode) {
        outputEditor.setValue('// Please enter Apex code to execute');
        return;
    }

    if (!isAuthenticated()) {
        alert('Not authenticated. Please authorize via the extension popup first.');
        return;
    }

    // Clear previous markers
    const model = codeEditor.getModel();
    if (model) {
        monaco.editor.setModelMarkers(model, 'apex', []);
    }

    const executeBtn = document.getElementById('apex-execute-btn');
    executeBtn.disabled = true;

    try {
        const result = await executeAnonymousApex(apexCode, (status) => {
            updateStatus(status, 'loading');
            outputEditor.setValue(`// ${status}`);
        });

        setEditorMarkers(codeEditor, result.execution);

        if (!result.execution.compiled) {
            updateStatus('Compile Error', 'error');
        } else if (!result.execution.success) {
            updateStatus('Runtime Error', 'error');
        } else {
            updateStatus('Success', 'success');
        }

        outputEditor.setValue(formatOutput(result.execution, result.debugLog));

    } catch (error) {
        updateStatus('Error', 'error');
        outputEditor.setValue(`Error: ${error.message}`);
        console.error('Apex execution error:', error);
    } finally {
        executeBtn.disabled = false;
    }
}

// ============================================================
// Initialization
// ============================================================

export function init() {
    const codeContainer = document.getElementById('apex-editor');
    const outputContainer = document.getElementById('apex-output-editor');
    const executeBtn = document.getElementById('apex-execute-btn');

    codeEditor = createEditor(codeContainer, {
        value: `// Enter your Apex code here
System.debug('Hello from Anonymous Apex!');

// Example: Query and debug accounts
List<Account> accounts = [SELECT Id, Name FROM Account LIMIT 5];
for (Account acc : accounts) {
    System.debug('Account: ' + acc.Name);
}`,
        language: 'apex'
    });

    outputEditor = createReadOnlyEditor(outputContainer, {
        value: '// Output will appear here after execution',
        language: 'text'
    });

    executeBtn.addEventListener('click', executeApex);

    codeEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        executeApex();
    });
}
