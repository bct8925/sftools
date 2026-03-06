/**
 * Utility functions for Apex tab operations
 */

import type { ApexExecutionResult } from '../types/salesforce';

/**
 * Gets a preview of code for display in history/favorites
 * Returns whitespace-collapsed full text; CSS line-clamp handles visual overflow
 */
export function getPreview(code: string): string {
    return code.replace(/\s+/g, ' ').trim() || 'Empty script';
}

/**
 * Formats execution result and debug log for output display
 */
export function formatOutput(result: ApexExecutionResult, debugLog: string | null): string {
    const lines: string[] = [];

    if (!result.compiled) {
        lines.push('=== COMPILATION ERROR ===');
        lines.push(`Line ${result.line}, Column ${result.column || 1}`);
        lines.push(result.compileProblem || 'Unknown compilation error');
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
    }

    return lines.join('\n');
}

/**
 * Filters output lines by search term (case-insensitive)
 */
export function filterLines(lines: string[], filter: string): string[] {
    if (!filter) {
        return lines;
    }

    const lowerFilter = filter.toLowerCase();
    return lines.filter(line => line.toLowerCase().includes(lowerFilter));
}
