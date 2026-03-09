// Import settings — API version, batch size (v1 only), concurrency mode (v1 only)
import { useCallback } from 'react';
import type { BulkApiVersion, BulkConcurrencyMode } from '../../types/salesforce';
import styles from './DataImportTab.module.css';

interface ImportSettingsSectionProps {
    apiVersion: BulkApiVersion;
    batchSize: number;
    concurrencyMode: BulkConcurrencyMode;
    disabled: boolean;
    onApiVersionChange: (v: BulkApiVersion) => void;
    onBatchSizeChange: (n: number) => void;
    onConcurrencyModeChange: (m: BulkConcurrencyMode) => void;
}

const V1_MIN_BATCH_SIZE = 200;
const V1_MAX_BATCH_SIZE = 10_000;

export function ImportSettingsSection({
    apiVersion,
    batchSize,
    concurrencyMode,
    disabled,
    onApiVersionChange,
    onBatchSizeChange,
    onConcurrencyModeChange,
}: ImportSettingsSectionProps) {
    const handleApiVersionChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            onApiVersionChange(e.target.value as BulkApiVersion);
        },
        [onApiVersionChange]
    );

    const handleBatchSizeChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = parseInt(e.target.value, 10);
            if (!isNaN(value)) onBatchSizeChange(value);
        },
        [onBatchSizeChange]
    );

    const handleConcurrencyModeChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            onConcurrencyModeChange(e.target.value as BulkConcurrencyMode);
        },
        [onConcurrencyModeChange]
    );

    return (
        <div className="card">
            <div className="card-header">
                <h3>4. Settings</h3>
            </div>
            <div className="card-body">
                <div className={styles.formRow}>
                    <label className={styles.formLabel} htmlFor="api-version">
                        API Version
                    </label>
                    <select
                        id="api-version"
                        className="select"
                        value={apiVersion}
                        onChange={handleApiVersionChange}
                        disabled={disabled}
                    >
                        <option value="v2">Bulk API v2 (Recommended)</option>
                        <option value="v1">Bulk API v1</option>
                    </select>
                </div>

                {apiVersion === 'v1' && (
                    <>
                        <div className={styles.formRow}>
                            <label className={styles.formLabel} htmlFor="batch-size">
                                Batch Size
                            </label>
                            <input
                                id="batch-size"
                                type="number"
                                className="input"
                                value={batchSize}
                                onChange={handleBatchSizeChange}
                                min={V1_MIN_BATCH_SIZE}
                                max={V1_MAX_BATCH_SIZE}
                                disabled={disabled}
                            />
                        </div>
                        <div className={styles.formRow}>
                            <label className={styles.formLabel} htmlFor="concurrency-mode">
                                Concurrency Mode
                            </label>
                            <select
                                id="concurrency-mode"
                                className="select"
                                value={concurrencyMode}
                                onChange={handleConcurrencyModeChange}
                                disabled={disabled}
                            >
                                <option value="Parallel">Parallel (Default)</option>
                                <option value="Serial">Serial</option>
                            </select>
                        </div>
                        <p className={styles.settingsNote}>
                            Rows per batch (max 10,000). Use Serial to avoid row lock errors on
                            related records.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
