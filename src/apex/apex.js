// Anonymous Apex Execution Tab Module
import { createEditor, createReadOnlyEditor, monaco } from '../lib/monaco.js';
import { extensionFetch, getAccessToken, getInstanceUrl, isAuthenticated } from '../lib/utils.js';

let codeEditor = null;
let outputEditor = null;

const API_VERSION = '62.0';
const DEBUG_LEVEL_NAME = 'SFTOOLS_DEBUG';

// Default debug log levels for comprehensive logging
const DEBUG_LEVELS = {
    ApexCode: 'FINEST',
    ApexProfiling: 'INFO',
    Callout: 'INFO',
    Database: 'INFO',
    System: 'DEBUG',
    Validation: 'INFO',
    Visualforce: 'INFO',
    Workflow: 'INFO'
};

// ============================================================
// REST API Implementation
// ============================================================

/**
 * Make an authenticated REST API call
 */
async function apiCall(endpoint, options = {}) {
    const url = `${getInstanceUrl()}${endpoint}`;
    const response = await extensionFetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${getAccessToken()}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    if (!response.success && response.status !== 404) {
        const error = response.data ? JSON.parse(response.data) : { message: response.statusText };
        throw new Error(error[0]?.message || error.message || 'API call failed');
    }

    return {
        ...response,
        json: response.data ? JSON.parse(response.data) : null
    };
}

/**
 * Get current user ID
 */
async function getCurrentUserId() {
    const response = await apiCall(`/services/data/v${API_VERSION}/chatter/users/me`);
    return response.json.id;
}

/**
 * Find or create a DebugLevel with our desired log levels
 */
async function getOrCreateDebugLevel() {
    // Check if our debug level already exists
    const query = encodeURIComponent(`SELECT Id FROM DebugLevel WHERE DeveloperName = '${DEBUG_LEVEL_NAME}'`);
    const response = await apiCall(`/services/data/v${API_VERSION}/tooling/query/?q=${query}`);

    if (response.json.records && response.json.records.length > 0) {
        return response.json.records[0].Id;
    }

    // Create new debug level
    const createResponse = await apiCall(`/services/data/v${API_VERSION}/tooling/sobjects/DebugLevel`, {
        method: 'POST',
        body: JSON.stringify({
            DeveloperName: DEBUG_LEVEL_NAME,
            MasterLabel: 'sftools Debug Level',
            ApexCode: DEBUG_LEVELS.ApexCode,
            ApexProfiling: DEBUG_LEVELS.ApexProfiling,
            Callout: DEBUG_LEVELS.Callout,
            Database: DEBUG_LEVELS.Database,
            System: DEBUG_LEVELS.System,
            Validation: DEBUG_LEVELS.Validation,
            Visualforce: DEBUG_LEVELS.Visualforce,
            Workflow: DEBUG_LEVELS.Workflow
        })
    });

    return createResponse.json.id;
}

/**
 * Ensure a TraceFlag exists for the current user with correct debug level
 * Returns early if existing trace flag already has the correct debug level name
 */
async function ensureTraceFlag(userId) {
    const now = new Date().toISOString();
    const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;

    // Query trace flag with debug level name in one call
    const query = encodeURIComponent(
        `SELECT Id, DebugLevelId, DebugLevel.DeveloperName, ExpirationDate FROM TraceFlag WHERE TracedEntityId = '${userId}' AND LogType = 'USER_DEBUG' AND ExpirationDate > ${now}`
    );
    const response = await apiCall(`/services/data/v${API_VERSION}/tooling/query/?q=${query}`);

    if (response.json.records && response.json.records.length > 0) {
        const existing = response.json.records[0];
        const expirationTime = new Date(existing.ExpirationDate).getTime();
        const hasCorrectDebugLevel = existing.DebugLevel?.DeveloperName === DEBUG_LEVEL_NAME;

        // Skip entirely if debug level name matches and expiration is more than 5 minutes away
        if (hasCorrectDebugLevel && expirationTime > fiveMinutesFromNow) {
            return existing.Id;
        }

        // Need to update - get or create the correct debug level
        const debugLevelId = hasCorrectDebugLevel ? existing.DebugLevelId : await getOrCreateDebugLevel();

        const newExpiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        await apiCall(`/services/data/v${API_VERSION}/tooling/sobjects/TraceFlag/${existing.Id}`, {
            method: 'PATCH',
            body: JSON.stringify({
                ExpirationDate: newExpiration,
                DebugLevelId: debugLevelId
            })
        });

        return existing.Id;
    }

    // No existing trace flag - need to create debug level and trace flag
    const debugLevelId = await getOrCreateDebugLevel();
    const startDate = new Date().toISOString();
    const expirationDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const createResponse = await apiCall(`/services/data/v${API_VERSION}/tooling/sobjects/TraceFlag`, {
        method: 'POST',
        body: JSON.stringify({
            TracedEntityId: userId,
            DebugLevelId: debugLevelId,
            LogType: 'USER_DEBUG',
            StartDate: startDate,
            ExpirationDate: expirationDate
        })
    });

    return createResponse.json.id;
}

