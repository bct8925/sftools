// Import settings — batch size configuration
import { useCallback } from 'react';
import styles from './DataImportTab.module.css';

interface ImportSettingsSectionProps {
    batchSize: number;
    disabled: boolean;
    onChange: (batchSize: number) => void;
}

const MIN_BATCH_SIZE = 200;
const MAX_BATCH_SIZE = 100_000;

export function ImportSettingsSection({
    batchSize,
    disabled,
    onChange,
}: ImportSettingsSectionProps) {
    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = parseInt(e.target.value, 10);
            if (!isNaN(value)) onChange(value);
        },
        [onChange]
    );

    return (
        <div className="card">
            <div className="card-header">
                <h3>4. Settings</h3>
            </div>
            <div className="card-body">
                <div className={styles.formRow}>
                    <label className={styles.formLabel} htmlFor="batch-size">
                        Batch Size
                    </label>
                    <input
                        id="batch-size"
                        type="number"
                        className="input"
                        value={batchSize}
                        onChange={handleChange}
                        min={MIN_BATCH_SIZE}
                        max={MAX_BATCH_SIZE}
                        disabled={disabled}
                    />
                </div>
                <p className={styles.settingsNote}>
                    Records per Bulk API v2 job. Default: 10,000. Max: 100,000.
                </p>
            </div>
        </div>
    );
}
