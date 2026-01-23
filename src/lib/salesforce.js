// Salesforce Service Module
// All Salesforce API operations for the application

import { salesforceRequest } from './salesforce-request.js';
import { smartFetch } from './fetch.js';
import { getAccessToken, getInstanceUrl, getActiveConnectionId } from './auth.js';
import { API_VERSION } from './utils.js';

// ============================================================
// Tooling API Utilities
// ============================================================

/**
 * Bulk delete records using Tooling API composite endpoint
 * Batches deletes into groups of 25 (Tooling API composite limit)
 * @param {string} sobjectType - SObject type to delete (e.g., 'ApexLog', 'TraceFlag', 'Flow')
 * @param {string[]} ids - Array of record IDs to delete
 * @returns {Promise<number>} - Number of records deleted
 */
async function bulkDeleteTooling(sobjectType, ids) {
    let deletedCount = 0;
    const batchSize = 25;

    for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const compositeRequest = {
            allOrNone: false,
            compositeRequest: batch.map((id, idx) => ({
                method: 'DELETE',
                url: `/services/data/v${API_VERSION}/tooling/sobjects/${sobjectType}/${id}`,
                referenceId: `delete_${idx}`,
            })),
        };

        await salesforceRequest(`/services/data/v${API_VERSION}/tooling/composite`, {
            method: 'POST',
            body: JSON.stringify(compositeRequest),
        });
        deletedCount += batch.length;
    }

    return deletedCount;
}

/**
 * Escape special characters for SOQL queries
 * @param {string} str - String to escape
 * @returns {string} - Escaped string safe for SOQL LIKE clauses
 */
