// Salesforce Service Module
// All Salesforce API operations for the application

import type {
    DescribeGlobalResult,
    ObjectDescribeResult,
    SObject,
    QueryResult,
    ApexExecutionResult,
    ColumnMetadata,
    FieldDescribe,
    RestApiResponse,
    FlowDefinition,
    FlowVersion,
} from '../types/salesforce';
import { getAccessToken, getInstanceUrl, getActiveConnectionId } from '../auth/auth';
import { API_VERSION } from './constants';
import { smartFetch } from './fetch';
import { salesforceRequest } from './salesforce-request';
import { ensureTraceFlag, getLatestAnonymousLog } from './debug-logs';

// ============================================================
// Tooling API Utilities
// ============================================================

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
 * Escape special characters for SOQL LIKE clauses
 * Handles single quotes (for string literals) and LIKE wildcards
 */
function escapeSoql(str: string): string {
    return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
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

export interface QueryWithColumnsResult {
    records: SObject[];
    totalSize: number;
    done: boolean;
    nextRecordsUrl: string | null;
    columnMetadata: ColumnMetadata[];
    entityName: string | null;
}

export interface QueryMoreResult {
    records: SObject[];
    done: boolean;
    nextRecordsUrl: string | null;
}

/**
 * Execute a SOQL query with column metadata
 * Fetches column metadata first, then query results
 */
export async function executeQueryWithColumns(
    soql: string,
    useToolingApi = false,
    includeDeleted = false
): Promise<QueryWithColumnsResult> {
    const encodedQuery = encodeURIComponent(soql);
    const apiPath = useToolingApi ? 'tooling/query' : includeDeleted ? 'queryAll' : 'query';
    const baseUrl = `/services/data/v${API_VERSION}/${apiPath}/?q=${encodedQuery}`;

    // NOTE: These requests are intentionally sequential, not parallel.
    // The columns request acts as a validation gate — if the SOQL is invalid,
    // we get the error from this lightweight call before running the full data query.
    // This also ensures error messages come from the columns endpoint, which is consistent.
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
        done: queryData.done ?? true,
        nextRecordsUrl: queryData.nextRecordsUrl ?? null,
        columnMetadata: columnData.columnMetadata ?? [],
        entityName: columnData.entityName ?? null,
    };
}

/**
 * Fetch more results from a paginated query using nextRecordsUrl
 */
export async function fetchQueryMore(nextRecordsUrl: string): Promise<QueryMoreResult> {
    const response = await salesforceRequest<QueryResult>(nextRecordsUrl);
    const data = response.json;

    return {
        records: data?.records ?? [],
        done: data?.done ?? true,
        nextRecordsUrl: data?.nextRecordsUrl ?? null,
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
// Streaming Channels - Re-exported from streaming.ts
// ============================================================

// Re-exports for backward compatibility
export {
    getEventChannels,
    getPushTopics,
    getAllStreamingChannels,
    publishPlatformEvent,
    type StreamingChannels,
    type PublishEventResult,
} from './streaming';

// ============================================================
// Utils Tab - API Helpers
// ============================================================

// Re-export debug log functions for backward compatibility
export {
    getDebugLogStats,
    deleteDebugLogs,
    deleteAllDebugLogs,
    enableTraceFlagForUser,
    deleteAllTraceFlags,
    type DebugLogStats,
} from './debug-logs';

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

// ============================================================
// Bulk API v2 - Query Export (Re-exports)
// ============================================================

export {
    createBulkQueryJob,
    getBulkQueryJobStatus,
    getBulkQueryResults,
    abortBulkQueryJob,
    executeBulkQueryExport,
    type BulkQueryJob,
} from './bulk-query';

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
