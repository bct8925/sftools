// Schema Browser Utilities
// Pure functions for filtering and formatting object/field data

/**
 * Filter objects by API name or label
 * @param {Array} objects - Array of Salesforce object metadata
 * @param {string} searchTerm - Search term to filter by
 * @returns {Array} Filtered objects
 */
export function filterObjects(objects, searchTerm) {
    const term = searchTerm.toLowerCase().trim();

    if (!term) {
        return [...objects];
    }

    return objects.filter(obj =>
        obj.name.toLowerCase().includes(term) ||
        obj.label.toLowerCase().includes(term)
    );
}

/**
 * Filter fields by API name or label
 * @param {Array} fields - Array of Salesforce field metadata
 * @param {string} searchTerm - Search term to filter by
 * @returns {Array} Filtered fields
 */
export function filterFields(fields, searchTerm) {
    const term = searchTerm.toLowerCase().trim();

    if (!term) {
        return [...fields];
    }

    return fields.filter(field =>
        field.name.toLowerCase().includes(term) ||
        field.label.toLowerCase().includes(term)
    );
}

/**
 * Get display string for field type
 * @param {Object} field - Salesforce field metadata
 * @returns {Object} { text: string, isReference: boolean, referenceTo?: Array }
 */
export function getFieldTypeDisplay(field) {
    if (field.calculated) {
        if (field.calculatedFormula) {
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
                referenceTo: field.referenceTo
            };
        } else {
            return {
                text: `reference (${field.referenceTo.join(', ')})`,
                isReference: !isOwnerId,
                referenceTo: field.referenceTo
            };
        }
    }

    return { text: field.type, isReference: false };
}
