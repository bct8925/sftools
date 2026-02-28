/**
 * Integration tests for Debug Logs API
 *
 * Test IDs: DL-I-001 through DL-I-012
 *
 * Tests trace flag management and debug log operations using the Tooling API.
 * These tests mirror the API calls made by src/api/debug-logs.ts but use the
 * test client from setup.ts instead of extension auth.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { salesforce, uniqueName, waitFor } from './setup.js';

const API_VERSION = '62.0';
const DEBUG_LEVEL_NAME = 'SFTOOLS_DEBUG_TEST';

interface TraceFlag {
    Id: string;
    TracedEntityId: string;
    DebugLevelId: string;
    LogType: string;
    ExpirationDate: string;
    StartDate: string;
}

interface DebugLevel {
    Id: string;
    DeveloperName: string;
}

interface ApexLog {
    Id: string;
    LogLength: number;
    Status: string;
    Operation: string;
    StartTime: string;
}

interface ApexExecutionResult {
    success: boolean;
    compiled: boolean;
    compileProblem: string | null;
    exceptionMessage: string | null;
    exceptionStackTrace: string | null;
    line: number;
    column: number;
}

// Cleanup tracking
const createdTraceFlagIds: string[] = [];
const createdDebugLevelIds: string[] = [];
const createdLogIds: string[] = [];
let currentUserId: string;

/**
 * Get or create a debug level for testing
 */
async function getOrCreateTestDebugLevel(): Promise<string> {
    // Check for existing
    const existing = await salesforce.toolingQuery<DebugLevel>(
        `SELECT Id FROM DebugLevel WHERE DeveloperName = '${DEBUG_LEVEL_NAME}'`
    );

    if (existing.length > 0) {
        return existing[0].Id;
    }

    // Create new debug level
    const response = await salesforce.toolingRequest<{ id: string }>(
        'POST',
        '/sobjects/DebugLevel',
        {
            DeveloperName: DEBUG_LEVEL_NAME,
            MasterLabel: 'SFTools Test Debug Level',
            ApexCode: 'FINEST',
            ApexProfiling: 'INFO',
            Callout: 'INFO',
            Database: 'INFO',
            System: 'DEBUG',
            Validation: 'INFO',
            Visualforce: 'INFO',
            Workflow: 'INFO',
        }
    );

    const id = response!.id;
    createdDebugLevelIds.push(id);
    return id;
}

/**
 * Create a trace flag for the current user
 */
async function createTraceFlag(
    userId: string,
    debugLevelId: string,
    expirationMinutes = 30
): Promise<string> {
    const startDate = new Date().toISOString();
    const expirationDate = new Date(Date.now() + expirationMinutes * 60 * 1000).toISOString();

    const response = await salesforce.toolingRequest<{ id: string }>(
        'POST',
        '/sobjects/TraceFlag',
        {
            TracedEntityId: userId,
            DebugLevelId: debugLevelId,
            LogType: 'USER_DEBUG',
            StartDate: startDate,
            ExpirationDate: expirationDate,
        }
    );

    const id = response!.id;
    createdTraceFlagIds.push(id);
    return id;
}

/**
 * Query existing trace flags for user
 */
async function getTraceFlagsForUser(userId: string): Promise<TraceFlag[]> {
    const now = new Date().toISOString();
    return salesforce.toolingQuery<TraceFlag>(
        `SELECT Id, TracedEntityId, DebugLevelId, LogType, ExpirationDate, StartDate FROM TraceFlag WHERE TracedEntityId = '${userId}' AND LogType = 'USER_DEBUG' AND ExpirationDate > ${now}`
    );
}

/**
 * Update trace flag expiration
 */
async function updateTraceFlag(
    traceFlagId: string,
    updates: { ExpirationDate?: string; DebugLevelId?: string }
): Promise<void> {
    await salesforce.toolingRequest('PATCH', `/sobjects/TraceFlag/${traceFlagId}`, updates);
}

/**
 * Delete a trace flag
 */
async function deleteTraceFlag(traceFlagId: string): Promise<void> {
    await salesforce.toolingRequest('DELETE', `/sobjects/TraceFlag/${traceFlagId}`);
}

