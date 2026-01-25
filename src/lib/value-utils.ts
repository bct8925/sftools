// Value Utilities - Shared functions for value comparison, parsing, and type guards

import type { FieldDescribe } from '../types/salesforce';

/**
 * Compare two values for equality.
 * Handles null/undefined and type coercion for form field comparison.
 *
 * @param original - The original value
 * @param newValue - The new value to compare
 * @returns true if values are equal
 */
export function valuesEqual(original: unknown, newValue: unknown): boolean {
  if (original === null || original === undefined) {
    return newValue === null || newValue === undefined || newValue === '';
  }
  return String(original) === String(newValue ?? '');
}

/**
 * Check if a value is null or undefined.
 */
export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Check if a value is empty (null, undefined, or empty string).
 */
export function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

/**
 * Ensure a value is a string, with optional default.
 */
export function ensureString(value: unknown, defaultValue = ''): string {
  if (value === null || value === undefined) return defaultValue;
  return String(value);
}

/**
 * Parse a string input value to the appropriate type based on field metadata.
 * Used for inline editing in query results and record forms.
 *
 * @param stringValue - The string value from an input field
 * @param field - Field metadata with type information
 * @returns Parsed value of the appropriate type
 */
export function parseFieldValue(
  stringValue: string | null,
  field: FieldDescribe
): string | number | boolean | null {
  if (stringValue === '' || stringValue === null) return null;

  switch (field.type) {
    case 'boolean':
      return stringValue.toLowerCase() === 'true';
    case 'int': {
      const intVal = parseInt(stringValue, 10);
      return isNaN(intVal) ? null : intVal;
    }
    case 'double':
    case 'currency':
    case 'percent': {
      const floatVal = parseFloat(stringValue);
      return isNaN(floatVal) ? null : floatVal;
    }
    default:
      return stringValue;
  }
}

/**
 * Format a field value for display in an input field.
 *
 * @param value - The value to format
 * @param field - Field metadata with type information
 * @returns String representation for display
 */
export function formatFieldForInput(value: unknown, field: FieldDescribe): string {
  if (value === null || value === undefined) return '';

  switch (field.type) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'datetime':
    case 'date':
    case 'double':
    case 'currency':
    case 'percent':
    case 'int':
    default:
      return String(value);
  }
}
