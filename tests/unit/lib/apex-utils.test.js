/**
 * Tests for src/lib/apex-utils.js
 *
 * Test IDs:
 * - A-U-001: getPreview() - Returns short lines unchanged
 * - A-U-002: applyFilter() - Filters to matching lines
 * - A-U-003: applyFilter() - Case insensitive match
 * - A-U-004: clearFilter() - Shows all output
 * - A-U-005: getPreview() - Returns first non-comment line
 * - A-U-006: getPreview() - Truncates long lines
 * - A-U-007: getPreview() - Skips empty lines
 * - A-U-008: getPreview() - Skips multiple comment lines
 * - A-U-009: formatOutput() - Formats success result
 * - A-U-010: formatOutput() - Formats error result
 * - A-U-011: getPreview() - Returns first line as fallback if all comments
 * - A-U-012: getPreview() - Returns "Empty script" for empty string
 * - A-U-013: getPreview() - Truncates first line fallback if over 50 chars
 * - A-U-014: getPreview() - Handles code with only whitespace
 * - A-U-015: formatOutput() - Formats runtime error without line number
 * - A-U-016: formatOutput() - Formats runtime error without stack trace
 * - A-U-017: formatOutput() - Uses default message for runtime error without exception message
 * - A-U-018: formatOutput() - Defaults column to 1 if missing in compile error
 * - A-U-019: formatOutput() - Includes debug log with successful execution
 * - A-U-020: filterLines() - Returns all lines when filter is null
 * - A-U-021: filterLines() - Returns all lines when filter is undefined
 * - A-U-022: filterLines() - Returns empty array when no matches
 * - A-U-023: filterLines() - Handles empty lines array
 * - A-U-024: filterLines() - Matches partial strings
 * - A-U-025: filterLines() - Matches multiple criteria across different lines
 */

import { describe, it, expect } from 'vitest';
import { getPreview, formatOutput, filterLines } from '../../../src/lib/apex-utils.js';