function escapeSoql(str) {
    return str.replace(/'/g, "\\'").replace(/%/g, '\\%').replace(/_/g, '\\_');
}

// ============================================================
// Describe Cache
// ============================================================

const DESCRIBE_CACHE_PREFIX = 'describeCache_';

/**
 * Get the storage key for a connection's describe cache
 * @param {string} connectionId
 * @returns {string}
 */
function getDescribeCacheKey(connectionId) {
    return `${DESCRIBE_CACHE_PREFIX}${connectionId}`;
}

/**
 * Get the describe cache for the current connection
 * @returns {Promise<{global: object|null, objects: object}>}
 */
async function getDescribeCache() {
    const connectionId = getActiveConnectionId();
    if (!connectionId) return { global: null, objects: {} };

    const key = getDescribeCacheKey(connectionId);
    const data = await chrome.storage.local.get([key]);
    return data[key] || { global: null, objects: {} };
}

/**
 * Save describe data to cache for the current connection
 * @param {string} type - 'global' or object API name
 * @param {object} data - Describe data to cache
 */
async function setDescribeCache(type, data) {
    const connectionId = getActiveConnectionId();
    if (!connectionId) return;

    const key = getDescribeCacheKey(connectionId);
    const stored = await chrome.storage.local.get([key]);
    const cache = stored[key] || { global: null, objects: {} };

    if (type === 'global') {
        cache.global = data;
    } else {
        cache.objects[type] = data;
    }

    await chrome.storage.local.set({ [key]: cache });
}

/**
 * Clear describe cache for the current connection
 * @returns {Promise<void>}
 */
export async function clearDescribeCache() {
    const connectionId = getActiveConnectionId();
    if (!connectionId) return;

    await chrome.storage.local.remove(getDescribeCacheKey(connectionId));
}

/**
 * Clear describe cache for a specific connection
 * Used when removing a connection from storage
 * @param {string} connectionId
 * @returns {Promise<void>}
 */
export async function clearDescribeCacheForConnection(connectionId) {
    if (!connectionId) return;
    await chrome.storage.local.remove(getDescribeCacheKey(connectionId));
}

/**
 * Migrate describe cache from old single-key format to per-connection keys
 * Should be called once during app initialization
 * @returns {Promise<boolean>} - Whether migration was performed
 */
export async function migrateDescribeCache() {
    const OLD_KEY = 'describeCache';
    const data = await chrome.storage.local.get([OLD_KEY]);
    const oldCache = data[OLD_KEY];

    if (!oldCache || typeof oldCache !== 'object') return false;

    // Migrate each connection to its own key
    const updates = {};
    for (const [connectionId, cacheData] of Object.entries(oldCache)) {
        updates[getDescribeCacheKey(connectionId)] = cacheData;
    }

    // Write new keys and remove old
    if (Object.keys(updates).length > 0) {
        await chrome.storage.local.set(updates);
    }
    await chrome.storage.local.remove(OLD_KEY);

    return true;
}

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
    Workflow: 'INFO',
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
    const query = encodeURIComponent(
        `SELECT Id FROM DebugLevel WHERE DeveloperName = '${DEBUG_LEVEL_NAME}'`
    );
    const response = await salesforceRequest(
        `/services/data/v${API_VERSION}/tooling/query/?q=${query}`
    );

    if (response.json.records && response.json.records.length > 0) {
        return response.json.records[0].Id;
    }

    const createResponse = await salesforceRequest(
        `/services/data/v${API_VERSION}/tooling/sobjects/DebugLevel`,
        {
            method: 'POST',
            body: JSON.stringify({
                DeveloperName: DEBUG_LEVEL_NAME,
                MasterLabel: 'sftools Debug Level',
                ...DEBUG_LEVELS,
            }),
        }
    );

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
    const response = await salesforceRequest(
        `/services/data/v${API_VERSION}/tooling/query/?q=${query}`
    );

    if (response.json.records && response.json.records.length > 0) {
        const existing = response.json.records[0];
        const expirationTime = new Date(existing.ExpirationDate).getTime();
        const hasCorrectDebugLevel = existing.DebugLevel?.DeveloperName === DEBUG_LEVEL_NAME;

        if (hasCorrectDebugLevel && expirationTime > fiveMinutesFromNow) {
            return existing.Id;
        }

        const debugLevelId = hasCorrectDebugLevel
            ? existing.DebugLevelId
            : await getOrCreateDebugLevel();
        const newExpiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        await salesforceRequest(
            `/services/data/v${API_VERSION}/tooling/sobjects/TraceFlag/${existing.Id}`,
            {
                method: 'PATCH',
                body: JSON.stringify({
                    ExpirationDate: newExpiration,
                    DebugLevelId: debugLevelId,
                }),
            }
        );

        return existing.Id;
    }

    const debugLevelId = await getOrCreateDebugLevel();
    const startDate = new Date().toISOString();
    const expirationDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const createResponse = await salesforceRequest(
        `/services/data/v${API_VERSION}/tooling/sobjects/TraceFlag`,
        {
            method: 'POST',
            body: JSON.stringify({
                TracedEntityId: userId,
                DebugLevelId: debugLevelId,
                LogType: 'USER_DEBUG',
                StartDate: startDate,
                ExpirationDate: expirationDate,
            }),
        }
    );

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
    const response = await salesforceRequest(
        `/services/data/v${API_VERSION}/tooling/query/?q=${query}`
    );

    if (!response.json.records || response.json.records.length === 0) {
        return null;
    }

    const logId = response.json.records[0].Id;

    const logResponse = await smartFetch(
        `${getInstanceUrl()}/services/data/v${API_VERSION}/tooling/sobjects/ApexLog/${logId}/Body`,
        {
            headers: {
                Authorization: `Bearer ${getAccessToken()}`,
            },
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
 * Fetches column metadata first, then query results
 * @param {string} soql - The SOQL query
 * @param {boolean} useToolingApi - If true, use the Tooling API endpoint
 * @returns {Promise<{records: array, totalSize: number, columnMetadata: array, entityName: string}>}
 */
export async function executeQueryWithColumns(soql, useToolingApi = false) {
    const encodedQuery = encodeURIComponent(soql);
    const apiPath = useToolingApi ? 'tooling/query' : 'query';
    const baseUrl = `/services/data/v${API_VERSION}/${apiPath}/?q=${encodedQuery}`;

    // Execute columns request first to fail fast on query errors
    const columnsResponse = await salesforceRequest(`${baseUrl}&columns=true`);
    const columnData = columnsResponse.json || {};

    // Only proceed with data request if columns request succeeded
    const dataResponse = await salesforceRequest(baseUrl);
    const queryData = dataResponse.json || {};

    return {
        records: queryData.records || [],
        totalSize: queryData.totalSize || 0,
        columnMetadata: columnData.columnMetadata || [],
        entityName: columnData.entityName || null,
    };
}

// ============================================================
// SObject Operations
// ============================================================

/**
 * Get global describe metadata (all objects)
 * Uses cache if available, otherwise fetches and caches
 * @param {boolean} bypassCache - If true, skip cache lookup (still saves to cache)
 * @returns {Promise<{sobjects: array}>}
 */
export async function getGlobalDescribe(bypassCache = false) {
    if (!bypassCache) {
        const cache = await getDescribeCache();
        if (cache.global) {
            return cache.global;
        }
    }

    const response = await salesforceRequest(`/services/data/v${API_VERSION}/sobjects`);
    const data = response.json;

    // Cache the result
    await setDescribeCache('global', data);

    return data;
}

/**
 * Get object describe metadata (field definitions, etc.)
 * Uses cache if available, otherwise fetches and caches
 * @param {string} objectType - The SObject API name
 * @param {boolean} bypassCache - If true, skip cache lookup (still saves to cache)
 * @returns {Promise<object>} Describe result with fields array
 */
export async function getObjectDescribe(objectType, bypassCache = false) {
    if (!bypassCache) {
        const cache = await getDescribeCache();
        if (cache.objects[objectType]) {
            return cache.objects[objectType];
        }
    }

    const response = await salesforceRequest(
        `/services/data/v${API_VERSION}/sobjects/${objectType}/describe`
    );
    const data = response.json;

    // Cache the result
    await setDescribeCache(objectType, data);

    return data;
}

/**
 * Get a single record by ID
 * @param {string} objectType - The SObject API name
 * @param {string} recordId - The record ID
 * @returns {Promise<object>} Record data
 */
export async function getRecord(objectType, recordId) {
    const response = await salesforceRequest(
        `/services/data/v${API_VERSION}/sobjects/${objectType}/${recordId}`
    );
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
            [...referencedTypes].map(type => getObjectDescribe(type).catch(() => null))
        );

        [...referencedTypes].forEach((type, index) => {
            const describe = describes[index];
            if (describe) {
                const nameField = describe.fields.find(f => f.nameField);
                // Only set if a name field exists; don't default to 'Name'
                if (nameField) {
                    nameFieldMap[type] = nameField.name;
                }
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
            const nameField = nameFieldMap[refType];
            // Only include relationship field if the referenced object has a name field
            if (nameField) {
                fieldNames.push(`${field.relationshipName}.${nameField}`);
            }
        }
    }

    const soql = `SELECT ${fieldNames.join(', ')} FROM ${objectType} WHERE Id = '${recordId}'`;
    const response = await salesforceRequest(
        `/services/data/v${API_VERSION}/query/?q=${encodeURIComponent(soql)}`
    );

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
        body: JSON.stringify(fields),
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
    const response = await smartFetch(`${getInstanceUrl()}${endpoint}`, {
        method,
        headers: {
            Authorization: `Bearer ${getAccessToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body,
    });

    let { data } = response;
    try {
        data = JSON.parse(response.data);
    } catch {
        // Keep as raw string if not JSON
    }

    return {
        success: response.success,
        status: response.status,
        statusText: response.statusText,
        error: response.error,
        data,
        raw: response.data,
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

    const response = await salesforceRequest(
        `/services/data/v${API_VERSION}/tooling/query?q=${query}`
    );

    return {
        customEvents: response.json.records || [],
    };
}

/**
 * Get active PushTopic channels
 * @returns {Promise<array>} PushTopic records
 */
export async function getPushTopics() {
    const query = encodeURIComponent(
        'SELECT Id, Name, Query, ApiVersion, IsActive FROM PushTopic WHERE IsActive = true ORDER BY Name'
    );

    const response = await salesforceRequest(`/services/data/v${API_VERSION}/query?q=${query}`);

    return response.json.records || [];
}

// Standard Platform Events (commonly available)
const STANDARD_EVENTS = [
    { name: 'BatchApexErrorEvent', label: 'Batch Apex Error Event' },
    { name: 'FlowExecutionErrorEvent', label: 'Flow Execution Error Event' },
    { name: 'PlatformStatusAlertEvent', label: 'Platform Status Alert Event' },
    { name: 'AsyncOperationEvent', label: 'Async Operation Event' },
];

// System Topics (CometD only)
const SYSTEM_TOPICS = [{ channel: '/systemTopic/Logging', label: 'Debug Logs' }];

/**
 * Get all streaming channels (unified)
 * @returns {Promise<{platformEvents: array, standardEvents: array, pushTopics: array, systemTopics: array}>}
 */
export async function getAllStreamingChannels() {
    const [platformEvents, pushTopics] = await Promise.all([
        getEventChannels(),
        getPushTopics().catch(() => []),
    ]);

    return {
        platformEvents: platformEvents.customEvents,
        standardEvents: STANDARD_EVENTS,
        pushTopics,
        systemTopics: SYSTEM_TOPICS,
    };
}

/**
 * Publish a Platform Event
 * @param {string} eventType - The event API name (e.g., 'My_Event__e')
 * @param {object} payload - The event payload
 * @returns {Promise<{success: boolean, id: string|null, error: string|null}>}
 */
export async function publishPlatformEvent(eventType, payload) {
    const response = await smartFetch(
        `${getInstanceUrl()}/services/data/v${API_VERSION}/sobjects/${eventType}`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${getAccessToken()}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
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
    } catch {
        // Use default error message
    }

    return { success: false, id: null, error: errorMsg };
}

// ============================================================
// Utils Tab - API Helpers
// ============================================================

/**
 * Delete all ApexLog records
 * @returns {Promise<{deletedCount: number}>}
 */
export async function deleteAllDebugLogs() {
    const query = encodeURIComponent('SELECT Id FROM ApexLog');
    const response = await salesforceRequest(
        `/services/data/v${API_VERSION}/tooling/query/?q=${query}`
    );

    const logIds = (response.json.records || []).map(l => l.Id);
    if (logIds.length === 0) {
        return { deletedCount: 0 };
    }

    const deletedCount = await bulkDeleteTooling('ApexLog', logIds);
    return { deletedCount };
}

/**
 * Search users by name or username
 * @param {string} searchTerm
 * @returns {Promise<Array>}
 */
export async function searchUsers(searchTerm) {
    const escaped = escapeSoql(searchTerm);
    const query = encodeURIComponent(
        `SELECT Id, Name, Username FROM User WHERE (Name LIKE '%${escaped}%' OR Username LIKE '%${escaped}%') AND IsActive = true ORDER BY Name LIMIT 10`
    );
    const response = await salesforceRequest(`/services/data/v${API_VERSION}/query/?q=${query}`);
    return response.json.records || [];
}

/**
 * Enable trace flag for a user (30 minutes)
 * @param {string} userId
 * @returns {Promise<string>} Trace flag ID
 */
export async function enableTraceFlagForUser(userId) {
    const now = new Date().toISOString();
    const thirtyMinutesFromNow = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // Check for existing trace flag
    const query = encodeURIComponent(
        `SELECT Id, DebugLevelId, ExpirationDate FROM TraceFlag WHERE TracedEntityId = '${userId}' AND LogType = 'USER_DEBUG' AND DebugLevel.DeveloperName = '${DEBUG_LEVEL_NAME}'`
    );
    const response = await salesforceRequest(
        `/services/data/v${API_VERSION}/tooling/query/?q=${query}`
    );

    if (response.json.records && response.json.records.length > 0) {
        const existing = response.json.records[0];

        await salesforceRequest(
            `/services/data/v${API_VERSION}/tooling/sobjects/TraceFlag/${existing.Id}`,
            {
                method: 'PATCH',
                body: JSON.stringify({
                    StartDate: now,
                    ExpirationDate: thirtyMinutesFromNow,
                }),
            }
        );
        return existing.Id;
    }

    // Create new trace flag
    const debugLevelId = await getOrCreateDebugLevel();
    const createResponse = await salesforceRequest(
        `/services/data/v${API_VERSION}/tooling/sobjects/TraceFlag`,
        {
            method: 'POST',
            body: JSON.stringify({
                TracedEntityId: userId,
                DebugLevelId: debugLevelId,
                LogType: 'USER_DEBUG',
                StartDate: now,
                ExpirationDate: thirtyMinutesFromNow,
            }),
        }
    );
    return createResponse.json.id;
}

/**
 * Delete all TraceFlag records
 * @returns {Promise<{deletedCount: number}>}
 */
export async function deleteAllTraceFlags() {
    const query = encodeURIComponent('SELECT Id FROM TraceFlag');
    const response = await salesforceRequest(
        `/services/data/v${API_VERSION}/tooling/query/?q=${query}`
    );

    const flagIds = (response.json.records || []).map(f => f.Id);
    if (flagIds.length === 0) {
        return { deletedCount: 0 };
    }

    const deletedCount = await bulkDeleteTooling('TraceFlag', flagIds);
    return { deletedCount };
}

/**
 * Search flows by name
 * @param {string} searchTerm
 * @returns {Promise<Array>}
 */
export async function searchFlows(searchTerm) {
    const escaped = escapeSoql(searchTerm);
    const query = encodeURIComponent(
        `SELECT Id, DeveloperName, ActiveVersionId FROM FlowDefinition WHERE DeveloperName LIKE '%${escaped}%' ORDER BY DeveloperName LIMIT 10`
    );
    const response = await salesforceRequest(
        `/services/data/v${API_VERSION}/tooling/query/?q=${query}`
    );
    return response.json.records || [];
}

/**
 * Get all versions of a flow
 * @param {string} flowDefinitionId
 * @returns {Promise<Array>}
 */
export async function getFlowVersions(flowDefinitionId) {
    const query = encodeURIComponent(
        `SELECT Id, VersionNumber, Status, Description FROM Flow WHERE DefinitionId = '${flowDefinitionId}' ORDER BY VersionNumber DESC`
    );
    const response = await salesforceRequest(
        `/services/data/v${API_VERSION}/tooling/query/?q=${query}`
    );
    return response.json.records || [];
}

/**
 * Delete inactive flow versions
 * @param {string[]} versionIds
 * @returns {Promise<{deletedCount: number}>}
 */
export async function deleteInactiveFlowVersions(versionIds) {
    if (versionIds.length === 0) {
        return { deletedCount: 0 };
    }

    const deletedCount = await bulkDeleteTooling('Flow', versionIds);
    return { deletedCount };
}

/**
 * Search Profiles by name
 * @param {string} searchTerm
 * @returns {Promise<Array>}
 */
export async function searchProfiles(searchTerm) {
    const escaped = escapeSoql(searchTerm);
    const query = encodeURIComponent(
        `SELECT Id, Name FROM Profile WHERE Name LIKE '%${escaped}%' ORDER BY Name LIMIT 10`
    );
    const response = await salesforceRequest(`/services/data/v${API_VERSION}/query/?q=${query}`);
    return response.json.records || [];
}

// ============================================================
// Bulk API v2 - Query Export
// ============================================================

/**
 * Create a Bulk API v2 query job
 * @param {string} soql - The SOQL query
 * @returns {Promise<{id: string, state: string}>}
 */
export async function createBulkQueryJob(soql) {
    const response = await salesforceRequest(`/services/data/v${API_VERSION}/jobs/query`, {
        method: 'POST',
        body: JSON.stringify({
            operation: 'query',
            query: soql,
        }),
    });
    return response.json;
}

/**
 * Get the status of a Bulk API v2 query job
 * @param {string} jobId - The job ID
 * @returns {Promise<{id: string, state: string, numberRecordsProcessed: number}>}
 */
export async function getBulkQueryJobStatus(jobId) {
    const response = await salesforceRequest(`/services/data/v${API_VERSION}/jobs/query/${jobId}`);
    return response.json;
}

/**
 * Get the CSV results of a completed Bulk API v2 query job
 * @param {string} jobId - The job ID
 * @returns {Promise<string>} - CSV content
 */
export async function getBulkQueryResults(jobId) {
    const response = await smartFetch(
        `${getInstanceUrl()}/services/data/v${API_VERSION}/jobs/query/${jobId}/results`,
        {
            headers: {
                Authorization: `Bearer ${getAccessToken()}`,
                Accept: 'text/csv',
            },
        }
    );

    if (!response.success) {
        throw new Error(response.error || 'Failed to fetch results');
    }

    return response.data;
}

/**
 * Abort a Bulk API v2 query job
 * @param {string} jobId - The job ID
 * @returns {Promise<void>}
 */
export async function abortBulkQueryJob(jobId) {
    await salesforceRequest(`/services/data/v${API_VERSION}/jobs/query/${jobId}`, {
        method: 'PATCH',
        body: JSON.stringify({ state: 'Aborted' }),
    });
}

/**
 * Execute a bulk query export with polling
 * Handles job creation, polling, and result retrieval
 * @param {string} soql - The SOQL query
 * @param {function} onProgress - Progress callback (state, recordCount)
 * @returns {Promise<string>} - CSV content
 */
export async function executeBulkQueryExport(soql, onProgress) {
    onProgress?.('Creating job...');
    const job = await createBulkQueryJob(soql);
    const jobId = job.id;

    const pollInterval = 2000;
    const maxAttempts = 150;
    let attempts = 0;

    while (attempts < maxAttempts) {
        const status = await getBulkQueryJobStatus(jobId);
        onProgress?.(status.state, status.numberRecordsProcessed || 0);

        if (status.state === 'JobComplete') {
            onProgress?.('Downloading...');
            return getBulkQueryResults(jobId);
        }

        if (status.state === 'Failed' || status.state === 'Aborted') {
            throw new Error(
                `Bulk query ${status.state.toLowerCase()}: ${status.errorMessage || 'Unknown error'}`
            );
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
        attempts++;
    }

    await abortBulkQueryJob(jobId).catch(() => {
        /* ignore */
    });
    throw new Error('Bulk query timed out');
}

// ============================================================
// Formula Field Editor
// ============================================================

/**
 * Get formula field metadata from Tooling API
 * @param {string} objectType - The SObject API name
 * @param {string} fieldName - The field API name
 * @returns {Promise<{id: string, formula: string, fullName: string, metadata: object}>}
 */
export async function getFormulaFieldMetadata(objectType, fieldName) {
    // Query the CustomField via Tooling API
    const query = encodeURIComponent(
        `SELECT Id, FullName, Metadata FROM CustomField WHERE TableEnumOrId = '${objectType}' AND DeveloperName = '${fieldName.replace(/__c$/, '')}'`
    );
    const response = await salesforceRequest(
        `/services/data/v${API_VERSION}/tooling/query/?q=${query}`
    );

    if (!response.json.records || response.json.records.length === 0) {
        throw new Error('Formula field not found');
    }

    const record = response.json.records[0];
    return {
        id: record.Id,
        formula: record.Metadata?.formula || '',
        fullName: record.FullName,
        metadata: record.Metadata,
    };
}

/**
 * Update formula field via Tooling API
 * @param {string} fieldId - The CustomField ID
 * @param {string} formula - The new formula
 * @param {object} existingMetadata - Existing metadata to preserve
 * @returns {Promise<void>}
 */
export async function updateFormulaField(fieldId, formula, existingMetadata) {
    // Update only the formula property, preserve other metadata
    const updatedMetadata = {
        ...existingMetadata,
        formula,
    };

    await salesforceRequest(
        `/services/data/v${API_VERSION}/tooling/sobjects/CustomField/${fieldId}`,
        {
            method: 'PATCH',
            body: JSON.stringify({
                Metadata: updatedMetadata,
            }),
        }
    );
}
