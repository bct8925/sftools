// Execute section — import button, results, and downloads
import { useCallback } from 'react';
import { downloadCsv } from '../../lib/csv-utils';
import type { BulkIngestResults } from '../../types/salesforce';
import styles from './DataImportTab.module.css';

interface ExecuteSectionProps {
    rowCount: number;
    isReadyToExecute: boolean;
    jobPhase: 'idle' | 'running' | 'complete' | 'failed';
    jobResult: BulkIngestResults | null;
    error: string | null;
    objectName: string | null;
    onExecute: () => void;
    onCancel: () => void;
}

export function ExecuteSection({
    rowCount,
    isReadyToExecute,
    jobPhase,
    jobResult,
    error,
    objectName,
    onExecute,
    onCancel,
}: ExecuteSectionProps) {
    const handleExecute = useCallback(() => {
        const label = objectName ?? 'records';
        if (
            !confirm(`Import ${rowCount.toLocaleString()} ${label} records? This cannot be undone.`)
        ) {
            return;
        }
        onExecute();
    }, [onExecute, rowCount, objectName]);

    const handleDownloadSuccess = useCallback(() => {
        downloadCsv(jobResult!.successCsv, `${objectName ?? 'import'}_success.csv`);
    }, [jobResult, objectName]);

    const handleDownloadFailure = useCallback(() => {
        downloadCsv(jobResult!.failureCsv, `${objectName ?? 'import'}_failure.csv`);
    }, [jobResult, objectName]);

    const handleDownloadUnprocessed = useCallback(() => {
        downloadCsv(jobResult!.unprocessedCsv, `${objectName ?? 'import'}_unprocessed.csv`);
    }, [jobResult, objectName]);

    return (
        <div className="card">
            <div className="card-header">
                <h3>5. Execute</h3>
            </div>
            <div className="card-body">
                <div className={styles.executeActions}>
                    {jobPhase === 'running' ? (
                        <button className="button-neutral" onClick={onCancel} type="button">
                            Cancel Import
                        </button>
                    ) : (
                        <button
                            className="button-brand"
                            onClick={handleExecute}
                            disabled={!isReadyToExecute}
                            type="button"
                            data-testid="data-import-execute-btn"
                        >
                            Import
                        </button>
                    )}
                </div>

                {error && <div className={styles.errorBanner}>{error}</div>}

                {jobResult && (
                    <div className={styles.results}>
                        <div className={styles.resultSummary}>
                            {jobResult.successCount > 0 && (
                                <span className={styles.resultSuccess}>
                                    ✓ {jobResult.successCount.toLocaleString()} succeeded
                                </span>
                            )}
                            {jobResult.failureCount > 0 && (
                                <span className={styles.resultFailure}>
                                    ✗ {jobResult.failureCount.toLocaleString()} failed
                                </span>
                            )}
                            {jobResult.unprocessedCount > 0 && (
                                <span className={styles.resultUnprocessed}>
                                    ○ {jobResult.unprocessedCount.toLocaleString()} unprocessed
                                </span>
                            )}
                        </div>

                        <div className={styles.downloadButtons}>
                            {jobResult.successCount > 0 && jobResult.successCsv && (
                                <button
                                    className="button-neutral"
                                    onClick={handleDownloadSuccess}
                                    type="button"
                                >
                                    Download Success ({jobResult.successCount.toLocaleString()})
                                </button>
                            )}
                            {jobResult.failureCount > 0 && jobResult.failureCsv && (
                                <button
                                    className="button-neutral"
                                    onClick={handleDownloadFailure}
                                    type="button"
                                >
                                    Download Failures ({jobResult.failureCount.toLocaleString()})
                                </button>
                            )}
                            {jobResult.unprocessedCount > 0 && jobResult.unprocessedCsv && (
                                <button
                                    className="button-neutral"
                                    onClick={handleDownloadUnprocessed}
                                    type="button"
                                >
                                    Download Unprocessed (
                                    {jobResult.unprocessedCount.toLocaleString()})
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
