import { useState, useCallback, useRef } from 'react';
import { exportData, importData } from '../../lib/extension-migration';
import styles from './DataManagement.module.css';

export function DataManagement() {
    const [status, setStatus] = useState('');
    const [statusType, setStatusType] = useState<'success' | 'error' | ''>('');
    const [isWorking, setIsWorking] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const showStatus = useCallback((message: string, type: 'success' | 'error') => {
        setStatus(message);
        setStatusType(type);
        if (type === 'success') {
            setTimeout(() => {
                setStatus('');
                setStatusType('');
            }, 3000);
        }
    }, []);

    const handleExport = useCallback(async () => {
        setIsWorking(true);
        setStatus('');
        try {
            await exportData();
            showStatus('Data exported successfully', 'success');
        } catch (err) {
            showStatus(`Export failed: ${(err as Error).message}`, 'error');
        } finally {
            setIsWorking(false);
        }
    }, [showStatus]);

    const handleImportClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            // Reset the input so the same file can be selected again
            e.target.value = '';

            setIsWorking(true);
            setStatus('');
            try {
                const keyCount = await importData(file);
                showStatus(`Imported ${keyCount} keys. Reloading...`, 'success');
                // Reload after a brief delay so the user sees the success message
                setTimeout(() => window.location.reload(), 1000);
            } catch (err) {
                showStatus(`Import failed: ${(err as Error).message}`, 'error');
            } finally {
                setIsWorking(false);
            }
        },
        [showStatus]
    );

    return (
        <div>
            <p className={styles.description}>
                Export your data (connections, history, favorites, settings) to a file, or import
                from a previous export. Use this to migrate data between extension versions.
            </p>

            <div className={styles.buttonRow}>
                <button className="button-neutral" onClick={handleExport} disabled={isWorking}>
                    Export Data
                </button>
                <button className="button-neutral" onClick={handleImportClick} disabled={isWorking}>
                    Import Data
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className={styles.hiddenInput}
                />
                {status && (
                    <span className={`${styles.status} ${statusType ? styles[statusType] : ''}`}>
                        {status}
                    </span>
                )}
            </div>
        </div>
    );
}
