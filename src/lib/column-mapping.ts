// Column mapping utilities for Bulk API v2 ingest

import type { FieldDescribe, BulkIngestOperation, ColumnMapping } from '../types/salesforce';

// ============================================================
// Field Eligibility
// ============================================================

/**
 * Filter fields that are eligible for the given operation.
 *
 * - insert: createable fields
 * - update: updateable fields + Id
 * - upsert: createable || updateable fields + externalIdField unconditionally
 * - delete: Id only
 */
export function getEligibleFields(
    fields: FieldDescribe[],
    operation: BulkIngestOperation,
    externalIdFieldName?: string
): FieldDescribe[] {
    switch (operation) {
        case 'insert':
            return fields.filter(f => f.createable);

        case 'update':
            return fields.filter(f => f.updateable || f.name === 'Id');

        case 'upsert':
            // Always include the externalIdField even if not createable/updateable
            return fields.filter(
                f =>
                    f.createable ||
                    f.updateable ||
                    (externalIdFieldName && f.name === externalIdFieldName)
            );

        case 'delete':
            return fields.filter(f => f.name === 'Id');
    }
}

// ============================================================
// Auto-Mapping
// ============================================================

/**
 * Auto-map CSV headers to Salesforce fields using index Maps for O(1) lookup.
 *
 * Priority:
 * 1. Case-insensitive API name match → mappingSource: 'api-name'
 * 2. Case-insensitive label match → mappingSource: 'label'
 * 3. No match → fieldApiName: null, included: false, mappingSource: 'none'
 */
export function autoMapColumns(
    csvHeaders: string[],
    eligibleFields: FieldDescribe[]
): ColumnMapping[] {
    const byApiName = new Map(eligibleFields.map(f => [f.name.toLowerCase(), f]));
    const byLabel = new Map(eligibleFields.map(f => [f.label.toLowerCase(), f]));

    return csvHeaders.map((header, csvIndex) => {
        const key = header.toLowerCase();

        const byName = byApiName.get(key);
        if (byName) {
            return {
                csvHeader: header,
                csvIndex,
                fieldApiName: byName.name,
                included: true,
                mappingSource: 'api-name',
            };
        }

        const byLbl = byLabel.get(key);
        if (byLbl) {
            return {
                csvHeader: header,
                csvIndex,
                fieldApiName: byLbl.name,
                included: true,
                mappingSource: 'label',
            };
        }

        return {
            csvHeader: header,
            csvIndex,
            fieldApiName: null,
            included: false,
            mappingSource: 'none',
        };
    });
}

// ============================================================
// Re-Mapping (CSV replacement)
// ============================================================

/**
 * Create mappings for new CSV headers, preserving previous mappings where
 * the header name matches (case-insensitive) and the assigned field is
 * still eligible. Unmatched headers fall back to auto-map logic.
 */
export function remapColumns(
    newHeaders: string[],
    eligibleFields: FieldDescribe[],
    previousMappings: ColumnMapping[]
): ColumnMapping[] {
    // Lookup previous mappings by lowercase header
    const previousByHeader = new Map(previousMappings.map(m => [m.csvHeader.toLowerCase(), m]));

    // Eligible field names for fast membership check
    const eligibleNames = new Set(eligibleFields.map(f => f.name));

    // Auto-map indexes for fallback
    const byApiName = new Map(eligibleFields.map(f => [f.name.toLowerCase(), f]));
    const byLabel = new Map(eligibleFields.map(f => [f.label.toLowerCase(), f]));

    return newHeaders.map((header, csvIndex) => {
        const key = header.toLowerCase();
        const prev = previousByHeader.get(key);

        // Preserve previous mapping if the field is still eligible
        if (prev?.fieldApiName && eligibleNames.has(prev.fieldApiName)) {
            return {
                csvHeader: header,
                csvIndex,
                fieldApiName: prev.fieldApiName,
                included: prev.included,
                mappingSource: prev.mappingSource,
            };
        }

        // Fallback: auto-map by API name → label → none
        const byName = byApiName.get(key);
        if (byName) {
            return {
                csvHeader: header,
                csvIndex,
                fieldApiName: byName.name,
                included: true,
                mappingSource: 'api-name',
            };
        }

        const byLbl = byLabel.get(key);
        if (byLbl) {
            return {
                csvHeader: header,
                csvIndex,
                fieldApiName: byLbl.name,
                included: true,
                mappingSource: 'label',
            };
        }

        return {
            csvHeader: header,
            csvIndex,
            fieldApiName: null,
            included: false,
            mappingSource: 'none',
        };
    });
}

// ============================================================
// Validation
// ============================================================

export interface MappingValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Validate that mappings are ready for execution.
 *
 * Checks:
 * - update/delete: Id must be mapped
 * - upsert: externalIdField must be mapped
 * - no duplicate field assignments among included mappings
 * - at least one data column for non-delete operations
 */
export function validateMappings(
    mappings: ColumnMapping[],
    operation: BulkIngestOperation,
    externalIdFieldName?: string
): MappingValidationResult {
    const errors: string[] = [];

    const included = mappings.filter(m => m.included && m.fieldApiName !== null);
    const assignedNames = included.map(m => m.fieldApiName!);

    // Check for required Id field
    if (operation === 'update' || operation === 'delete') {
        if (!assignedNames.includes('Id')) {
            errors.push('The Id field must be mapped for ' + operation + ' operations.');
        }
    }

    // Check for required external ID field in upsert
    if (operation === 'upsert') {
        if (!externalIdFieldName) {
            errors.push('An external ID field must be selected for upsert operations.');
        } else if (!assignedNames.includes(externalIdFieldName)) {
            errors.push(`The external ID field "${externalIdFieldName}" must be mapped.`);
        }
    }

    // Check for duplicate field assignments
    const seen = new Set<string>();
    for (const name of assignedNames) {
        if (seen.has(name)) {
            errors.push(`Field "${name}" is mapped to more than one CSV column.`);
        }
        seen.add(name);
    }

    // At least one data column for non-delete
    if (operation !== 'delete' && included.length === 0) {
        errors.push('At least one column must be mapped.');
    }

    return { valid: errors.length === 0, errors };
}
