// Query History - thin wrapper around ScriptHistory
import { forwardRef } from 'react';
import { ScriptHistory, type ScriptHistoryRef } from '../script-list/ScriptHistory';
import type { HistoryEntry } from '../../lib/history-manager';
import { formatCompactNumber } from '../../lib/text-utils';
import styles from './QueryTab.module.css';

export type { ScriptHistoryRef };

interface QueryHistoryProps {
    onSelectQuery: (query: string) => void;
}

// Extended history entry with query property
interface QueryHistoryEntry extends HistoryEntry {
    query: string;
    objectName?: string;
    totalSize?: number;
}

export const QueryHistory = forwardRef<ScriptHistoryRef, QueryHistoryProps>(
    ({ onSelectQuery }, ref) => (
        <ScriptHistory
            ref={ref}
            storageKeys={{ history: 'queryHistory', favorites: 'queryFavorites' }}
            contentProperty="query"
            getContent={item => (item as QueryHistoryEntry).query}
            getPreview={query => query.replace(/\s+/g, ' ').trim()}
            emptyHistoryMessage={
                <>
                    No queries yet.
                    <br />
                    Execute some SOQL to see history here.
                </>
            }
            emptyFavoritesMessage={
                <>
                    No favorites yet.
                    <br />
                    Click &#9733; on a query to save it.
                </>
            }
            favoritePlaceholder="Enter a label for this query"
            testIdPrefix="query"
            buttonClassName={styles.historyBtn}
            renderMeta={item => {
                const qItem = item as QueryHistoryEntry;
                return (
                    <>
                        {qItem.objectName && (
                            <span className={styles.objectBadge}>{qItem.objectName}</span>
                        )}
                        {qItem.totalSize != null && (
                            <span className={styles.resultCount}>
                                {formatCompactNumber(qItem.totalSize)}{' '}
                                {qItem.totalSize !== 1 ? 'results' : 'result'}
                            </span>
                        )}
                    </>
                );
            }}
            getFavoriteMetadata={(_, item) => {
                const qItem = item as QueryHistoryEntry;
                const metadata: { objectName?: string; totalSize?: number } = {};
                if (qItem.objectName) metadata.objectName = qItem.objectName;
                if (qItem.totalSize != null) metadata.totalSize = qItem.totalSize;
                return Object.keys(metadata).length > 0 ? metadata : undefined;
            }}
            onLoad={onSelectQuery}
        />
    )
);

QueryHistory.displayName = 'QueryHistory';