describe('apex-utils', () => {
    describe('getPreview', () => {
        it('A-U-005: returns first non-comment line', () => {
            const code = `// This is a comment
System.debug('Hello World');`;

            expect(getPreview(code)).toBe("System.debug('Hello World');");
        });

        it('A-U-006: truncates long lines to 50 chars', () => {
            const code =
                'System.debug("This is a very long debug statement that should be truncated");';

            const result = getPreview(code);

            expect(result).toBe('System.debug("This is a very long debug statement ...');
            expect(result.length).toBe(53); // 50 + '...'
        });

        it('A-U-001: returns short lines unchanged', () => {
            const code = 'System.debug("Short");';

            expect(getPreview(code)).toBe('System.debug("Short");');
        });

        it('A-U-007: skips empty lines', () => {
            const code = `

System.debug('Test');`;

            expect(getPreview(code)).toBe("System.debug('Test');");
        });

        it('A-U-008: skips multiple comment lines', () => {
            const code = `// Comment 1
// Comment 2
// Comment 3
List<Account> accounts = [SELECT Id FROM Account];`;

            expect(getPreview(code)).toBe('List<Account> accounts = [SELECT Id FROM Account];');
        });

        it('A-U-011: returns first line as fallback if all comments', () => {
            const code = `// Only a comment
// Another comment`;

            expect(getPreview(code)).toBe('// Only a comment');
        });

        it('A-U-012: returns "Empty script" for empty string', () => {
            expect(getPreview('')).toBe('Empty script');
        });

        it('A-U-013: truncates first line fallback if over 50 chars', () => {
            const code =
                '// This is a very long comment that should be truncated when used as fallback';

            const result = getPreview(code);

            // Substring(0, 50) = 50 chars + '...' = 53 total
            expect(result).toBe('// This is a very long comment that should be trun...');
            expect(result.length).toBe(53);
        });

        it('A-U-014: handles code with only whitespace', () => {
            const code = '   \n\t\n   ';

            expect(getPreview(code)).toBe('Empty script');
        });
    });

    describe('formatOutput', () => {
        it('A-U-009: formats successful execution', () => {
            const result = {
                compiled: true,
                success: true,
            };
            const debugLog = 'DEBUG|Test debug message';

            const output = formatOutput(result, debugLog);

            expect(output).toContain('=== EXECUTION SUCCESSFUL ===');
            expect(output).toContain('=== DEBUG LOG ===');
            expect(output).toContain('DEBUG|Test debug message');
        });

        it('A-U-010: formats compilation error', () => {
            const result = {
                compiled: false,
                success: false,
                line: 5,
                column: 12,
                compileProblem: 'Unexpected token',
            };
            const debugLog = null;

            const output = formatOutput(result, debugLog);

            expect(output).toContain('=== COMPILATION ERROR ===');
            expect(output).toContain('Line 5, Column 12');
            expect(output).toContain('Unexpected token');
            expect(output).toContain('(No debug log available)');
        });

        it('A-U-010: formats runtime error', () => {
            const result = {
                compiled: true,
                success: false,
                line: 3,
                exceptionMessage: 'System.NullPointerException',
                exceptionStackTrace: 'at line 3, column 1',
            };
            const debugLog = 'DEBUG|Before error';

            const output = formatOutput(result, debugLog);

            expect(output).toContain('=== RUNTIME EXCEPTION ===');
            expect(output).toContain('Line 3');
            expect(output).toContain('System.NullPointerException');
            expect(output).toContain('Stack Trace:');
            expect(output).toContain('at line 3, column 1');
            expect(output).toContain('=== DEBUG LOG ===');
            expect(output).toContain('DEBUG|Before error');
        });

        it('A-U-015: formats runtime error without line number', () => {
            const result = {
                compiled: true,
                success: false,
                exceptionMessage: 'Unknown error',
            };

            const output = formatOutput(result, null);

            expect(output).toContain('=== RUNTIME EXCEPTION ===');
            expect(output).toContain('Unknown error');
            expect(output).not.toContain('Line');
        });

        it('A-U-016: formats runtime error without stack trace', () => {
            const result = {
                compiled: true,
                success: false,
                line: 2,
                exceptionMessage: 'Error message only',
            };

            const output = formatOutput(result, null);

            expect(output).not.toContain('Stack Trace:');
            expect(output).toContain('Error message only');
        });

        it('A-U-017: uses default message for runtime error without exception message', () => {
            const result = {
                compiled: true,
                success: false,
            };

            const output = formatOutput(result, null);

            expect(output).toContain('Unknown exception');
        });

        it('A-U-018: defaults column to 1 if missing in compile error', () => {
            const result = {
                compiled: false,
                line: 10,
                compileProblem: 'Syntax error',
            };

            const output = formatOutput(result, null);

            expect(output).toContain('Line 10, Column 1');
        });

        it('A-U-019: includes debug log with successful execution', () => {
            const result = {
                compiled: true,
                success: true,
            };
            const debugLog =
                'USER_DEBUG|[1]|DEBUG|Test message\nUSER_DEBUG|[2]|DEBUG|Another message';

            const output = formatOutput(result, debugLog);

            expect(output).toContain('=== EXECUTION SUCCESSFUL ===');
            expect(output).toContain('=== DEBUG LOG ===');
            expect(output).toContain('USER_DEBUG|[1]|DEBUG|Test message');
            expect(output).toContain('USER_DEBUG|[2]|DEBUG|Another message');
        });
    });

    describe('filterLines', () => {
        const sampleLines = [
            'USER_DEBUG|Test message',
            'ERROR|Something went wrong',
            'DEBUG|Another test',
            'INFO|System information',
        ];

        it('A-U-002: filters to matching lines', () => {
            const result = filterLines(sampleLines, 'test');

            expect(result).toHaveLength(2);
            expect(result[0]).toBe('USER_DEBUG|Test message');
            expect(result[1]).toBe('DEBUG|Another test');
        });

        it('A-U-003: performs case-insensitive match', () => {
            const result = filterLines(sampleLines, 'ERROR');

            expect(result).toHaveLength(1);
            expect(result[0]).toBe('ERROR|Something went wrong');
        });

        it('A-U-004: returns all lines when filter is empty', () => {
            const result = filterLines(sampleLines, '');

            expect(result).toHaveLength(4);
            expect(result).toEqual(sampleLines);
        });

        it('A-U-020: returns all lines when filter is null', () => {
            const result = filterLines(sampleLines, null);

            expect(result).toHaveLength(4);
            expect(result).toEqual(sampleLines);
        });

        it('A-U-021: returns all lines when filter is undefined', () => {
            const result = filterLines(sampleLines, undefined);

            expect(result).toHaveLength(4);
            expect(result).toEqual(sampleLines);
        });

        it('A-U-022: returns empty array when no matches', () => {
            const result = filterLines(sampleLines, 'NOTFOUND');

            expect(result).toHaveLength(0);
        });

        it('A-U-023: handles empty lines array', () => {
            const result = filterLines([], 'test');

            expect(result).toHaveLength(0);
        });

        it('A-U-024: matches partial strings', () => {
            const result = filterLines(sampleLines, 'mess');

            expect(result).toHaveLength(1);
            expect(result[0]).toBe('USER_DEBUG|Test message');
        });

        it('A-U-025: matches multiple criteria across different lines', () => {
            const result = filterLines(sampleLines, 'DEBUG');

            expect(result).toHaveLength(2);
            expect(result[0]).toBe('USER_DEBUG|Test message');
            expect(result[1]).toBe('DEBUG|Another test');
        });
    });
});
