// Anonymous Apex Execution Tab Module
import { createEditor, createReadOnlyEditor, monaco } from '../lib/monaco.js';
import { extensionFetch, getAccessToken, getInstanceUrl, isAuthenticated } from '../lib/utils.js';

let codeEditor = null;
let outputEditor = null;

const API_VERSION = '62.0';

// Default debug log levels for comprehensive logging
const DEBUG_LEVELS = {
    Apex_code: 'FINEST',
    Apex_profiling: 'INFO',
    Callout: 'INFO',
    Database: 'INFO',
    System: 'DEBUG',
    Validation: 'INFO',
    Visualforce: 'INFO',
    Workflow: 'INFO'
};

/**
 * Build the SOAP envelope for executeAnonymous with DebuggingHeader
 */
function buildSoapEnvelope(apexCode, sessionId) {
    // XML-escape the apex code
    const escapedCode = apexCode
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    // Build debug level categories
    const categories = Object.entries(DEBUG_LEVELS)
        .map(([category, level]) => `<categories><category>${category}</category><level>${level}</level></categories>`)
        .join('\n                ');

    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:apex="http://soap.sforce.com/2006/08/apex">
    <soapenv:Header>
        <apex:SessionHeader>
            <apex:sessionId>${sessionId}</apex:sessionId>
        </apex:SessionHeader>
        <apex:DebuggingHeader>
            ${categories}
        </apex:DebuggingHeader>
    </soapenv:Header>
    <soapenv:Body>
        <apex:executeAnonymous>
            <apex:String>${escapedCode}</apex:String>
        </apex:executeAnonymous>
    </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Parse the SOAP response for execution result
 */
function parseSoapResponse(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    // Check for SOAP fault
    const fault = doc.querySelector('Fault');
    if (fault) {
        const faultString = fault.querySelector('faultstring')?.textContent || 'Unknown SOAP fault';
        return {
            success: false,
            compiled: false,
            error: faultString
        };
    }

    // Get the executeAnonymousResponse
    const result = doc.querySelector('result');
    if (!result) {
        return {
            success: false,
            compiled: false,
            error: 'Invalid response: no result element found'
        };
    }

    const compiled = result.querySelector('compiled')?.textContent === 'true';
    const success = result.querySelector('success')?.textContent === 'true';
    const compileProblem = result.querySelector('compileProblem')?.textContent || null;
    const exceptionMessage = result.querySelector('exceptionMessage')?.textContent || null;
    const exceptionStackTrace = result.querySelector('exceptionStackTrace')?.textContent || null;
    const line = parseInt(result.querySelector('line')?.textContent, 10) || null;
    const column = parseInt(result.querySelector('column')?.textContent, 10) || null;

    return {
        compiled,
        success,
        compileProblem,
        exceptionMessage,
        exceptionStackTrace,
        line,
        column
    };
}

/**
 * Set Monaco editor markers for compilation/runtime errors
 */
function setEditorMarkers(editor, result) {
    const model = editor.getModel();
    if (!model) return;

    // Clear existing markers
    monaco.editor.setModelMarkers(model, 'apex', []);

    const markers = [];

    if (!result.compiled && result.compileProblem && result.line) {
        // Compilation error
        markers.push({
            severity: monaco.MarkerSeverity.Error,
            message: result.compileProblem,
            startLineNumber: result.line,
            startColumn: result.column || 1,
            endLineNumber: result.line,
            endColumn: result.column ? result.column + 10 : model.getLineMaxColumn(result.line)
        });
    } else if (!result.success && result.exceptionMessage && result.line) {
        // Runtime exception
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
        lines.push('(No debug log returned)');
    }

    return lines.join('\n');
}

/**
 * Execute anonymous Apex via SOAP API
 */
async function executeApex() {
    const apexCode = codeEditor.getValue().trim();

    if (!apexCode) {
        outputEditor.setValue('// Please enter Apex code to execute');
        return;
    }

    if (!isAuthenticated()) {
        outputEditor.setValue('// Not authenticated. Please authorize via the extension popup first.');
        return;
    }

    // Clear previous markers
    const model = codeEditor.getModel();
    if (model) {
        monaco.editor.setModelMarkers(model, 'apex', []);
    }

    // Update UI
    const statusSpan = document.getElementById('apex-status');
    const executeBtn = document.getElementById('apex-execute-btn');

    statusSpan.textContent = 'Executing...';
    statusSpan.className = 'status-badge status-loading';
    executeBtn.disabled = true;
    outputEditor.setValue('// Executing Apex...');

    try {
        const soapEndpoint = `${getInstanceUrl()}/services/Soap/s/${API_VERSION}`;
        const soapEnvelope = buildSoapEnvelope(apexCode, getAccessToken());

        const response = await extensionFetch(soapEndpoint, {
            'Authorization': `Bearer ${getAccessToken()}`,
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=UTF-8',
                'SOAPAction': '""'
            },
            body: soapEnvelope
        });

        // Get debug log from response headers (if available through the proxy)
        let debugLog = response.headers?.['sforce-debug-log'] ||
                       response.headers?.['Sforce-Debug-Log'] ||
                       null;

        // Parse the SOAP response
        const result = parseSoapResponse(response.data);

        // If there's an error in the result object itself (SOAP fault)
        if (result.error) {
            statusSpan.textContent = 'Error';
            statusSpan.className = 'status-badge status-error';
            outputEditor.setValue(`Error: ${result.error}`);
            return;
        }

        // Set markers for errors
        setEditorMarkers(codeEditor, result);

        // Update status
        if (!result.compiled) {
            statusSpan.textContent = 'Compile Error';
            statusSpan.className = 'status-badge status-error';
        } else if (!result.success) {
            statusSpan.textContent = 'Runtime Error';
            statusSpan.className = 'status-badge status-error';
        } else {
            statusSpan.textContent = 'Success';
            statusSpan.className = 'status-badge status-success';
        }

        // Format and display output
        outputEditor.setValue(formatOutput(result, debugLog));

    } catch (error) {
        statusSpan.textContent = 'Error';
        statusSpan.className = 'status-badge status-error';
        outputEditor.setValue(`Error: ${error.message}`);
        console.error('Apex execution error:', error);
    } finally {
        executeBtn.disabled = false;
    }
}

export function init() {
    const codeContainer = document.getElementById('apex-editor');
    const outputContainer = document.getElementById('apex-output-editor');
    const executeBtn = document.getElementById('apex-execute-btn');

    // Initialize Monaco editors
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

    // Bind execute button
    executeBtn.addEventListener('click', executeApex);

    // Add keyboard shortcut (Ctrl/Cmd + Enter to execute)
    codeEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        executeApex();
    });
}
