// CSV Utilities - Shared functions for CSV export and value formatting

import type { SObject } from '../types/salesforce';

/**
 * Column definition for formatting cell values.
 */
export interface FormatColumn {
  /** Field path (dot notation for relationships) */
  path: string;
  /** Whether this column is a subquery */
  isSubquery?: boolean;
}

/**
 * Get value from record by dot-notation path.
 * Handles nested relationship fields like "Account.Owner.Name".
 *
 * @param record - The record object to traverse
 * @param path - Dot-notation path to the value
 * @returns The value at the path, or undefined if not found
 */
export function getValueByPath(record: SObject, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split('.');
  let value: unknown = record;
  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

/**
 * Format a cell value for display in the UI.
 * Handles subqueries, objects, and primitive values.
 *
 * @param value - The value to format
 * @param col - Optional column definition for subquery handling
 * @returns Formatted string representation
 */
export function formatCellValue(value: unknown, col?: FormatColumn): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Handle subquery results
  if (col?.isSubquery && typeof value === 'object') {
    const subquery = value as { records?: unknown[]; totalSize?: number };
    if (subquery.records) {
      return `[${subquery.totalSize || subquery.records.length} records]`;
    }
    if (Array.isArray(value)) {
      return `[${value.length} records]`;
    }
  }

  // Handle objects - extract Name or Id if available
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.Name !== undefined) return String(obj.Name);
    if (obj.Id !== undefined) return String(obj.Id);
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Escape a value for CSV format.
 * Wraps in quotes and escapes internal quotes if needed.
 *
 * @param value - The value to escape
 * @returns CSV-safe string
 */
export function escapeCsvField(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate a filename for CSV export.
 *
 * @param objectName - The object type name (e.g., "Account")
 * @returns Filename with timestamp (e.g., "Account_20240115T143022.csv")
 */
export function getExportFilename(objectName: string | null): string {
  const name = objectName || 'query';
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  return `${name}_${timestamp}.csv`;
}

/**
 * Trigger a CSV file download in the browser.
 *
 * @param content - CSV content as string
 * @param filename - Filename for the download
 */
export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Convert records to CSV content.
 *
 * @param records - Array of records to export
 * @param columns - Column definitions with paths and titles
 * @returns CSV content as string
 */
export function recordsToCsv(
  records: SObject[],
  columns: Array<{ path: string; title: string; isSubquery?: boolean }>
): string {
  // Header row
  const header = columns.map((col) => escapeCsvField(col.title)).join(',');

  // Data rows
  const rows = records.map((record) => {
    return columns
      .map((col) => {
        const value = getValueByPath(record, col.path);
        const formatted = formatCellValue(value, col);
        return escapeCsvField(formatted);
      })
      .join(',');
  });

  return [header, ...rows].join('\n');
}
