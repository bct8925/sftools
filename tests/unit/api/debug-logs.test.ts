/**
 * Tests for src/lib/debug-logs.ts
 *
 * Test IDs: DL-U-001 through DL-U-024
 * - DL-U-001: getDebugLogsSince() - Returns logs since specified time
 * - DL-U-002: getDebugLogsSince() - Correct query with date filter
 * - DL-U-003: getLogBody() - Returns log body content
 * - DL-U-004: getLogBody() - Correct endpoint
 * - DL-U-005: getLogBody() - Throws error when fetch fails
 * - DL-U-006: ensureTraceFlag() - Returns existing valid trace flag
 * - DL-U-007: ensureTraceFlag() - Updates trace flag with wrong debug level
 * - DL-U-008: ensureTraceFlag() - Updates trace flag expiring soon
 * - DL-U-009: ensureTraceFlag() - Creates new trace flag when none exists
 * - DL-U-010: getLatestAnonymousLog() - Returns log body for latest anonymous log
 * - DL-U-011: getLatestAnonymousLog() - Returns null when no logs found
 * - DL-U-012: getDebugLogStats() - Returns stats for single page of logs
 * - DL-U-013: getDebugLogStats() - Handles pagination across multiple pages
 * - DL-U-014: deleteDebugLogs() - Returns 0 when no IDs provided
 * - DL-U-015: deleteDebugLogs() - Deletes logs in batches of 25
 * - DL-U-016: deleteDebugLogs() - Handles multiple batches
 * - DL-U-017: deleteAllDebugLogs() - Calls getDebugLogStats and deleteDebugLogs
 * - DL-U-018: enableTraceFlagForUser() - Updates existing trace flag
 * - DL-U-019: enableTraceFlagForUser() - Creates new trace flag
 * - DL-U-020: deleteAllTraceFlags() - Returns 0 when no flags exist
 * - DL-U-021: deleteAllTraceFlags() - Deletes all trace flags
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../../../src/api/salesforce-request.js', () => ({
    salesforceRequest: vi.fn(),
}));

vi.mock('../../../src/api/fetch.js', () => ({
    smartFetch: vi.fn(),
}));

vi.mock('../../../src/auth/auth.js', () => ({
    getAccessToken: vi.fn(),
    getInstanceUrl: vi.fn(),
}));

vi.mock('../../../src/lib/date-utils.js', () => ({
    getNowISO: vi.fn(),
    getISODateFromNow: vi.fn(),
    getFutureDate: vi.fn(),
}));

// Import after mocking
import {
    getDebugLogsSince,
    getLogBody,
    ensureTraceFlag,
    getLatestAnonymousLog,
    getDebugLogStats,
    deleteDebugLogs,
    deleteAllDebugLogs,
    enableTraceFlagForUser,
    deleteAllTraceFlags,
} from '../../../src/api/debug-logs.js';
import { salesforceRequest } from '../../../src/api/salesforce-request.js';
import { smartFetch } from '../../../src/api/fetch.js';
import { getAccessToken, getInstanceUrl } from '../../../src/auth/auth.js';
import { getNowISO, getISODateFromNow, getFutureDate } from '../../../src/lib/date-utils.js';

describe('debug-logs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getAccessToken.mockReturnValue('test-token');
        getInstanceUrl.mockReturnValue('https://test.salesforce.com');
        getNowISO.mockReturnValue('2024-01-26T22:00:00.000Z');
        getISODateFromNow.mockReturnValue('2024-02-25T22:00:00.000Z');
        getFutureDate.mockReturnValue(new Date('2024-01-26T22:05:00.000Z'));
    });

    describe('getDebugLogsSince', () => {
        it('DL-U-001: returns logs since specified time', async () => {
            const mockLogs = [
                {
                    Id: '07L001',
                    LogUser: { Name: 'Test User' },
                    LogLength: 1024,
                    Operation: '/apex/executeAnonymous/',
                    Request: 'Api',
                    Status: 'Success',
                    StartTime: '2024-01-26T22:00:00.000+0000',
                },
                {
                    Id: '07L002',
                    LogUser: { Name: 'Test User' },
                    LogLength: 2048,
                    Operation: '/apex/TestClass/',
                    Request: 'Api',
                    Status: 'Success',
                    StartTime: '2024-01-26T22:05:00.000+0000',
                },
            ];

            salesforceRequest.mockResolvedValue({
                json: { records: mockLogs },
            });

            const result = await getDebugLogsSince('2024-01-26T22:00:00.000Z');

            expect(result).toHaveLength(2);
            expect(result[0].Id).toBe('07L001');
            expect(result[1].LogUser.Name).toBe('Test User');
        });

        it('DL-U-002: builds correct query with date filter', async () => {
            salesforceRequest.mockResolvedValue({ json: { records: [] } });

            const sinceISO = '2024-01-26T22:00:00.000Z';
            await getDebugLogsSince(sinceISO);

            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/tooling/query/')
            );
            // Check the query includes the date filter
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining(encodeURIComponent('StartTime >='))
            );
            // Check it orders by StartTime DESC
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining(encodeURIComponent('ORDER BY StartTime DESC'))
            );
        });

        it('returns empty array when no logs found', async () => {
            salesforceRequest.mockResolvedValue({ json: { records: null } });

            const result = await getDebugLogsSince('2024-01-26T22:00:00.000Z');

            expect(result).toEqual([]);
        });
    });

    describe('getLogBody', () => {
        it('DL-U-003: returns log body content', async () => {
            const mockLogBody =
                '12:00:00.001|USER_DEBUG|[5]|DEBUG|Hello World\n12:00:00.002|EXECUTION_FINISHED';

            smartFetch.mockResolvedValue({
                success: true,
                data: mockLogBody,
            });

            const result = await getLogBody('07L001');

            expect(result).toBe(mockLogBody);
        });

        it('DL-U-004: calls correct endpoint with auth header', async () => {
            smartFetch.mockResolvedValue({ success: true, data: 'log content' });

            await getLogBody('07L123');

            expect(smartFetch).toHaveBeenCalledWith(
                expect.stringContaining('/tooling/sobjects/ApexLog/07L123/Body'),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer test-token',
                    }),
                })
            );
        });

        it('returns empty string when no data', async () => {
            smartFetch.mockResolvedValue({ success: true, data: null });

            const result = await getLogBody('07L999');

            expect(result).toBe('');
        });

        it('DL-U-005: throws error when fetch fails', async () => {
            smartFetch.mockResolvedValue({
                success: false,
                error: 'Network error',
            });

            await expect(getLogBody('07L001')).rejects.toThrow('Network error');
        });

        it('throws error with default message when no error provided', async () => {
            smartFetch.mockResolvedValue({
                success: false,
            });

            await expect(getLogBody('07L001')).rejects.toThrow('Failed to fetch log body');
        });
    });

    describe('ensureTraceFlag', () => {
        const userId = '005xx000000001';

        it('DL-U-006: returns existing valid trace flag', async () => {
            const futureExpiration = '2024-02-26T22:00:00.000Z';
            salesforceRequest.mockResolvedValue({
                json: {
                    records: [
                        {
                            Id: 'TF001',
                            DebugLevelId: 'DL001',
                            ExpirationDate: futureExpiration,
                            DebugLevel: { DeveloperName: 'SFTOOLS_DEBUG' },
                        },
                    ],
                },
            });

            const result = await ensureTraceFlag(userId);

            expect(result).toBe('TF001');
            expect(salesforceRequest).toHaveBeenCalledTimes(1);
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/tooling/query/')
            );
        });

        it('DL-U-007: updates trace flag with wrong debug level', async () => {
            salesforceRequest
                .mockResolvedValueOnce({
                    json: {
                        records: [
                            {
                                Id: 'TF001',
                                DebugLevelId: 'DL_WRONG',
                                ExpirationDate: '2024-02-26T22:00:00.000Z',
                                DebugLevel: { DeveloperName: 'WRONG_DEBUG_LEVEL' },
                            },
                        ],
                    },
                })
                .mockResolvedValueOnce({
                    json: {
                        records: [{ Id: 'DL001' }],
                    },
                })
                .mockResolvedValueOnce({});

            const result = await ensureTraceFlag(userId);

            expect(result).toBe('TF001');
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/tooling/sobjects/TraceFlag/TF001'),
                expect.objectContaining({
                    method: 'PATCH',
                    body: expect.stringContaining('DL001'),
                })
            );
        });

        it('DL-U-008: updates trace flag expiring soon', async () => {
            const soonExpiration = '2024-01-26T22:04:00.000Z'; // Before threshold
            salesforceRequest
                .mockResolvedValueOnce({
                    json: {
                        records: [
                            {
                                Id: 'TF001',
                                DebugLevelId: 'DL001',
                                ExpirationDate: soonExpiration,
                                DebugLevel: { DeveloperName: 'SFTOOLS_DEBUG' },
                            },
                        ],
                    },
                })
                .mockResolvedValueOnce({});

            const result = await ensureTraceFlag(userId);

            expect(result).toBe('TF001');
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/tooling/sobjects/TraceFlag/TF001'),
                expect.objectContaining({
                    method: 'PATCH',
                })
            );
        });

        it('DL-U-009: creates new trace flag when none exists', async () => {
            salesforceRequest
                .mockResolvedValueOnce({
                    json: {
                        records: [],
                    },
                })
                .mockResolvedValueOnce({
                    json: {
                        records: [{ Id: 'DL001' }],
                    },
                })
                .mockResolvedValueOnce({
                    json: {
                        id: 'TF_NEW',
                    },
                });

            const result = await ensureTraceFlag(userId);

            expect(result).toBe('TF_NEW');
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/tooling/sobjects/TraceFlag'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining(userId),
                })
            );
        });

        it('creates debug level when it does not exist', async () => {
            salesforceRequest
                .mockResolvedValueOnce({
                    json: {
                        records: [],
                    },
                })
                .mockResolvedValueOnce({
                    json: {
                        records: [],
                    },
                })
                .mockResolvedValueOnce({
                    json: {
                        id: 'DL_NEW',
                    },
                })
                .mockResolvedValueOnce({
                    json: {
                        id: 'TF_NEW',
                    },
                });

            const result = await ensureTraceFlag(userId);

            expect(result).toBe('TF_NEW');
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/tooling/sobjects/DebugLevel'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('SFTOOLS_DEBUG'),
                })
            );
        });
    });

    describe('getLatestAnonymousLog', () => {
        it('DL-U-010: returns log body for latest anonymous log', async () => {
            const logBody = 'DEBUG|Hello World';
            salesforceRequest.mockResolvedValue({
                json: {
                    records: [
                        {
                            Id: '07L001',
                            LogLength: 1024,
                            Status: 'Success',
                        },
                    ],
                },
            });
            smartFetch.mockResolvedValue({
                success: true,
                data: logBody,
            });

            const result = await getLatestAnonymousLog();

            expect(result).toBe(logBody);
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('executeAnonymous')
            );
        });

        it('DL-U-011: returns null when no logs found', async () => {
            salesforceRequest.mockResolvedValue({
                json: {
                    records: [],
                },
            });

            const result = await getLatestAnonymousLog();

            expect(result).toBeNull();
        });

        it('returns null when response has no records field', async () => {
            salesforceRequest.mockResolvedValue({
                json: null,
            });

            const result = await getLatestAnonymousLog();

            expect(result).toBeNull();
        });
    });

    describe('getDebugLogStats', () => {
        it('DL-U-012: returns stats for single page of logs', async () => {
            salesforceRequest.mockResolvedValue({
                json: {
                    records: [
                        { Id: '07L001', LogLength: 1024 },
                        { Id: '07L002', LogLength: 2048 },
                    ],
                },
            });

            const result = await getDebugLogStats();

            expect(result.count).toBe(2);
            expect(result.totalSize).toBe(3072);
            expect(result.logIds).toEqual(['07L001', '07L002']);
        });

        it('DL-U-013: handles pagination across multiple pages', async () => {
            salesforceRequest
                .mockResolvedValueOnce({
                    json: {
                        records: [{ Id: '07L001', LogLength: 1024 }],
                        nextRecordsUrl: '/next-page',
                    },
                })
                .mockResolvedValueOnce({
                    json: {
                        records: [{ Id: '07L002', LogLength: 2048 }],
                    },
                });

            const result = await getDebugLogStats();

            expect(result.count).toBe(2);
            expect(result.totalSize).toBe(3072);
            expect(result.logIds).toEqual(['07L001', '07L002']);
            expect(salesforceRequest).toHaveBeenCalledTimes(2);
        });

        it('handles empty response', async () => {
            salesforceRequest.mockResolvedValue({
                json: {
                    records: [],
                },
            });

            const result = await getDebugLogStats();

            expect(result.count).toBe(0);
            expect(result.totalSize).toBe(0);
            expect(result.logIds).toEqual([]);
        });

        it('handles logs with null LogLength', async () => {
            salesforceRequest.mockResolvedValue({
                json: {
                    records: [
                        { Id: '07L001', LogLength: null },
                        { Id: '07L002', LogLength: 1024 },
                    ],
                },
            });

            const result = await getDebugLogStats();

            expect(result.count).toBe(2);
            expect(result.totalSize).toBe(1024);
        });
    });

    describe('deleteDebugLogs', () => {
        it('DL-U-014: returns 0 when no IDs provided', async () => {
            const result = await deleteDebugLogs([]);

            expect(result.deletedCount).toBe(0);
            expect(salesforceRequest).not.toHaveBeenCalled();
        });

        it('DL-U-015: deletes logs in batches of 25', async () => {
            salesforceRequest.mockResolvedValue({});

            const result = await deleteDebugLogs(['07L001', '07L002', '07L003']);

            expect(result.deletedCount).toBe(3);
            expect(salesforceRequest).toHaveBeenCalledTimes(1);
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/tooling/composite'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('07L001'),
                })
            );
        });

        it('DL-U-016: handles multiple batches', async () => {
            salesforceRequest.mockResolvedValue({});

            const logIds = Array.from({ length: 50 }, (_, i) => `07L${String(i).padStart(3, '0')}`);
            const result = await deleteDebugLogs(logIds);

            expect(result.deletedCount).toBe(50);
            expect(salesforceRequest).toHaveBeenCalledTimes(2); // 25 + 25
        });
    });

    describe('deleteAllDebugLogs', () => {
        it('DL-U-017: calls getDebugLogStats and deleteDebugLogs', async () => {
            salesforceRequest
                .mockResolvedValueOnce({
                    json: {
                        records: [
                            { Id: '07L001', LogLength: 1024 },
                            { Id: '07L002', LogLength: 2048 },
                        ],
                    },
                })
                .mockResolvedValueOnce({});

            const result = await deleteAllDebugLogs();

            expect(result.deletedCount).toBe(2);
            expect(salesforceRequest).toHaveBeenCalledTimes(2);
        });
    });

    describe('enableTraceFlagForUser', () => {
        const userId = '005xx000000001';

        it('DL-U-018: updates existing trace flag', async () => {
            salesforceRequest
                .mockResolvedValueOnce({
                    json: {
                        records: [
                            {
                                Id: 'TF001',
                                DebugLevelId: 'DL001',
                                ExpirationDate: '2024-01-27T00:00:00.000Z',
                            },
                        ],
                    },
                })
                .mockResolvedValueOnce({});

            const result = await enableTraceFlagForUser(userId);

            expect(result).toBe('TF001');
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/tooling/sobjects/TraceFlag/TF001'),
                expect.objectContaining({
                    method: 'PATCH',
                })
            );
        });

        it('DL-U-019: creates new trace flag', async () => {
            salesforceRequest
                .mockResolvedValueOnce({
                    json: {
                        records: [],
                    },
                })
                .mockResolvedValueOnce({
                    json: {
                        records: [{ Id: 'DL001' }],
                    },
                })
                .mockResolvedValueOnce({
                    json: {
                        id: 'TF_NEW',
                    },
                });

            const result = await enableTraceFlagForUser(userId);

            expect(result).toBe('TF_NEW');
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/tooling/sobjects/TraceFlag'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining(userId),
                })
            );
        });
    });

    describe('deleteAllTraceFlags', () => {
        it('DL-U-020: returns 0 when no flags exist', async () => {
            salesforceRequest.mockResolvedValue({
                json: {
                    records: [],
                },
            });

            const result = await deleteAllTraceFlags();

            expect(result.deletedCount).toBe(0);
            expect(salesforceRequest).toHaveBeenCalledTimes(1);
        });

        it('DL-U-021: deletes all trace flags', async () => {
            salesforceRequest
                .mockResolvedValueOnce({
                    json: {
                        records: [{ Id: 'TF001' }, { Id: 'TF002' }],
                    },
                })
                .mockResolvedValueOnce({});

            const result = await deleteAllTraceFlags();

            expect(result.deletedCount).toBe(2);
            expect(salesforceRequest).toHaveBeenCalledTimes(2);
            expect(salesforceRequest).toHaveBeenCalledWith(
                expect.stringContaining('/tooling/composite'),
                expect.objectContaining({
                    method: 'POST',
                })
            );
        });
    });
});
