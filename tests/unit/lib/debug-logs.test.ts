/**
 * Tests for src/lib/debug-logs.ts
 *
 * Test IDs: DL-U-001 through DL-U-004
 * - DL-U-001: getDebugLogsSince() - Returns logs since specified time
 * - DL-U-002: getDebugLogsSince() - Correct query with date filter
 * - DL-U-003: getLogBody() - Returns log body content
 * - DL-U-004: getLogBody() - Correct endpoint
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../../../src/lib/salesforce-request.js', () => ({
    salesforceRequest: vi.fn(),
}));

vi.mock('../../../src/lib/fetch.js', () => ({
    smartFetch: vi.fn(),
}));

vi.mock('../../../src/lib/auth.js', () => ({
    getAccessToken: vi.fn(),
    getInstanceUrl: vi.fn(),
}));

// Import after mocking
import { getDebugLogsSince, getLogBody } from '../../../src/lib/debug-logs.js';
import { salesforceRequest } from '../../../src/lib/salesforce-request.js';
import { smartFetch } from '../../../src/lib/fetch.js';
import { getAccessToken, getInstanceUrl } from '../../../src/lib/auth.js';

describe('debug-logs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getAccessToken.mockReturnValue('test-token');
        getInstanceUrl.mockReturnValue('https://test.salesforce.com');
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
                data: mockLogBody,
            });

            const result = await getLogBody('07L001');

            expect(result).toBe(mockLogBody);
        });

        it('DL-U-004: calls correct endpoint with auth header', async () => {
            smartFetch.mockResolvedValue({ data: 'log content' });

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
            smartFetch.mockResolvedValue({ data: null });

            const result = await getLogBody('07L999');

            expect(result).toBe('');
        });
    });
});
