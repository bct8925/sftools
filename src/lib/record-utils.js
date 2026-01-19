// Record Viewer Utility Functions
// Pure functions for field manipulation, formatting, and parsing

/**
 * Sorts fields with Id first, Name second, then alphabetically.
 * @param {Array} fields - Field metadata array
 * @returns {Array} Sorted field array
 */
export function sortFields(fields) {
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
 * @param {Array} fields - Field metadata array
 * @returns {Array} Filtered field array
 */
export function filterFields(fields) {
    const excludeTypes = ['address', 'location'];
    const excludeNames = ['attributes'];
    return fields.filter(f =>
        !excludeNames.includes(f.name) &&
        !excludeTypes.includes(f.type)
    );
}

/**
 * Formats a field value for display in an input field.
 * @param {*} value - The raw field value
 * @param {Object} field - Field metadata
 * @returns {string} Formatted value string
 */
export function formatValue(value, field) {
    if (value === null || value === undefined) return '';

    switch (field.type) {
        case 'boolean':
            return value ? 'true' : 'false';
        case 'datetime':
        case 'date':
            return value;
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
 * @param {*} value - The raw field value
 * @param {Object} field - Field metadata
 * @param {Object} record - Full record data (for relationship lookups)
 * @param {Object} nameFieldMap - Map of object types to their name fields
 * @param {string} connectionId - Connection ID for building record links
 * @returns {string} HTML string for preview column
 */
export function formatPreviewHtml(value, field, record, nameFieldMap = {}, connectionId = null) {
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
            return new Date(value).toLocaleString();
        case 'date':
            return new Date(value + 'T00:00:00').toLocaleDateString();
        case 'reference':
            if (field.relationshipName && field.referenceTo?.length > 0) {
                const related = record[field.relationshipName];
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
 * Parses a string input value to the appropriate type based on field metadata.
 * @param {string} stringValue - The string value from input
 * @param {Object} field - Field metadata
 * @returns {*} Parsed value (boolean, number, or string)
 */
export function parseValue(stringValue, field) {
    if (stringValue === '' || stringValue === null) return null;

    switch (field.type) {
        case 'boolean':
            return stringValue.toLowerCase() === 'true';
        case 'int':
            const intVal = parseInt(stringValue, 10);
            return isNaN(intVal) ? null : intVal;
        case 'double':
        case 'currency':
        case 'percent':
            const floatVal = parseFloat(stringValue);
            return isNaN(floatVal) ? null : floatVal;
        default:
            return stringValue;
    }
}

/**
 * Returns only the fields that have been modified.
 * @param {Object} originalValues - Original record values
 * @param {Object} currentValues - Current record values
 * @param {Object} fieldDescribe - Field metadata map
 * @returns {Object} Map of changed field names to their new values
 */
export function getChangedFields(originalValues, currentValues, fieldDescribe) {
    const changes = {};

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