/**
 * Get debug log statistics
 */
async function getDebugLogStats(): Promise<{ count: number; totalSize: number; logIds: string[] }> {
    const logs = await salesforce.toolingQuery<{ Id: string; LogLength: number }>(
        'SELECT Id, LogLength FROM ApexLog'
    );

    return {
        count: logs.length,
        totalSize: logs.reduce((sum, log) => sum + (log.LogLength || 0), 0),
        logIds: logs.map(l => l.Id),
    };
}

/**
 * Delete debug logs by ID using composite endpoint
 */
async function deleteDebugLogs(logIds: string[]): Promise<number> {
    if (logIds.length === 0) return 0;

    let deletedCount = 0;
    const batchSize = 25;

    for (let i = 0; i < logIds.length; i += batchSize) {
        const batch = logIds.slice(i, i + batchSize);
        const compositeRequest = {
            allOrNone: false,
            compositeRequest: batch.map((id, idx) => ({
                method: 'DELETE',
                url: `/services/data/v${API_VERSION}/tooling/sobjects/ApexLog/${id}`,
                referenceId: `delete_${idx}`,
            })),
        };

        await salesforce.toolingRequest('POST', '/composite', compositeRequest);
        deletedCount += batch.length;
    }

    return deletedCount;
}

/**
 * Get debug logs since a timestamp
 */
async function getDebugLogsSince(sinceISO: string): Promise<ApexLog[]> {
    return salesforce.toolingQuery<ApexLog>(
        `SELECT Id, LogLength, Status, Operation, StartTime FROM ApexLog WHERE StartTime >= ${sinceISO} ORDER BY StartTime DESC`
    );
}

/**
 * Get debug log body
 */
async function getLogBody(logId: string): Promise<string> {
    const url = `${salesforce.instanceUrl}/services/data/v${API_VERSION}/tooling/sobjects/ApexLog/${logId}/Body`;

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${salesforce.accessToken}`,
            Accept: 'text/plain',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to get log body: ${response.statusText}`);
    }

    return response.text();
}

/**
 * Delete all trace flags in the org
 */
async function deleteAllTraceFlags(): Promise<number> {
    const flags = await salesforce.toolingQuery<{ Id: string }>('SELECT Id FROM TraceFlag');
    const flagIds = flags.map(f => f.Id);

    if (flagIds.length === 0) return 0;

    let deletedCount = 0;
    const batchSize = 25;

    for (let i = 0; i < flagIds.length; i += batchSize) {
        const batch = flagIds.slice(i, i + batchSize);
        const compositeRequest = {
            allOrNone: false,
            compositeRequest: batch.map((id, idx) => ({
                method: 'DELETE',
                url: `/services/data/v${API_VERSION}/tooling/sobjects/TraceFlag/${id}`,
                referenceId: `delete_${idx}`,
            })),
        };

        await salesforce.toolingRequest('POST', '/composite', compositeRequest);
        deletedCount += batch.length;
    }

    return deletedCount;
}

