import type { ReactNode } from 'react';
import styles from './JobsTable.module.css';

export interface JobsTableColumn<T> {
    key: string;
    label: string;
    render: (row: T) => ReactNode;
    sortable?: boolean;
    width?: string;
}

interface JobsTableProps<T> {
    columns: JobsTableColumn<T>[];
    data: T[];
    keyExtractor: (row: T) => string;
    isLoading: boolean;
    emptyMessage?: string;
    sortColumn?: string;
    sortDirection?: 'asc' | 'desc';
    onSort?: (columnKey: string) => void;
}

export function JobsTable<T>({
    columns,
    data,
    keyExtractor,
    isLoading,
    emptyMessage = 'No results',
    sortColumn,
    sortDirection,
    onSort,
}: JobsTableProps<T>) {
    if (!isLoading && data.length === 0) {
        return (
            <div className={styles.emptyState}>
                <p>{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className={styles.tableWrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        {columns.map(col => (
                            <th
                                key={col.key}
                                style={col.width ? { width: col.width } : undefined}
                                className={col.sortable ? styles.sortable : undefined}
                                onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                            >
                                {col.label}
                                {col.sortable && sortColumn === col.key && (
                                    <span className={styles.sortIndicator}>
                                        {sortDirection === 'asc' ? ' \u25B2' : ' \u25BC'}
                                    </span>
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map(row => (
                        <tr key={keyExtractor(row)}>
                            {columns.map(col => (
                                <td key={col.key}>{col.render(row)}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
