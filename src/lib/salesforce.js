// Salesforce Service Module
// All Salesforce API operations for the application

import { salesforceRequest, extensionFetch, getAccessToken, getInstanceUrl, API_VERSION } from './utils.js';

// ============================================================
// Constants
// ============================================================

const DEBUG_LEVEL_NAME = 'SFTOOLS_DEBUG';

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
// User & Session
// ============================================================

/**
 * Get current user ID
 * @returns {Promise<string>} User ID
 */
export async function getCurrentUserId() {
    const response = await salesforceRequest(`/services/data/v${API_VERSION}/chatter/users/me`);
    return response.json.id;
}

// ============================================================
// Debug Logging (for Apex execution)
// ============================================================

/**
 * Find or create a DebugLevel with our desired log levels
 * @returns {Promise<string>} Debug level ID
 */
async function getOrCreateDebugLevel() {
    const query = encodeURIComponent(`SELECT Id FROM DebugLevel WHERE DeveloperName = '${DEBUG_LEVEL_NAME}'`);
    const response = await salesforceRequest(`/services/data/v${API_VERSION}/tooling/query/?q=${query}`);

    if (response.json.records && response.json.records.length > 0) {
        return response.json.records[0].Id;
    }

    const createResponse = await salesforceRequest(`/services/data/v${API_VERSION}/tooling/sobjects/DebugLevel`, {
        method: 'POST',
        body: JSON.stringify({
            DeveloperName: DEBUG_LEVEL_NAME,
            MasterLabel: 'sftools Debug Level',
            ...DEBUG_LEVELS
        })
    });

    return createResponse.json.id;
}

/**
 * Ensure a TraceFlag exists for the current user with correct debug level
 * @param {string} userId - The user ID to trace
 * @returns {Promise<string>} Trace flag ID
 */
