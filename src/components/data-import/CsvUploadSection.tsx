// CSV file upload section with drag-and-drop
import { useRef, useCallback, useState } from 'react';
import { parseCsvForPreview } from '../../lib/csv-parse';
import type { ImportCsvMeta } from './useImportState';
import styles from './DataImportTab.module.css';

// Bulk API v2 limit per job: 100 MB (after base64)
const BULK_API_LIMIT_BYTES = 100 * 1024 * 1024;

interface CsvUploadSectionProps {
    csv: ImportCsvMeta | null;
    disabled: boolean;
    onCsvLoaded: (meta: ImportCsvMeta, rawText: string) => void;
    onCsvCleared: () => void;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CsvUploadSection({
    csv,
    disabled,
    onCsvLoaded,
    onCsvCleared,
}: CsvUploadSectionProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);
    const [sizeWarning, setSizeWarning] = useState<string | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);

    const processFile = useCallback(
        (file: File) => {
            setSizeWarning(null);
            setParseError(null);

            // Warn (don't block) if file exceeds 100MB
            if (file.size > BULK_API_LIMIT_BYTES) {
                const sizeMb = (file.size / (1024 * 1024)).toFixed(0);
                setSizeWarning(
                    `File is ${sizeMb}MB. Salesforce Bulk API v2 supports up to 150MB (100MB after base64 conversion) per job. Reduce your job size so each chunk stays under the limit.`
                );
            }

            const reader = new FileReader();
            reader.onload = e => {
                const text = e.target?.result as string;
                const { headers, rowCount, errors } = parseCsvForPreview(text, 0);

                if (errors.length > 0 && headers.length === 0) {
                    setParseError('Could not parse CSV: ' + errors[0].message);
                    return;
                }

                const meta: ImportCsvMeta = {
                    filename: file.name,
                    headers,
                    rowCount,
                    fileSize: file.size,
                };
                onCsvLoaded(meta, text);
            };
            reader.readAsText(file);
        },
        [onCsvLoaded]
    );

    const handleFileInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) processFile(file);
            // Reset input so the same file can be re-selected
            e.target.value = '';
        },
        [processFile]
    );

    const handleBrowseClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOver(false);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) processFile(file);
        },
        [processFile]
    );

    return (
        <div className="card" data-testid="data-import-csv-section">
            <div className="card-header">
                <h3>2. CSV File</h3>
            </div>
            <div className="card-body">
                {csv ? (
                    <div className={styles.csvSummary}>
                        <div className={styles.csvSummaryInfo}>
                            <span className={styles.csvFilename}>{csv.filename}</span>
                            <span className={styles.csvMeta}>
                                {csv.rowCount.toLocaleString()} rows &middot; {csv.headers.length}{' '}
                                columns &middot; {formatBytes(csv.fileSize)}
                            </span>
                        </div>
                        {!disabled && (
                            <button className="button-neutral" onClick={onCsvCleared} type="button">
                                Remove
                            </button>
                        )}
                    </div>
                ) : (
                    <div
                        className={`${styles.dropZone} ${dragOver ? styles.dropZoneActive : ''} ${disabled ? styles.dropZoneDisabled : ''}`}
                        onDragOver={!disabled ? handleDragOver : undefined}
                        onDragLeave={!disabled ? handleDragLeave : undefined}
                        onDrop={!disabled ? handleDrop : undefined}
                    >
                        <p className={styles.dropZoneText}>Drag &amp; drop a CSV file here, or</p>
                        <button
                            className="button-neutral"
                            onClick={handleBrowseClick}
                            disabled={disabled}
                            type="button"
                            data-testid="data-import-browse-btn"
                        >
                            Browse Files
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            className={styles.hiddenInput}
                            onChange={handleFileInput}
                        />
                    </div>
                )}

                {sizeWarning && <div className={styles.warningBanner}>⚠ {sizeWarning}</div>}
                {parseError && <div className={styles.errorBanner}>{parseError}</div>}
            </div>
        </div>
    );
}