describe('Debug Logs Integration', () => {
    beforeAll(async () => {
        // Get current user ID
        const user = await salesforce.getCurrentUser<{ id: string }>();
        currentUserId = user.id;
    });

    afterEach(async () => {
        // Clean up created trace flags
        for (const id of createdTraceFlagIds) {
            try {
                await deleteTraceFlag(id);
            } catch {
                // Ignore - may already be deleted
            }
        }
        createdTraceFlagIds.length = 0;

        // Clean up created debug levels (only test-created ones)
        for (const id of createdDebugLevelIds) {
            try {
                await salesforce.toolingRequest('DELETE', `/sobjects/DebugLevel/${id}`);
            } catch {
                // Ignore - may have dependent trace flags or already deleted
            }
        }
        createdDebugLevelIds.length = 0;

        // Clean up created logs
        if (createdLogIds.length > 0) {
            try {
                await deleteDebugLogs(createdLogIds);
            } catch {
                // Ignore cleanup errors
            }
        }
        createdLogIds.length = 0;
    });

    describe('Trace Flag Management', () => {
        describe('DL-I-001: ensureTraceFlag() creates trace flag when none exists', () => {
            it('creates a new trace flag for user', async () => {
                // First delete any existing trace flags for this user
                const existing = await getTraceFlagsForUser(currentUserId);
                for (const flag of existing) {
                    await deleteTraceFlag(flag.Id);
                }

                // Create debug level and trace flag
                const debugLevelId = await getOrCreateTestDebugLevel();
                const traceFlagId = await createTraceFlag(currentUserId, debugLevelId);

                expect(traceFlagId).toBeTruthy();
                expect(traceFlagId).toMatch(/^7tf/i); // TraceFlag ID prefix

                // Verify trace flag exists
                const flags = await getTraceFlagsForUser(currentUserId);
                expect(flags.length).toBeGreaterThanOrEqual(1);

                const created = flags.find(f => f.Id === traceFlagId);
                expect(created).toBeDefined();
                expect(created!.TracedEntityId).toBe(currentUserId);
                expect(created!.LogType).toBe('USER_DEBUG');
            });
        });

        describe('DL-I-002: ensureTraceFlag() returns existing trace flag if valid', () => {
            it('finds existing valid trace flag', async () => {
                const debugLevelId = await getOrCreateTestDebugLevel();

                // Create first trace flag with 30 min expiration
                const firstFlagId = await createTraceFlag(currentUserId, debugLevelId, 30);

                // Query for existing trace flags - should find the one we just created
                const flags = await getTraceFlagsForUser(currentUserId);

                const found = flags.find(f => f.Id === firstFlagId);
                expect(found).toBeDefined();
                expect(found!.Id).toBe(firstFlagId);

                // Verify it has proper expiration (> 5 minutes from now)
                const expiration = new Date(found!.ExpirationDate);
                const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
                expect(expiration.getTime()).toBeGreaterThan(fiveMinutesFromNow.getTime());
            });
        });

        describe('DL-I-003: ensureTraceFlag() updates trace flag when expiring soon', () => {
            it('extends expiration of trace flag expiring within 5 minutes', async () => {
                const debugLevelId = await getOrCreateTestDebugLevel();

                // Create trace flag expiring in 2 minutes
                const traceFlagId = await createTraceFlag(currentUserId, debugLevelId, 2);

                // Verify initial expiration is soon
                let flags = await getTraceFlagsForUser(currentUserId);
                let flag = flags.find(f => f.Id === traceFlagId);
                expect(flag).toBeDefined();

                const initialExpiration = new Date(flag!.ExpirationDate);
                const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);
                expect(initialExpiration.getTime()).toBeLessThan(tenMinutesFromNow.getTime());

                // Update expiration to 30 minutes
                const newExpiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();
                await updateTraceFlag(traceFlagId, { ExpirationDate: newExpiration });

                // Verify expiration was extended
                flags = await getTraceFlagsForUser(currentUserId);
                flag = flags.find(f => f.Id === traceFlagId);
                expect(flag).toBeDefined();

                const updatedExpiration = new Date(flag!.ExpirationDate);
                expect(updatedExpiration.getTime()).toBeGreaterThan(initialExpiration.getTime());
            });
        });

        describe('DL-I-004: enableTraceFlagForUser() creates new trace flag', () => {
            it('creates trace flag with 30 minute expiration', async () => {
                // Delete existing trace flags
                const existing = await getTraceFlagsForUser(currentUserId);
                for (const flag of existing) {
                    await deleteTraceFlag(flag.Id);
                }

                const debugLevelId = await getOrCreateTestDebugLevel();
                const traceFlagId = await createTraceFlag(currentUserId, debugLevelId, 30);

                const flags = await getTraceFlagsForUser(currentUserId);
                const created = flags.find(f => f.Id === traceFlagId);

                expect(created).toBeDefined();

                // Verify expiration is approximately 30 minutes from now
                const expiration = new Date(created!.ExpirationDate);
                const expectedMin = new Date(Date.now() + 25 * 60 * 1000);
                const expectedMax = new Date(Date.now() + 35 * 60 * 1000);

                expect(expiration.getTime()).toBeGreaterThan(expectedMin.getTime());
                expect(expiration.getTime()).toBeLessThan(expectedMax.getTime());
            });
        });

        describe('DL-I-005: enableTraceFlagForUser() updates existing trace flag', () => {
            it('extends expiration of existing trace flag', async () => {
                const debugLevelId = await getOrCreateTestDebugLevel();

                // Create initial trace flag with short expiration
                const traceFlagId = await createTraceFlag(currentUserId, debugLevelId, 5);

                // Update to 30 minutes
                const newExpiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();
                const newStartDate = new Date().toISOString();
                await updateTraceFlag(traceFlagId, { ExpirationDate: newExpiration });

                // Verify updated
                const flags = await getTraceFlagsForUser(currentUserId);
                const updated = flags.find(f => f.Id === traceFlagId);

                expect(updated).toBeDefined();
                const expiration = new Date(updated!.ExpirationDate);
                const twentyFiveMinutesFromNow = new Date(Date.now() + 25 * 60 * 1000);
                expect(expiration.getTime()).toBeGreaterThan(twentyFiveMinutesFromNow.getTime());
            });
        });

        describe('DL-I-006: deleteAllTraceFlags() deletes all trace flags', () => {
            it('removes all trace flags from org', async () => {
                const debugLevelId = await getOrCreateTestDebugLevel();

                // Create multiple trace flags (need different users, but we only have one)
                // So we'll just create one and verify delete works
                await createTraceFlag(currentUserId, debugLevelId, 30);

                // Verify at least one exists
                let flags = await salesforce.toolingQuery<{ Id: string }>(
                    'SELECT Id FROM TraceFlag'
                );
                expect(flags.length).toBeGreaterThan(0);

                // Delete all
                const deletedCount = await deleteAllTraceFlags();

                // Verify all deleted
                flags = await salesforce.toolingQuery<{ Id: string }>('SELECT Id FROM TraceFlag');
                expect(flags.length).toBe(0);
                expect(deletedCount).toBeGreaterThan(0);

                // Clear tracking since we already deleted
                createdTraceFlagIds.length = 0;
            });
        });
    });

    describe('Debug Log Operations', () => {
        describe('DL-I-007: getDebugLogStats() returns correct count and size', () => {
            it('returns log count and total size', async () => {
                const stats = await getDebugLogStats();

                expect(stats).toHaveProperty('count');
                expect(stats).toHaveProperty('totalSize');
                expect(stats).toHaveProperty('logIds');

                expect(typeof stats.count).toBe('number');
                expect(typeof stats.totalSize).toBe('number');
                expect(Array.isArray(stats.logIds)).toBe(true);
                expect(stats.count).toBe(stats.logIds.length);
            });
        });

        describe('DL-I-008: deleteDebugLogs() deletes specific logs by ID', () => {
            it('deletes specified log IDs', async () => {
                // First create a debug log by executing apex
                const debugLevelId = await getOrCreateTestDebugLevel();
                await createTraceFlag(currentUserId, debugLevelId, 30);

                const testMarker = uniqueName('DL_TEST');
                await salesforce.executeAnonymousApex(`System.debug('${testMarker}');`);

                // Wait for log to appear
                await waitFor(
                    async () => {
                        const stats = await getDebugLogStats();
                        return stats.count > 0;
                    },
                    { timeout: 30000, interval: 2000, message: 'Debug log not created' }
                );

                // Get current stats
                const statsBefore = await getDebugLogStats();
                expect(statsBefore.count).toBeGreaterThan(0);

                // Delete one log
                const logToDelete = statsBefore.logIds[0];
                const deletedCount = await deleteDebugLogs([logToDelete]);

                expect(deletedCount).toBe(1);

                // Verify the deleted log is no longer present
                // (checking exact count is flaky since the active trace flag can generate new logs)
                const statsAfter = await getDebugLogStats();
                expect(statsAfter.logIds).not.toContain(logToDelete);
            });
        });

        describe('DL-I-009: deleteDebugLogs() returns 0 for empty array', () => {
            it('handles empty array gracefully', async () => {
                const deletedCount = await deleteDebugLogs([]);
                expect(deletedCount).toBe(0);
            });
        });

        describe('DL-I-010: getDebugLogsSince() returns logs since timestamp', () => {
            it('returns logs created after specified time', async () => {
                // Set up trace flag
                const debugLevelId = await getOrCreateTestDebugLevel();
                await createTraceFlag(currentUserId, debugLevelId, 30);

                // Record time before execution
                const beforeTime = new Date().toISOString();

                // Execute apex to generate a log
                const testMarker = uniqueName('DL_SINCE');
                await salesforce.executeAnonymousApex(`System.debug('${testMarker}');`);

                // Wait for log
                await waitFor(
                    async () => {
                        const logs = await getDebugLogsSince(beforeTime);
                        return logs.length > 0;
                    },
                    { timeout: 30000, interval: 2000, message: 'Debug log not found' }
                );

                const logs = await getDebugLogsSince(beforeTime);

                expect(logs.length).toBeGreaterThan(0);
                expect(logs[0]).toHaveProperty('Id');
                expect(logs[0]).toHaveProperty('LogLength');
                expect(logs[0]).toHaveProperty('Status');
                expect(logs[0]).toHaveProperty('Operation');
                expect(logs[0]).toHaveProperty('StartTime');

                // All returned logs should be approximately after our timestamp
                // Allow 2 second buffer for clock differences between server and client
                const bufferMs = 2000;
                for (const log of logs) {
                    const logTime = new Date(log.StartTime);
                    const sinceTime = new Date(beforeTime);
                    expect(logTime.getTime()).toBeGreaterThanOrEqual(
                        sinceTime.getTime() - bufferMs
                    );
                }
            });
        });

        describe('DL-I-011: getLogBody() returns log content', () => {
            it('retrieves debug log body text', async () => {
                // Set up trace flag
                const debugLevelId = await getOrCreateTestDebugLevel();
                await createTraceFlag(currentUserId, debugLevelId, 30);

                // Execute apex with unique marker
                const testMarker = uniqueName('DL_BODY');
                const beforeTime = new Date().toISOString();
                await salesforce.executeAnonymousApex(`System.debug('${testMarker}');`);

                // Wait for log
                let logs: ApexLog[] = [];

                await waitFor(
                    async () => {
                        logs = await getDebugLogsSince(beforeTime);
                        return logs.some(l => l.Operation?.includes('executeAnonymous'));
                    },
                    { timeout: 30000, interval: 2000, message: 'Anonymous apex log not found' }
                );

                const anonymousLog = logs.find(l => l.Operation?.includes('executeAnonymous'));
                expect(anonymousLog).toBeDefined();

                // Get log body
                const body = await getLogBody(anonymousLog!.Id);

                expect(typeof body).toBe('string');
                expect(body.length).toBeGreaterThan(0);
                expect(body).toContain(testMarker);
            });
        });

        describe('DL-I-012: getLatestAnonymousLog() returns log after apex execution', () => {
            it('finds the most recent anonymous apex log', async () => {
                // Set up trace flag
                const debugLevelId = await getOrCreateTestDebugLevel();
                await createTraceFlag(currentUserId, debugLevelId, 30);

                // Execute apex
                const testMarker = uniqueName('DL_LATEST');
                const result = await salesforce.executeAnonymousApex<ApexExecutionResult>(
                    `System.debug('${testMarker}');`
                );

                expect(result.success).toBe(true);

                // Wait and query for latest anonymous log
                await waitFor(
                    async () => {
                        const logs = await salesforce.toolingQuery<ApexLog>(
                            `SELECT Id, LogLength, Status FROM ApexLog WHERE Operation LIKE '%executeAnonymous%' ORDER BY StartTime DESC LIMIT 1`
                        );
                        return logs.length > 0;
                    },
                    { timeout: 30000, interval: 2000, message: 'Anonymous apex log not found' }
                );

                const logs = await salesforce.toolingQuery<ApexLog>(
                    `SELECT Id, LogLength, Status FROM ApexLog WHERE Operation LIKE '%executeAnonymous%' ORDER BY StartTime DESC LIMIT 1`
                );

                expect(logs.length).toBe(1);
                expect(logs[0].Id).toBeTruthy();

                // Verify we can get the body
                const body = await getLogBody(logs[0].Id);
                expect(body).toContain(testMarker);
            });
        });
    });
});
