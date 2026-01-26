// Column Utilities - Functions for working with query column metadata

import type { ColumnMetadata } from '../types/salesforce';

/**
 * Represents a flattened query column
 */
export interface QueryColumn {
    title: string;
    path: string;
    aggregate: boolean;
    isSubquery: boolean;
    subqueryColumns?: ColumnMetadata[];
}

/**
 * Flatten hierarchical column metadata into a flat list of columns.
 * Handles relationship columns (e.g., Account.Name) and subqueries.
 *
 * @param columnMetadata - The column metadata from query response
 * @param prefix - Prefix for relationship paths (internal use)
 * @returns Flattened array of QueryColumn objects
 */
export function flattenColumnMetadata(
    columnMetadata: ColumnMetadata[],
    prefix = ''
): QueryColumn[] {
    const columns: QueryColumn[] = [];

    for (const col of columnMetadata) {
        const { columnName } = col;
        const path = prefix ? `${prefix}.${columnName}` : columnName;

        const isSubquery = col.aggregate && col.joinColumns && col.joinColumns.length > 0;

        if (isSubquery) {
            const title = prefix ? path : col.displayName;
            columns.push({
                title,
                path,
                aggregate: false,
                isSubquery: true,
                subqueryColumns: col.joinColumns,
            });
        } else if (col.joinColumns && col.joinColumns.length > 0) {
            // Regular parent relationship - flatten it
            columns.push(...flattenColumnMetadata(col.joinColumns, path));
        } else {
            // Regular scalar column
            const title = prefix ? path : col.displayName;
            columns.push({
                title,
                path,
                aggregate: col.aggregate || false,
                isSubquery: false,
            });
        }
    }

    return columns;
}