async function ensureTraceFlag(userId) {
    const now = new Date().toISOString();
    const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;

    const query = encodeURIComponent(
        `SELECT Id, DebugLevelId, DebugLevel.DeveloperName, ExpirationDate FROM TraceFlag WHERE TracedEntityId = '${userId}' AND LogType = 'USER_DEBUG' AND ExpirationDate > ${now}`
    );
    const response = await salesforceRequest(`/services/data/v${API_VERSION}/tooling/query/?q=${query}`);

    if (response.json.records && response.json.records.length > 0) {
        const existing = response.json.records[0];
        const expirationTime = new Date(existing.ExpirationDate).getTime();
        const hasCorrectDebugLevel = existing.DebugLevel?.DeveloperName === DEBUG_LEVEL_NAME;

        if (hasCorrectDebugLevel && expirationTime > fiveMinutesFromNow) {
            return existing.Id;
        }

        const debugLevelId = hasCorrectDebugLevel ? existing.DebugLevelId : await getOrCreateDebugLevel();
        const newExpiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        await salesforceRequest(`/services/data/v${API_VERSION}/tooling/sobjects/TraceFlag/${existing.Id}`, {
            method: 'PATCH',
            body: JSON.stringify({
                ExpirationDate: newExpiration,
                DebugLevelId: debugLevelId
            })
        });

        return existing.Id;
    }

    const debugLevelId = await getOrCreateDebugLevel();
    const startDate = new Date().toISOString();
    const expirationDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const createResponse = await salesforceRequest(`/services/data/v${API_VERSION}/tooling/sobjects/TraceFlag`, {
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
 * Get the latest anonymous apex debug log
 * @returns {Promise<string|null>} Log body or null
 */
async function getLatestAnonymousLog() {
    const query = encodeURIComponent(
        `SELECT Id, LogLength, Status FROM ApexLog WHERE Operation LIKE '%executeAnonymous/' ORDER BY StartTime DESC LIMIT 1`
    );
    const response = await salesforceRequest(`/services/data/v${API_VERSION}/tooling/query/?q=${query}`);

    if (!response.json.records || response.json.records.length === 0) {
        return null;
    }

    const logId = response.json.records[0].Id;

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

// ============================================================
// Apex Execution
// ============================================================

/**
 * Execute anonymous Apex code
 * Sets up trace flags, executes the code, and retrieves the debug log
 * @param {string} apexCode - The Apex code to execute
 * @param {function} onProgress - Optional callback for progress updates
 * @returns {Promise<{execution: object, debugLog: string|null}>}
 */
export async function executeAnonymousApex(apexCode, onProgress) {
    // Step 1: Setup trace flag
    onProgress?.('Setting up trace...');
    const userId = await getCurrentUserId();
    await ensureTraceFlag(userId);

    // Step 2: Execute the apex
    onProgress?.('Executing...');
    const encodedCode = encodeURIComponent(apexCode);
    const response = await salesforceRequest(
        `/services/data/v${API_VERSION}/tooling/executeAnonymous/?anonymousBody=${encodedCode}`
    );
    const execution = response.json;

    // Step 3: Get debug log (only if execution was attempted)
    let debugLog = null;
    if (execution.compiled) {
        onProgress?.('Fetching log...');
        await new Promise(resolve => setTimeout(resolve, 500));
        debugLog = await getLatestAnonymousLog();
    }

    return { execution, debugLog };
}

// ============================================================
// SOQL Query
// ============================================================

/**
 * Execute a SOQL query with column metadata
 * Makes parallel requests for data and column info
 * @param {string} soql - The SOQL query
 * @returns {Promise<{records: array, totalSize: number, columnMetadata: array, entityName: string}>}
 */
export async function executeQueryWithColumns(soql) {
    const encodedQuery = encodeURIComponent(soql);
    const baseUrl = `/services/data/v${API_VERSION}/query/?q=${encodedQuery}`;

    const [columnsResponse, dataResponse] = await Promise.all([
        salesforceRequest(`${baseUrl}&columns=true`),
        salesforceRequest(baseUrl)
    ]);

    const columnData = columnsResponse.json || {};
    const queryData = dataResponse.json || {};

    return {
        records: queryData.records || [],
        totalSize: queryData.totalSize || 0,
        columnMetadata: columnData.columnMetadata || [],
        entityName: columnData.entityName || null
    };
}

// ============================================================
// SObject Operations
// ============================================================

/**
 * Get object describe metadata (field definitions, etc.)
 * @param {string} objectType - The SObject API name
 * @returns {Promise<object>} Describe result with fields array
 */
export async function getObjectDescribe(objectType) {
    const response = await salesforceRequest(`/services/data/v${API_VERSION}/sobjects/${objectType}/describe`);
    return response.json;
}

/**
 * Get a single record by ID
 * @param {string} objectType - The SObject API name
 * @param {string} recordId - The record ID
 * @returns {Promise<object>} Record data
 */
export async function getRecord(objectType, recordId) {
    const response = await salesforceRequest(`/services/data/v${API_VERSION}/sobjects/${objectType}/${recordId}`);
    return response.json;
}

/**
 * Get a single record with relationship names included
 * @param {string} objectType - The SObject API name
 * @param {string} recordId - The record ID
 * @param {Array} fields - Field metadata from describe
 * @returns {Promise<{record: object, nameFieldMap: object}>} Record data and map of objectType -> nameField
 */
export async function getRecordWithRelationships(objectType, recordId, fields) {
    // Collect unique referenced object types
    const referencedTypes = new Set();
    for (const field of fields) {
        if (field.type === 'reference' && field.referenceTo?.length > 0) {
            referencedTypes.add(field.referenceTo[0]);
        }
    }

    // Get describes for all referenced types to find their name fields
    const nameFieldMap = {};
    if (referencedTypes.size > 0) {
        const describes = await Promise.all(
            [...referencedTypes].map(type =>
                getObjectDescribe(type).catch(() => null)
            )
        );

        [...referencedTypes].forEach((type, index) => {
            const describe = describes[index];
            if (describe) {
                const nameField = describe.fields.find(f => f.nameField);
                nameFieldMap[type] = nameField?.name || 'Name';
            } else {
                nameFieldMap[type] = 'Name';
            }
        });
    }

    // Build field list including relationship name fields
    const fieldNames = ['Id'];
    for (const field of fields) {
        if (field.name === 'Id') continue;
        fieldNames.push(field.name);

        if (field.type === 'reference' && field.relationshipName && field.referenceTo?.length > 0) {
            const refType = field.referenceTo[0];
            const nameField = nameFieldMap[refType] || 'Name';
            fieldNames.push(`${field.relationshipName}.${nameField}`);
        }
    }

    const soql = `SELECT ${fieldNames.join(', ')} FROM ${objectType} WHERE Id = '${recordId}'`;
    const response = await salesforceRequest(`/services/data/v${API_VERSION}/query/?q=${encodeURIComponent(soql)}`);

    if (!response.json.records || response.json.records.length === 0) {
        throw new Error('Record not found');
    }

    return { record: response.json.records[0], nameFieldMap };
}

/**
 * Update a record
 * @param {string} objectType - The SObject API name
 * @param {string} recordId - The record ID
 * @param {object} fields - Field values to update
 * @returns {Promise<void>}
 */
export async function updateRecord(objectType, recordId, fields) {
    await salesforceRequest(`/services/data/v${API_VERSION}/sobjects/${objectType}/${recordId}`, {
        method: 'PATCH',
        body: JSON.stringify(fields)
    });
}

// ============================================================
// Generic REST
// ============================================================

/**
 * Execute a generic REST API request
 * Returns raw response data for the REST API explorer
 * @param {string} endpoint - API endpoint (relative to instance URL)
 * @param {string} method - HTTP method
 * @param {string|null} body - Request body (JSON string)
 * @returns {Promise<{success: boolean, status: number, data: any, raw: string}>}
 */
export async function executeRestRequest(endpoint, method, body = null) {
    const response = await extensionFetch(`${getInstanceUrl()}${endpoint}`, {
        method,
        headers: {
            'Authorization': `Bearer ${getAccessToken()}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body
    });

    let data = response.data;
    try {
        data = JSON.parse(response.data);
    } catch (e) {
        // Keep as raw string if not JSON
    }

    return {
        success: response.success,
        status: response.status,
        statusText: response.statusText,
        error: response.error,
        data,
        raw: response.data
    };
}

// ============================================================
// Streaming Channels
// ============================================================

/**
 * Get available Platform Event channels
 * Queries for custom Platform Events (entities ending in __e)
 * @returns {Promise<{customEvents: array}>}
 */
export async function getEventChannels() {
    const query = encodeURIComponent(
        "SELECT DeveloperName, QualifiedApiName, Label FROM EntityDefinition WHERE QualifiedApiName LIKE '%__e' AND IsCustomizable = true ORDER BY Label"
    );

    const response = await salesforceRequest(`/services/data/v${API_VERSION}/tooling/query?q=${query}`);

    return {
        customEvents: response.json.records || []
    };
}

/**
 * Get active PushTopic channels
 * @returns {Promise<array>} PushTopic records
 */
export async function getPushTopics() {
    const query = encodeURIComponent(
        "SELECT Id, Name, Query, ApiVersion, IsActive FROM PushTopic WHERE IsActive = true ORDER BY Name"
    );

    const response = await salesforceRequest(`/services/data/v${API_VERSION}/query?q=${query}`);

    return response.json.records || [];
}

// Standard Platform Events (commonly available)
const STANDARD_EVENTS = [
    { name: 'BatchApexErrorEvent', label: 'Batch Apex Error Event' },
    { name: 'FlowExecutionErrorEvent', label: 'Flow Execution Error Event' },
    { name: 'PlatformStatusAlertEvent', label: 'Platform Status Alert Event' },
    { name: 'AsyncOperationEvent', label: 'Async Operation Event' }
];

// System Topics (CometD only)
const SYSTEM_TOPICS = [
    { channel: '/systemTopic/Logging', label: 'Debug Logs' }
];

/**
 * Get all streaming channels (unified)
 * @returns {Promise<{platformEvents: array, standardEvents: array, pushTopics: array, systemTopics: array}>}
 */
export async function getAllStreamingChannels() {
    const [platformEvents, pushTopics] = await Promise.all([
        getEventChannels(),
        getPushTopics().catch(() => [])
    ]);

    return {
        platformEvents: platformEvents.customEvents,
        standardEvents: STANDARD_EVENTS,
        pushTopics,
        systemTopics: SYSTEM_TOPICS
    };
}

/**
 * Publish a Platform Event
 * @param {string} eventType - The event API name (e.g., 'My_Event__e')
 * @param {object} payload - The event payload
 * @returns {Promise<{success: boolean, id: string|null, error: string|null}>}
 */
export async function publishPlatformEvent(eventType, payload) {
    const response = await extensionFetch(
        `${getInstanceUrl()}/services/data/v${API_VERSION}/sobjects/${eventType}`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAccessToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        }
    );

    if (response.success) {
        const data = JSON.parse(response.data);
        return { success: true, id: data.id, error: null };
    }

    let errorMsg = 'Publish failed';
    try {
        const errorData = JSON.parse(response.data);
        if (Array.isArray(errorData) && errorData[0]?.message) {
            errorMsg = errorData[0].message;
        }
    } catch (e) {
        // Use default error message
    }

    return { success: false, id: null, error: errorMsg };
}
