// Record Viewer Utility Functions
// Pure functions for field manipulation, formatting, and parsing

import type { FieldDescribe, SObject } from '../types/salesforce';
import { parseFieldValue } from './value-utils';

// Re-export for backwards compatibility
export { parseFieldValue as parseValue };

/**
 * Sorts fields with Id first, Name second, then alphabetically.
 */
export function sortFields(fields: FieldDescribe[]): FieldDescribe[] {
    return [...fields].sort((a, b) => {
        if (a.name === 'Id') return -1;
        if (b.name === 'Id') return 1;
        if (a.nameField) return -1;
        if (b.nameField) return 1;
        return a.name.localeCompare(b.name);
    });
}

/**
 * Filters out fields that should not be displayed (address, location types, and 'attributes').
 */
export function filterFields(fields: FieldDescribe[]): FieldDescribe[] {
    const excludeTypes = ['address', 'location'];
    const excludeNames = ['attributes'];
    return fields.filter(f => !excludeNames.includes(f.name) && !excludeTypes.includes(f.type));
}

/**
 * Formats a field value for display in an input field.
 */
export function formatValue(value: unknown, field: FieldDescribe): string {
    if (value === null || value === undefined) return '';

    switch (field.type) {
        case 'boolean':
            return value ? 'true' : 'false';
        case 'datetime':
        case 'date':
            return String(value);
        case 'double':
        case 'currency':
        case 'percent':
        case 'int':
            return String(value);
        default:
            return String(value);
    }
}

/**
 * Formats a field value for preview display (HTML output).
 * Returns special HTML for booleans (checkbox), dates (formatted), and references (links).
 * Returns a preview button indicator for rich text fields.
 */
export function formatPreviewHtml(
    value: unknown,
    field: FieldDescribe,
    record: SObject,
    nameFieldMap: Record<string, string> = {},
    connectionId: string | null = null
): string {
    if (value === null || value === undefined) return '';

    // Check if this is a rich text/textarea field that should have a preview button
    const richTextTypes = ['textarea', 'html', 'encryptedstring'];
    if (richTextTypes.includes(field.type) && value && String(value).trim()) {
        return '__PREVIEW_BUTTON__'; // Placeholder to indicate button needed
    }

    switch (field.type) {
        case 'boolean':
            return `__CHECKBOX_${value ? 'CHECKED' : 'UNCHECKED'}__`; // Placeholder for checkbox
        case 'datetime':
            return new Date(String(value)).toLocaleString();
        case 'date':
            return new Date(`${value}T00:00:00`).toLocaleDateString();
        case 'reference':
            if (field.relationshipName && field.referenceTo?.length > 0) {
                const related = record[field.relationshipName] as SObject | undefined;
                const relatedType = field.referenceTo[0];
                const nameField = nameFieldMap[relatedType];
                const relatedName = nameField ? related?.[nameField] : null;
                if (relatedName && connectionId) {
                    const displayType = field.name === 'OwnerId' ? 'User/Group' : relatedType;
                    return `__LINK__${relatedName}__${displayType}__${relatedType}__${value}__${connectionId}__`; // Placeholder for link
                }
            }
            return String(value ?? '');
        default:
            return String(value ?? '');
    }
}

/**
 * Returns only the fields that have been modified.
 */
export function getChangedFields(
    originalValues: Record<string, unknown>,
    currentValues: Record<string, unknown>,
    fieldDescribe: Record<string, FieldDescribe>
): Record<string, unknown> {
    const changes: Record<string, unknown> = {};

    for (const [fieldName, field] of Object.entries(fieldDescribe)) {
        if (!field.updateable || field.calculated) continue;

        const original = originalValues[fieldName];
        const current = currentValues[fieldName];

        const originalStr = original === null || original === undefined ? '' : String(original);
        const currentStr = current === null || current === undefined ? '' : String(current);

        if (originalStr !== currentStr) {
            changes[fieldName] = current;
        }
    }

    return changes;
}
