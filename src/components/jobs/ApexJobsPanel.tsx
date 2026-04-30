import { useState, useCallback, useEffect, useMemo } from 'react';
import { useConnection } from '../../contexts/ConnectionContext';
import { useToast } from '../../contexts/ToastContext';
import { fetchApexJobs } from '../../api/jobs';
import type { AsyncApexJob } from '../../types/salesforce';
import { ButtonIcon } from '../button-icon/ButtonIcon';
import { JobsTable, type JobsTableColumn } from './JobsTable';
import type { JobsPreferences } from './useJobsPreferences';
import styles from './JobsTab.module.css';

const APEX_STATUS_OPTIONS = [
    '',
    'Holding',
    'Queued',
    'Preparing',
    'Processing',
    'Completed',
    'Failed',
    'Aborted',
];

const formatDateTime = (iso: string | null): string => {
    if (!iso) return '\u2014';
    return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
};

interface ApexJobsPanelProps {
    preferences: JobsPreferences;
    onFilterChange: (key: keyof JobsPreferences['apexJobs'], value: string) => void;
}

export function ApexJobsPanel({ preferences, onFilterChange }: ApexJobsPanelProps) {
    const { activeConnection, isAuthenticated } = useConnection();
    const toast = useToast();

    const [jobs, setJobs] = useState<AsyncApexJob[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [sortColumn, setSortColumn] = useState('CreatedDate');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const { filterApexClass, filterStatus } = preferences.apexJobs;

    // Reset on connection change
    useEffect(() => {
        setJobs([]);
    }, [activeConnection?.id]);

    const handleRefresh = useCallback(async () => {
        if (!isAuthenticated) return;

        setIsLoading(true);
        const id = toast.show('Fetching Apex jobs...', 'loading');

        try {
            const result = await fetchApexJobs({
                apexClass: filterApexClass,
                status: filterStatus,
            });
            setJobs(result);
            toast.dismiss(id);
        } catch (error) {
            toast.update(id, (error as Error).message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, filterApexClass, filterStatus, toast]);

    const handleSort = useCallback(
        (key: string) => {
            if (sortColumn === key) {
                setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
            } else {
                setSortColumn(key);
                setSortDirection('desc');
            }
        },
        [sortColumn]
    );

    const sortedJobs = useMemo(() => {
        const sorted = [...jobs];
        sorted.sort((a, b) => {
            const aVal = a[sortColumn as keyof AsyncApexJob] ?? '';
            const bVal = b[sortColumn as keyof AsyncApexJob] ?? '';
            const cmp = String(aVal).localeCompare(String(bVal));
            return sortDirection === 'asc' ? cmp : -cmp;
        });
        return sorted;
    }, [jobs, sortColumn, sortDirection]);

    const columns: JobsTableColumn<AsyncApexJob>[] = useMemo(
        () => [
            {
                key: 'CreatedDate',
                label: 'Submitted',
                sortable: true,
                width: '150px',
                render: row => (
                    <span className={styles.mono}>{formatDateTime(row.CreatedDate)}</span>
                ),
            },
            {
                key: 'JobType',
                label: 'Job Type',
                sortable: true,
                render: row => row.JobType,
            },
            {
                key: 'Status',
                label: 'Status',
                sortable: true,
                render: row => <span className={statusClass(row.Status)}>{row.Status}</span>,
            },
            {
                key: 'TotalJobItems',
                label: 'Total',
                render: row => row.TotalJobItems,
            },
            {
                key: 'JobItemsProcessed',
                label: 'Processed',
                render: row => row.JobItemsProcessed,
            },
            {
                key: 'NumberOfErrors',
                label: 'Failures',
                render: row => (
                    <span className={row.NumberOfErrors > 0 ? styles.errorText : undefined}>
                        {row.NumberOfErrors}
                    </span>
                ),
            },
            {
                key: 'CreatedBy',
                label: 'Submitted By',
                render: row => row.CreatedBy?.Name ?? '\u2014',
            },
            {
                key: 'CompletedDate',
                label: 'Completed',
                sortable: true,
                width: '150px',
                render: row => (
                    <span className={styles.mono}>{formatDateTime(row.CompletedDate)}</span>
                ),
            },
            {
                key: 'ApexClass',
                label: 'Apex Class',
                render: row => row.ApexClass?.Name ?? '\u2014',
            },
            {
                key: 'MethodName',
                label: 'Method',
                render: row => row.MethodName ?? '\u2014',
            },
        ],
        []
    );

    return (
        <div className={styles.panel}>
            <div className={styles.filterRow}>
                <input
                    type="text"
                    className="input"
                    placeholder="Apex Class..."
                    value={filterApexClass}
                    onChange={e => onFilterChange('filterApexClass', e.target.value)}
                />
                <select
                    className="select"
                    value={filterStatus}
                    onChange={e => onFilterChange('filterStatus', e.target.value)}
                >
                    <option value="">All Statuses</option>
                    {APEX_STATUS_OPTIONS.filter(Boolean).map(s => (
                        <option key={s} value={s}>
                            {s}
                        </option>
                    ))}
                </select>
                <ButtonIcon
                    icon="refresh"
                    title="Refresh Apex jobs"
                    onClick={handleRefresh}
                    disabled={isLoading || !isAuthenticated}
                />
            </div>
            <JobsTable
                columns={columns}
                data={sortedJobs}
                keyExtractor={row => row.Id}
                isLoading={isLoading}
                emptyMessage="No Apex jobs found. Click refresh to fetch."
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSort}
            />
        </div>
    );
}

function statusClass(status: string): string {
    switch (status) {
        case 'Completed':
            return styles.statusSuccess;
        case 'Failed':
        case 'Aborted':
            return styles.statusError;
        case 'Processing':
        case 'Preparing':
        case 'Queued':
            return styles.statusActive;
        default:
            return '';
    }
}
