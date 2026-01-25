// Debug Logs - Trace flag and debug log management

import type { QueryResult } from '../types/salesforce';
import { API_VERSION } from './utils.js';
import { getInstanceUrl, getAccessToken } from './auth.js';
import { smartFetch } from './fetch.js';
import { salesforceRequest } from './salesforce-request.js';
import { getNowISO, getISODateFromNow, getFutureDate } from './date-utils.js';

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
// Interfaces
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

interface ApexLog {
    Id: string;
    LogLength: number;
    Status: string;
}

export interface DebugLogStats {
    count: number;
    totalSize: number;
    logIds: string[];
}

// ============================================================
// Private Helpers
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

// ============================================================
// Public Functions
// ============================================================

/**
 * Ensure a TraceFlag exists for the current user with correct debug level
 * Exported for use by executeAnonymousApex in salesforce.ts
 */
export async function ensureTraceFlag(userId: string): Promise<string> {
    const now = getNowISO();
    const expirationThresholdMs = getFutureDate(5).getTime();

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

        if (hasCorrectDebugLevel && expirationTime > expirationThresholdMs) {
            return existing.Id;
        }

        const debugLevelId = hasCorrectDebugLevel
            ? existing.DebugLevelId
            : await getOrCreateDebugLevel();
        const newExpiration = getISODateFromNow(30);

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
    const startDate = getNowISO();
    const expirationDate = getISODateFromNow(30);

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

/**
 * Get the latest anonymous apex debug log
 * Exported for use by executeAnonymousApex in salesforce.ts
 */
export async function getLatestAnonymousLog(): Promise<string | null> {
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

/**
 * Get debug log statistics (count, total size, and IDs)
 * Handles pagination to get all records beyond the 2000 limit
 */
export async function getDebugLogStats(): Promise<DebugLogStats> {
    const allRecords: { Id: string; LogLength: number }[] = [];

    // Initial query
    const query = encodeURIComponent('SELECT Id, LogLength FROM ApexLog');
    let response = await salesforceRequest<QueryResult<{ Id: string; LogLength: number }>>(
        `/services/data/v${API_VERSION}/tooling/query/?q=${query}`
    );

    allRecords.push(...(response.json?.records ?? []));

    // Handle pagination
    while (response.json?.nextRecordsUrl) {
        response = await salesforceRequest<QueryResult<{ Id: string; LogLength: number }>>(
            response.json.nextRecordsUrl
        );
        allRecords.push(...(response.json?.records ?? []));
    }

    return {
        count: allRecords.length,
        totalSize: allRecords.reduce((sum, log) => sum + (log.LogLength || 0), 0),
        logIds: allRecords.map(l => l.Id),
    };
}

/**
 * Delete specific ApexLog records by ID
 */
export async function deleteDebugLogs(logIds: string[]): Promise<{ deletedCount: number }> {
    if (logIds.length === 0) {
        return { deletedCount: 0 };
    }

    const deletedCount = await bulkDeleteTooling('ApexLog', logIds);
    return { deletedCount };
}

/**
 * Delete all ApexLog records
 * @deprecated Use getDebugLogStats() + deleteDebugLogs() for better UX
 */
export async function deleteAllDebugLogs(): Promise<{ deletedCount: number }> {
    const stats = await getDebugLogStats();
    return deleteDebugLogs(stats.logIds);
}

/**
 * Enable trace flag for a user (30 minutes)
 */
export async function enableTraceFlagForUser(userId: string): Promise<string> {
    const now = getNowISO();
    const thirtyMinutesFromNow = getISODateFromNow(30);

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
