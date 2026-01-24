// Salesforce Service Module
// All Salesforce API operations for the application

import { salesforceRequest } from './salesforce-request.js';
import { smartFetch } from './fetch.js';
import { getAccessToken, getInstanceUrl, getActiveConnectionId } from './auth.js';
import { API_VERSION } from './utils.js';
import type {
    SObjectDescribe,
    DescribeGlobalResult,
    ObjectDescribeResult,
    SObject,
    QueryResult,
    ApexExecutionResult,
    ToolingQueryResult,
} from '../types/salesforce';

// ============================================================
// Tooling API Utilities
// ============================================================

interface CompositeRequest {
    method: string;
    url: string;
    referenceId: string;
}

/**
 * Bulk delete records using Tooling API composite endpoint
 * Batches deletes into groups of 25 (Tooling API composite limit)
 */
async function bulkDeleteTooling(sobjectType: string, ids: string[]): Promise<number> {
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
 */
function escapeSoql(str: string): string {
    return str.replace(/'/g, "\\'").replace(/%/g, '\\%').replace(/_/g, '\\_');
}

// ============================================================
// Describe Cache
// ============================================================

const DESCRIBE_CACHE_PREFIX = 'describeCache_';

interface DescribeCache {
    global: DescribeGlobalResult | null;
    objects: Record<string, ObjectDescribeResult>;
}

/**
 * Get the storage key for a connection's describe cache
 */
function getDescribeCacheKey(connectionId: string): string {
    return `${DESCRIBE_CACHE_PREFIX}${connectionId}`;
}

/**
 * Get the describe cache for the current connection
 */
async function getDescribeCache(): Promise<DescribeCache> {
    const connectionId = getActiveConnectionId();
    if (!connectionId) return { global: null, objects: {} };

    const key = getDescribeCacheKey(connectionId);
    const data = await chrome.storage.local.get([key]);
    return (data[key] as DescribeCache) || { global: null, objects: {} };
}

/**
 * Save describe data to cache for the current connection
 */
async function setDescribeCache(
    type: string,
    data: DescribeGlobalResult | ObjectDescribeResult
): Promise<void> {
    const connectionId = getActiveConnectionId();
    if (!connectionId) return;

    const key = getDescribeCacheKey(connectionId);
    const stored = await chrome.storage.local.get([key]);
    const cache: DescribeCache = (stored[key] as DescribeCache) || { global: null, objects: {} };

    if (type === 'global') {
        cache.global = data as DescribeGlobalResult;
    } else {
        cache.objects[type] = data as ObjectDescribeResult;
    }

    await chrome.storage.local.set({ [key]: cache });
}

/**
 * Clear describe cache for the current connection
 */
export async function clearDescribeCache(): Promise<void> {
    const connectionId = getActiveConnectionId();
    if (!connectionId) return;

    await chrome.storage.local.remove(getDescribeCacheKey(connectionId));
}

/**
 * Clear describe cache for a specific connection
 * Used when removing a connection from storage
 */
export async function clearDescribeCacheForConnection(connectionId: string): Promise<void> {
    if (!connectionId) return;
    await chrome.storage.local.remove(getDescribeCacheKey(connectionId));
}

/**
 * Migrate describe cache from old single-key format to per-connection keys
 * Should be called once during app initialization
 */
export async function migrateDescribeCache(): Promise<boolean> {
    const OLD_KEY = 'describeCache';
    const data = await chrome.storage.local.get([OLD_KEY]);
    const oldCache = data[OLD_KEY];

    if (!oldCache || typeof oldCache !== 'object') return false;

    // Migrate each connection to its own key
    const updates: Record<string, DescribeCache> = {};
    for (const [connectionId, cacheData] of Object.entries(oldCache)) {
        updates[getDescribeCacheKey(connectionId)] = cacheData as DescribeCache;
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

interface ChatterUser {
    id: string;
    name: string;
}

/**
 * Get current user ID
 */
export async function getCurrentUserId(): Promise<string> {
    const response = await salesforceRequest<ChatterUser>(
        `/services/data/v${API_VERSION}/chatter/users/me`
    );
    if (!response.json) {
        throw new Error('No user data returned from API');
    }
    return response.json.id;
}

// ============================================================
// Debug Logging (for Apex execution)
// ============================================================

interface DebugLevel {
    Id: string;
}

interface TraceFlag {
    Id: string;
    DebugLevelId: string;
    ExpirationDate: string;
    DebugLevel?: { DeveloperName: string };
}

/**
 * Find or create a DebugLevel with our desired log levels
 */
async function getOrCreateDebugLevel(): Promise<string> {
    const query = encodeURIComponent(
        `SELECT Id FROM DebugLevel WHERE DeveloperName = '${DEBUG_LEVEL_NAME}'`
    );
    const response = await salesforceRequest<QueryResult<DebugLevel>>(
        `/services/data/v${API_VERSION}/tooling/query/?q=${query}`
    );

    if (response.json?.records && response.json.records.length > 0) {
        return response.json.records[0].Id;
    }

    const createResponse = await salesforceRequest<{ id: string }>(
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

    return createResponse.json?.id ?? '';
}

/**
 * Ensure a TraceFlag exists for the current user with correct debug level
 */
async function ensureTraceFlag(userId: string): Promise<string> {
    const now = new Date().toISOString();
    const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;

    const query = encodeURIComponent(
        `SELECT Id, DebugLevelId, DebugLevel.DeveloperName, ExpirationDate FROM TraceFlag WHERE TracedEntityId = '${userId}' AND LogType = 'USER_DEBUG' AND ExpirationDate > ${now}`
    );
    const response = await salesforceRequest<QueryResult<TraceFlag>>(
        `/services/data/v${API_VERSION}/tooling/query/?q=${query}`
    );

    if (response.json?.records && response.json.records.length > 0) {
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

    const createResponse = await salesforceRequest<{ id: string }>(
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

    return createResponse.json?.id ?? '';
}

interface ApexLog {
    Id: string;
    LogLength: number;
    Status: string;
}

/**
 * Get the latest anonymous apex debug log
 */
async function getLatestAnonymousLog(): Promise<string | null> {
    const query = encodeURIComponent(
        `SELECT Id, LogLength, Status FROM ApexLog WHERE Operation LIKE '%executeAnonymous/' ORDER BY StartTime DESC LIMIT 1`
    );
    const response = await salesforceRequest<QueryResult<ApexLog>>(
        `/services/data/v${API_VERSION}/tooling/query/?q=${query}`
    );

    if (!response.json?.records || response.json.records.length === 0) {
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

    return logResponse.data ?? null;
}

// ============================================================
// Apex Execution
// ============================================================

export interface ExecuteAnonymousResult {
    execution: ApexExecutionResult;
    debugLog: string | null;
}

/**
 * Execute anonymous Apex code
 * Sets up trace flags, executes the code, and retrieves the debug log
 */
export async function executeAnonymousApex(
    apexCode: string,
    onProgress?: (message: string) => void
): Promise<ExecuteAnonymousResult> {
    // Step 1: Setup trace flag
    onProgress?.('Setting up trace...');
    const userId = await getCurrentUserId();
    await ensureTraceFlag(userId);

    // Step 2: Execute the apex
    onProgress?.('Executing...');
    const encodedCode = encodeURIComponent(apexCode);
    const response = await salesforceRequest<ApexExecutionResult>(
        `/services/data/v${API_VERSION}/tooling/executeAnonymous/?anonymousBody=${encodedCode}`
    );
    const execution = response.json;

    if (!execution) {
        throw new Error('No execution result returned from API');
    }

    // Step 3: Get debug log (only if execution was attempted)
    let debugLog: string | null = null;
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

import type { ColumnMetadata } from '../types/salesforce';

export interface QueryWithColumnsResult {
    records: SObject[];
    totalSize: number;
    columnMetadata: ColumnMetadata[];
    entityName: string | null;
}

/**
 * Execute a SOQL query with column metadata
 * Fetches column metadata first, then query results
 */
export async function executeQueryWithColumns(
    soql: string,
    useToolingApi = false
): Promise<QueryWithColumnsResult> {
    const encodedQuery = encodeURIComponent(soql);
    const apiPath = useToolingApi ? 'tooling/query' : 'query';
    const baseUrl = `/services/data/v${API_VERSION}/${apiPath}/?q=${encodedQuery}`;

    // Execute columns request first to fail fast on query errors
    const columnsResponse = await salesforceRequest<{
        columnMetadata?: ColumnMetadata[];
        entityName?: string;
    }>(`${baseUrl}&columns=true`);
    const columnData = columnsResponse.json ?? { columnMetadata: [], entityName: null };

    // Only proceed with data request if columns request succeeded
    const dataResponse = await salesforceRequest<QueryResult>(`${baseUrl}`);
    const queryData = dataResponse.json ?? { records: [], totalSize: 0, done: true };

    return {
        records: queryData.records ?? [],
        totalSize: queryData.totalSize ?? 0,
        columnMetadata: columnData.columnMetadata ?? [],
        entityName: columnData.entityName ?? null,
    };
}

// ============================================================
// SObject Operations
// ============================================================

/**
 * Get global describe metadata (all objects)
 * Uses cache if available, otherwise fetches and caches
 */
export async function getGlobalDescribe(bypassCache = false): Promise<DescribeGlobalResult> {
    if (!bypassCache) {
        const cache = await getDescribeCache();
        if (cache.global) {
            return cache.global;
        }
    }

    const response = await salesforceRequest<DescribeGlobalResult>(
        `/services/data/v${API_VERSION}/sobjects`
    );
    const data = response.json;

    if (!data) {
        throw new Error('No global describe data returned from API');
    }

    // Cache the result
    await setDescribeCache('global', data);

    return data;
}

/**
 * Get object describe metadata (field definitions, etc.)
 * Uses cache if available, otherwise fetches and caches
 */
export async function getObjectDescribe(
    objectType: string,
    bypassCache = false
): Promise<ObjectDescribeResult> {
    if (!bypassCache) {
        const cache = await getDescribeCache();
        if (cache.objects[objectType]) {
            return cache.objects[objectType];
        }
    }

    const response = await salesforceRequest<ObjectDescribeResult>(
        `/services/data/v${API_VERSION}/sobjects/${objectType}/describe`
    );
    const data = response.json;

    if (!data) {
        throw new Error(`No describe data returned for ${objectType}`);
    }

    // Cache the result
    await setDescribeCache(objectType, data);

    return data;
}

/**
 * Get a single record by ID
 */
export async function getRecord(objectType: string, recordId: string): Promise<SObject> {
    const response = await salesforceRequest<SObject>(
        `/services/data/v${API_VERSION}/sobjects/${objectType}/${recordId}`
    );
    if (!response.json) {
        throw new Error(`No record data returned for ${objectType} with ID ${recordId}`);
    }
    return response.json;
}

import type { FieldDescribe } from '../types/salesforce';

export interface RecordWithRelationships {
    record: SObject;
    nameFieldMap: Record<string, string>;
}

/**
 * Get a single record with relationship names included
 */
export async function getRecordWithRelationships(
    objectType: string,
    recordId: string,
    fields: FieldDescribe[]
): Promise<RecordWithRelationships> {
    // Collect unique referenced object types
    const referencedTypes = new Set<string>();
    for (const field of fields) {
        if (field.type === 'reference' && field.referenceTo?.length > 0) {
            referencedTypes.add(field.referenceTo[0]);
        }
    }

    // Get describes for all referenced types to find their name fields
    const nameFieldMap: Record<string, string> = {};
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
    const response = await salesforceRequest<QueryResult>(
        `/services/data/v${API_VERSION}/query/?q=${encodeURIComponent(soql)}`
    );

    if (!response.json?.records || response.json.records.length === 0) {
        throw new Error('Record not found');
    }

    return { record: response.json.records[0], nameFieldMap };
}

/**
 * Update a record
 */
export async function updateRecord(
    objectType: string,
    recordId: string,
    fields: Record<string, unknown>
): Promise<void> {
    await salesforceRequest(`/services/data/v${API_VERSION}/sobjects/${objectType}/${recordId}`, {
        method: 'PATCH',
        body: JSON.stringify(fields),
    });
}

// ============================================================
// Generic REST
// ============================================================

import type { RestApiResponse } from '../types/salesforce';

/**
 * Execute a generic REST API request
 * Returns raw response data for the REST API explorer
 */
export async function executeRestRequest(
    endpoint: string,
    method: string,
    body: string | null = null
): Promise<RestApiResponse> {
    const response = await smartFetch(`${getInstanceUrl()}${endpoint}`, {
        method,
        headers: {
            Authorization: `Bearer ${getAccessToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: body ?? undefined,
    });

    let data: unknown = response.data;
    try {
        data = JSON.parse(response.data ?? '');
    } catch {
        // Keep as raw string if not JSON
    }

    return {
        success: response.success,
        status: response.status,
        statusText: response.statusText ?? '',
        error: response.error ?? undefined,
        data,
        raw: response.data ?? '',
    };
}

// ============================================================
// Streaming Channels
// ============================================================

interface EntityDefinition {
    DeveloperName: string;
    QualifiedApiName: string;
    Label: string;
}

interface PushTopic {
    Id: string;
    Name: string;
    Query: string;
    ApiVersion: string;
    IsActive: boolean;
}

/**
 * Get available Platform Event channels
 * Queries for custom Platform Events (entities ending in __e)
 */
export async function getEventChannels(): Promise<{ customEvents: EntityDefinition[] }> {
    const query = encodeURIComponent(
        "SELECT DeveloperName, QualifiedApiName, Label FROM EntityDefinition WHERE QualifiedApiName LIKE '%__e' AND IsCustomizable = true ORDER BY Label"
    );

    const response = await salesforceRequest<QueryResult<EntityDefinition>>(
        `/services/data/v${API_VERSION}/tooling/query?q=${query}`
    );

    return {
        customEvents: response.json?.records ?? [],
    };
}

/**
 * Get active PushTopic channels
 */
export async function getPushTopics(): Promise<PushTopic[]> {
    const query = encodeURIComponent(
        'SELECT Id, Name, Query, ApiVersion, IsActive FROM PushTopic WHERE IsActive = true ORDER BY Name'
    );

    const response = await salesforceRequest<QueryResult<PushTopic>>(
        `/services/data/v${API_VERSION}/query?q=${query}`
    );

    return response.json?.records ?? [];
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

export interface StreamingChannels {
    platformEvents: EntityDefinition[];
    standardEvents: typeof STANDARD_EVENTS;
    pushTopics: PushTopic[];
    systemTopics: typeof SYSTEM_TOPICS;
}

/**
 * Get all streaming channels (unified)
 */
export async function getAllStreamingChannels(): Promise<StreamingChannels> {
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

export interface PublishEventResult {
    success: boolean;
    id: string | null;
    error: string | null;
}

/**
 * Publish a Platform Event
 */
export async function publishPlatformEvent(
    eventType: string,
    payload: Record<string, unknown>
): Promise<PublishEventResult> {
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
        const data = JSON.parse(response.data ?? '{}');
        return { success: true, id: data.id, error: null };
    }

    let errorMsg = 'Publish failed';
    try {
        const errorData = JSON.parse(response.data ?? '{}');
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
 */
export async function deleteAllDebugLogs(): Promise<{ deletedCount: number }> {
    const query = encodeURIComponent('SELECT Id FROM ApexLog');
    const response = await salesforceRequest<QueryResult<{ Id: string }>>(
        `/services/data/v${API_VERSION}/tooling/query/?q=${query}`
    );

    const logIds = (response.json?.records ?? []).map(l => l.Id);
    if (logIds.length === 0) {
        return { deletedCount: 0 };
    }

    const deletedCount = await bulkDeleteTooling('ApexLog', logIds);
    return { deletedCount };
}

interface User {
    Id: string;
    Name: string;
    Username: string;
}

/**
 * Search users by name or username
 */
export async function searchUsers(searchTerm: string): Promise<User[]> {
    const escaped = escapeSoql(searchTerm);
    const query = encodeURIComponent(
        `SELECT Id, Name, Username FROM User WHERE (Name LIKE '%${escaped}%' OR Username LIKE '%${escaped}%') AND IsActive = true ORDER BY Name LIMIT 10`
    );
    const response = await salesforceRequest<QueryResult<User>>(
        `/services/data/v${API_VERSION}/query/?q=${query}`
    );
    return response.json?.records ?? [];
}

/**
 * Enable trace flag for a user (30 minutes)
 */
export async function enableTraceFlagForUser(userId: string): Promise<string> {
    const now = new Date().toISOString();
    const thirtyMinutesFromNow = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    // Check for existing trace flag
    const query = encodeURIComponent(
        `SELECT Id, DebugLevelId, ExpirationDate FROM TraceFlag WHERE TracedEntityId = '${userId}' AND LogType = 'USER_DEBUG' AND DebugLevel.DeveloperName = '${DEBUG_LEVEL_NAME}'`
    );
    const response = await salesforceRequest<QueryResult<TraceFlag>>(
        `/services/data/v${API_VERSION}/tooling/query/?q=${query}`
    );

    if (response.json?.records && response.json.records.length > 0) {
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
    const createResponse = await salesforceRequest<{ id: string }>(
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
    return createResponse.json?.id ?? '';
}

/**
 * Delete all TraceFlag records
 */
export async function deleteAllTraceFlags(): Promise<{ deletedCount: number }> {
    const query = encodeURIComponent('SELECT Id FROM TraceFlag');
    const response = await salesforceRequest<QueryResult<{ Id: string }>>(
        `/services/data/v${API_VERSION}/tooling/query/?q=${query}`
    );

    const flagIds = (response.json?.records ?? []).map(f => f.Id);
    if (flagIds.length === 0) {
        return { deletedCount: 0 };
    }

    const deletedCount = await bulkDeleteTooling('TraceFlag', flagIds);
    return { deletedCount };
}

import type { FlowDefinition, FlowVersion } from '../types/salesforce';

/**
 * Search flows by name
 */
export async function searchFlows(searchTerm: string): Promise<FlowDefinition[]> {
    const escaped = escapeSoql(searchTerm);
    const query = encodeURIComponent(
        `SELECT Id, DeveloperName, ActiveVersionId FROM FlowDefinition WHERE DeveloperName LIKE '%${escaped}%' ORDER BY DeveloperName LIMIT 10`
    );
    const response = await salesforceRequest<QueryResult<FlowDefinition>>(
        `/services/data/v${API_VERSION}/tooling/query/?q=${query}`
    );
    return response.json?.records ?? [];
}

/**
 * Get all versions of a flow
 */
export async function getFlowVersions(flowDefinitionId: string): Promise<FlowVersion[]> {
    const query = encodeURIComponent(
        `SELECT Id, VersionNumber, Status, Description FROM Flow WHERE DefinitionId = '${flowDefinitionId}' ORDER BY VersionNumber DESC`
    );
    const response = await salesforceRequest<QueryResult<FlowVersion>>(
        `/services/data/v${API_VERSION}/tooling/query/?q=${query}`
    );
    return response.json?.records ?? [];
}

/**
 * Delete inactive flow versions
 */
export async function deleteInactiveFlowVersions(
    versionIds: string[]
): Promise<{ deletedCount: number }> {
    if (versionIds.length === 0) {
        return { deletedCount: 0 };
    }

    const deletedCount = await bulkDeleteTooling('Flow', versionIds);
    return { deletedCount };
}

interface Profile {
    Id: string;
    Name: string;
}

/**
 * Search Profiles by name
 */
export async function searchProfiles(searchTerm: string): Promise<Profile[]> {
    const escaped = escapeSoql(searchTerm);
    const query = encodeURIComponent(
        `SELECT Id, Name FROM Profile WHERE Name LIKE '%${escaped}%' ORDER BY Name LIMIT 10`
    );
    const response = await salesforceRequest<QueryResult<Profile>>(
        `/services/data/v${API_VERSION}/query/?q=${query}`
    );
    return response.json?.records ?? [];
}

// ============================================================
// Bulk API v2 - Query Export
// ============================================================

interface BulkQueryJob {
    id: string;
    state: string;
    numberRecordsProcessed?: number;
    errorMessage?: string;
}

/**
 * Create a Bulk API v2 query job
 */
export async function createBulkQueryJob(soql: string): Promise<BulkQueryJob> {
    const response = await salesforceRequest<BulkQueryJob>(
        `/services/data/v${API_VERSION}/jobs/query`,
        {
            method: 'POST',
            body: JSON.stringify({
                operation: 'query',
                query: soql,
            }),
        }
    );
    if (!response.json) {
        throw new Error('No job data returned from bulk query API');
    }
    return response.json;
}

/**
 * Get the status of a Bulk API v2 query job
 */
export async function getBulkQueryJobStatus(jobId: string): Promise<BulkQueryJob> {
    const response = await salesforceRequest<BulkQueryJob>(
        `/services/data/v${API_VERSION}/jobs/query/${jobId}`
    );
    if (!response.json) {
        throw new Error(`No job status returned for job ${jobId}`);
    }
    return response.json;
}

/**
 * Get the CSV results of a completed Bulk API v2 query job
 */
export async function getBulkQueryResults(jobId: string): Promise<string> {
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
        throw new Error(response.error ?? 'Failed to fetch results');
    }

    return response.data ?? '';
}

/**
 * Abort a Bulk API v2 query job
 */
export async function abortBulkQueryJob(jobId: string): Promise<void> {
    await salesforceRequest(`/services/data/v${API_VERSION}/jobs/query/${jobId}`, {
        method: 'PATCH',
        body: JSON.stringify({ state: 'Aborted' }),
    });
}

/**
 * Execute a bulk query export with polling
 * Handles job creation, polling, and result retrieval
 */
export async function executeBulkQueryExport(
    soql: string,
    onProgress?: (state: string, recordCount?: number) => void
): Promise<string> {
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

interface CustomField {
    Id: string;
    FullName: string;
    Metadata: {
        formula?: string;
        [key: string]: unknown;
    };
}

export interface FormulaFieldMetadata {
    id: string;
    formula: string;
    fullName: string;
    metadata: CustomField['Metadata'];
}

/**
 * Get formula field metadata from Tooling API
 */
export async function getFormulaFieldMetadata(
    objectType: string,
    fieldName: string
): Promise<FormulaFieldMetadata> {
    // Query the CustomField via Tooling API
    const query = encodeURIComponent(
        `SELECT Id, FullName, Metadata FROM CustomField WHERE TableEnumOrId = '${objectType}' AND DeveloperName = '${fieldName.replace(/__c$/, '')}'`
    );
    const response = await salesforceRequest<QueryResult<CustomField>>(
        `/services/data/v${API_VERSION}/tooling/query/?q=${query}`
    );

    if (!response.json?.records || response.json.records.length === 0) {
        throw new Error('Formula field not found');
    }

    const record = response.json.records[0];
    return {
        id: record.Id,
        formula: record.Metadata?.formula ?? '',
        fullName: record.FullName,
        metadata: record.Metadata,
    };
}

/**
 * Update formula field via Tooling API
 */
export async function updateFormulaField(
    fieldId: string,
    formula: string,
    existingMetadata: CustomField['Metadata']
): Promise<void> {
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
