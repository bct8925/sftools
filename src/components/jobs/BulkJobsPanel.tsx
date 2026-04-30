import { useState, useCallback, useEffect, useMemo } from 'react';
import { useConnection } from '../../contexts/ConnectionContext';
import { useToast } from '../../contexts/ToastContext';
import { fetchBulkJobs, resolveUserNames, type BulkJobWithType } from '../../api/jobs';
import { ButtonIcon } from '../button-icon/ButtonIcon';
import { JobsTable, type JobsTableColumn } from './JobsTable';
import type { JobsPreferences } from './useJobsPreferences';
import styles from './JobsTab.module.css';

const BULK_STATUS_OPTIONS = [
    'Open',
    'UploadComplete',
    'InProgress',
    'JobComplete',
    'Failed',
    'Aborted',
];

const BULK_OPERATION_OPTIONS = ['insert', 'update', 'upsert', 'delete', 'query', 'queryAll'];

const formatDateTime = (iso: string): string => {
    return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
};

interface BulkJobsPanelProps {
    preferences: JobsPreferences;
    onFilterChange: (key: keyof JobsPreferences['bulkJobs'], value: string) => void;
}

export function BulkJobsPanel({ preferences, onFilterChange }: BulkJobsPanelProps) {
    const { activeConnection, isAuthenticated } = useConnection();
    const toast = useToast();

    const [jobs, setJobs] = useState<BulkJobWithType[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [sortColumn, setSortColumn] = useState('createdDate');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const { filterStatus, filterOperation, filterObject } = preferences.bulkJobs;

    // Reset on connection change
    useEffect(() => {
        setJobs([]);
    }, [activeConnection?.id]);

    const handleRefresh = useCallback(async () => {
        if (!isAuthenticated) return;

        setIsLoading(true);
        const id = toast.show('Fetching Bulk jobs...', 'loading');

        try {
            const result = await fetchBulkJobs();

            // Resolve user names
            const userIds = result.map(j => j.createdById);
            const nameMap = await resolveUserNames(userIds);
            for (const job of result) {
                job.createdByName = nameMap.get(job.createdById);
            }

            setJobs(result);
            toast.dismiss(id);
        } catch (error) {
            toast.update(id, (error as Error).message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, toast]);

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

    // Client-side filtering
    const filteredJobs = useMemo(() => {
        return jobs.filter(job => {
            if (filterStatus && job.state !== filterStatus) return false;
            if (filterOperation && job.operation.toLowerCase() !== filterOperation) return false;
            if (filterObject && !job.object.toLowerCase().includes(filterObject.toLowerCase())) {
                return false;
            }
            return true;
        });
    }, [jobs, filterStatus, filterOperation, filterObject]);

    const sortedJobs = useMemo(() => {
        const sorted = [...filteredJobs];
        sorted.sort((a, b) => {
            const aVal = a[sortColumn as keyof BulkJobWithType] ?? '';
            const bVal = b[sortColumn as keyof BulkJobWithType] ?? '';
            const cmp = String(aVal).localeCompare(String(bVal));
            return sortDirection === 'asc' ? cmp : -cmp;
        });
        return sorted;
    }, [filteredJobs, sortColumn, sortDirection]);

    const columns: JobsTableColumn<BulkJobWithType>[] = useMemo(
        () => [
            {
                key: 'object',
                label: 'Object',
                sortable: true,
                render: row => row.object,
            },
            {
                key: 'operation',
                label: 'Operation',
                sortable: true,
                render: row => row.operation,
            },
            {
                key: 'sourceType',
                label: 'Job Type',
                sortable: true,
                render: row => row.sourceType,
            },
            {
                key: 'state',
                label: 'Status',
                sortable: true,
                render: row => <span className={bulkStatusClass(row.state)}>{row.state}</span>,
            },
            {
                key: 'createdDate',
                label: 'Start Time',
                sortable: true,
                width: '150px',
                render: row => (
                    <span className={styles.mono}>{formatDateTime(row.createdDate)}</span>
                ),
            },
            {
                key: 'createdByName',
                label: 'Submitted By',
                render: row => row.createdByName ?? row.createdById,
            },
        ],
        []
    );

    return (
        <div className={styles.panel}>
            <div className={styles.filterRow}>
                <select
                    className="select"
                    value={filterStatus}
                    onChange={e => onFilterChange('filterStatus', e.target.value)}
                >
                    <option value="">All Statuses</option>
                    {BULK_STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>
                            {s}
                        </option>
                    ))}
                </select>
                <select
                    className="select"
                    value={filterOperation}
                    onChange={e => onFilterChange('filterOperation', e.target.value)}
                >
                    <option value="">All Operations</option>
                    {BULK_OPERATION_OPTIONS.map(op => (
                        <option key={op} value={op}>
                            {op}
                        </option>
                    ))}
                </select>
                <input
                    type="text"
                    className="input"
                    placeholder="Object..."
                    value={filterObject}
                    onChange={e => onFilterChange('filterObject', e.target.value)}
                />
                <ButtonIcon
                    icon="refresh"
                    title="Refresh Bulk jobs"
                    onClick={handleRefresh}
                    disabled={isLoading || !isAuthenticated}
                />
            </div>
            <JobsTable
                columns={columns}
                data={sortedJobs}
                keyExtractor={row => row.id}
                isLoading={isLoading}
                emptyMessage="No Bulk jobs found. Click refresh to fetch."
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSort}
            />
        </div>
    );
}

function bulkStatusClass(state: string): string {
    switch (state) {
        case 'JobComplete':
            return styles.statusSuccess;
        case 'Failed':
        case 'Aborted':
            return styles.statusError;
        case 'InProgress':
        case 'UploadComplete':
        case 'Open':
            return styles.statusActive;
        default:
            return '';
    }
}
