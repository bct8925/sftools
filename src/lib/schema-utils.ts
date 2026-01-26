// Schema Browser Utilities
// Pure functions for filtering and formatting object/field data

import type { SObjectDescribe, FieldDescribe } from '../types/salesforce';

/**
 * Filter objects by API name or label
 */
export function filterObjects(objects: SObjectDescribe[], searchTerm: string): SObjectDescribe[] {
    const term = searchTerm.toLowerCase().trim();

    if (!term) {
        return [...objects];
    }

    return objects.filter(
        obj => obj.name.toLowerCase().includes(term) || obj.label.toLowerCase().includes(term)
    );
}

/**
 * Filter fields by API name or label
 */
export function filterFields(fields: FieldDescribe[], searchTerm: string): FieldDescribe[] {
    const term = searchTerm.toLowerCase().trim();

    if (!term) {
        return [...fields];
    }

    return fields.filter(
        field => field.name.toLowerCase().includes(term) || field.label.toLowerCase().includes(term)
    );
}

export interface FieldTypeDisplay {
    text: string;
    isReference: boolean;
    referenceTo?: string[];
}

/**
 * Get display string for field type
 */
export function getFieldTypeDisplay(field: FieldDescribe): FieldTypeDisplay {
    if (field.calculated) {
        if ((field as { calculatedFormula?: string }).calculatedFormula) {
            return { text: `${field.type} (formula)`, isReference: false };
        }
        return { text: `${field.type} (rollup)`, isReference: false };
    }

    if (field.type === 'reference' && field.referenceTo?.length > 0) {
        const isOwnerId = field.name === 'OwnerId';

        if (field.referenceTo.length === 1) {
            return {
                text: `reference (${field.referenceTo[0]})`,
                isReference: !isOwnerId,
                referenceTo: field.referenceTo,
            };
        }
        return {
            text: `reference (${field.referenceTo.join(', ')})`,
            isReference: !isOwnerId,
            referenceTo: field.referenceTo,
        };
    }

    return { text: field.type, isReference: false };
}