/**
 * Execute anonymous Apex via REST Tooling API
 */
async function executeAnonymousRest(apexCode) {
    const encodedCode = encodeURIComponent(apexCode);
    const response = await apiCall(
        `/services/data/v${API_VERSION}/tooling/executeAnonymous/?anonymousBody=${encodedCode}`
    );

    return response.json;
}

/**
 * Get the latest anonymous apex debug log
 */
async function getLatestAnonymousLog() {
    // Query for the most recent anonymous apex log
    const query = encodeURIComponent(
        `SELECT Id, LogLength, Status FROM ApexLog WHERE Operation LIKE '%executeAnonymous/' ORDER BY StartTime DESC LIMIT 1`
    );
    const response = await apiCall(`/services/data/v${API_VERSION}/tooling/query/?q=${query}`);

    if (!response.json.records || response.json.records.length === 0) {
        return null;
    }

    const logId = response.json.records[0].Id;

    // Fetch the log body
    const logResponse = await extensionFetch(
        `${getInstanceUrl()}/services/data/v${API_VERSION}/tooling/sobjects/ApexLog/${logId}/Body`,
        {
            headers: {
                'Authorization': `Bearer ${getAccessToken()}`
            }
        }
    );

    return logResponse.data;
}

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
        outputEditor.setValue('// Not authenticated. Please authorize via the extension popup first.');
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
        // Step 1: Setup trace flag (handles debug level internally)
        updateStatus('Setting up trace...', 'loading');
        outputEditor.setValue('// Setting up debug trace flag...');

        const userId = await getCurrentUserId();
        await ensureTraceFlag(userId);

        // Step 2: Execute the apex
        updateStatus('Executing...', 'loading');
        outputEditor.setValue('// Executing Apex...');

        const result = await executeAnonymousRest(apexCode);

        // Step 3: Set markers for any errors
        setEditorMarkers(codeEditor, result);

        // Step 4: Get debug log (only if execution was attempted)
        let debugLog = null;
        if (result.compiled) {
            updateStatus('Fetching log...', 'loading');
            outputEditor.setValue('// Fetching debug log...');

            // Small delay to ensure log is available
            await new Promise(resolve => setTimeout(resolve, 500));
            debugLog = await getLatestAnonymousLog();
        }

        // Update final status
        if (!result.compiled) {
            updateStatus('Compile Error', 'error');
        } else if (!result.success) {
            updateStatus('Runtime Error', 'error');
        } else {
            updateStatus('Success', 'success');
        }

        // Display output
        outputEditor.setValue(formatOutput(result, debugLog));

    } catch (error) {
        updateStatus('Error', 'error');
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


// ============================================================
// SOAP API Implementation (stubbed for future use)
// This approach could return the debug log in a single call
// via the DebuggingHeader, but currently doesn't work reliably
// ============================================================

/**
 * Build the SOAP envelope for executeAnonymous with DebuggingHeader
 * @stub - Not currently used, kept for future implementation
 */
function buildSoapEnvelope(apexCode, sessionId) {
    const escapedCode = apexCode
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

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
 * Parse SOAP response
 * @stub - Not currently used
 */
function parseSoapResponse(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    const fault = doc.querySelector('Fault');
    if (fault) {
        return {
            success: false,
            compiled: false,
            error: fault.querySelector('faultstring')?.textContent || 'Unknown SOAP fault'
        };
    }

    const result = doc.querySelector('result');
    if (!result) {
        return { success: false, compiled: false, error: 'Invalid response' };
    }

    return {
        compiled: result.querySelector('compiled')?.textContent === 'true',
        success: result.querySelector('success')?.textContent === 'true',
        compileProblem: result.querySelector('compileProblem')?.textContent || null,
        exceptionMessage: result.querySelector('exceptionMessage')?.textContent || null,
        exceptionStackTrace: result.querySelector('exceptionStackTrace')?.textContent || null,
        line: parseInt(result.querySelector('line')?.textContent, 10) || null,
        column: parseInt(result.querySelector('column')?.textContent, 10) || null
    };
}
