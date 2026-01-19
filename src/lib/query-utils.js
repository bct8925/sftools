// Query Tab Utility Functions
// Pure functions for data transformation and CSV export

/**
 * Normalizes a SOQL query for comparison purposes
 * Converts to lowercase and collapses whitespace
 */
export function normalizeQuery(query) {
    return query.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Flattens column metadata from Salesforce REST Query API
 * Handles nested joinColumns for relationship fields and subqueries
 */
export function flattenColumnMetadata(columnMetadata, prefix = '') {
    const columns = [];

    for (const col of columnMetadata) {
        const columnName = col.columnName;
        const path = prefix ? `${prefix}.${columnName}` : columnName;

        // Check if this is a subquery (has aggregate=true and joinColumns)
        // Subqueries in Salesforce are marked as aggregate even though they're not actual aggregates
        const isSubquery = col.aggregate && col.joinColumns && col.joinColumns.length > 0;

        if (isSubquery) {
            // For subqueries, add a single column representing the entire subquery
            const title = prefix ? path : col.displayName;
            columns.push({
                title: title,
                path: path,
                aggregate: false,
                isSubquery: true,
                subqueryColumns: col.joinColumns // Store subquery columns for later rendering
            });
        } else if (col.joinColumns && col.joinColumns.length > 0) {
            // Regular parent relationship - flatten it
            columns.push(...flattenColumnMetadata(col.joinColumns, path));
        } else {
            // Regular scalar column
            const title = prefix ? path : col.displayName;
            columns.push({
                title: title,
                path: path,
                aggregate: col.aggregate || false,
                isSubquery: false
            });
        }
    }

    return columns;
}

/**
 * Extracts column definitions from a record's keys
 * Used as fallback when no column metadata is available
 */
export function extractColumnsFromRecord(record) {
    return Object.keys(record)
        .filter(key => key !== 'attributes')
        .map(key => ({
            title: key,
            path: key,
            aggregate: false,
            isSubquery: false
        }));
}

/**
 * Gets a nested value from a record using dot notation path
 */
export function getValueByPath(record, path) {
    if (!path) return undefined;

    const parts = path.split('.');
    let value = record;

    for (const part of parts) {
        if (value === null || value === undefined) return undefined;
        value = value[part];
    }

    return value;
}

/**
 * Converts records to CSV format
 */
export function recordsToCsv(records, columns) {
    const rows = [];

    const headers = columns.map(col => escapeCsvField(col.title));
    rows.push(headers.join(','));

    for (const record of records) {
        const row = columns.map(col => {
            const value = getValueByPath(record, col.path);
            return escapeCsvField(formatCellValue(value, col));
        });
        rows.push(row.join(','));
    }

    return rows.join('\n');
}

/**
 * Escapes a field value for CSV output
 */
export function escapeCsvField(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

/**
 * Formats a cell value for display
 */
export function formatCellValue(value, col) {
    if (value === null || value === undefined) {
        return '';
    }

    if (col?.isSubquery && typeof value === 'object') {
        if (value.records) {
            return `[${value.totalSize || value.records.length} records]`;
        }
        if (Array.isArray(value)) {
            return `[${value.length} records]`;
        }
    }

    if (typeof value === 'object') {
        if (value.Name !== undefined) return value.Name;
        if (value.Id !== undefined) return value.Id;
        return JSON.stringify(value);
    }

    return String(value);
}

/**
 * Parses a string value from an input based on field type
 */
export function parseValueFromInput(stringValue, field) {
    if (stringValue === '' || stringValue === null) return null;

    switch (field.type) {
        case 'boolean':
            return stringValue === 'true' || stringValue === true;
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
 * Checks if a field is editable based on its metadata
 */
export function isFieldEditable(fieldPath, fieldDescribe) {
    // Only direct fields (not relationships) are editable
    if (fieldPath.includes('.')) return false;

    const field = fieldDescribe?.[fieldPath];
    if (!field) return false;

    return field.updateable && !field.calculated;
}

/**
 * Checks if a result set is editable
 * Must have Id column, no aggregate functions, and a single object name
 */
export function checkIfEditable(columns, objectName) {
    // Must have Id column
    const hasIdColumn = columns.some(col => col.path === 'Id');
    if (!hasIdColumn) return false;

    // Must not have aggregate functions
    const hasAggregate = columns.some(col => col.aggregate);
    if (hasAggregate) return false;

    // Must have a single object name
    if (!objectName) return false;

    return true;
}
