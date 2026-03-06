// Query History - thin wrapper around ScriptHistory
import { forwardRef } from 'react';
import { ScriptHistory, type ScriptHistoryRef } from '../script-list/ScriptHistory';
import type { HistoryEntry } from '../../lib/history-manager';
import styles from './QueryTab.module.css';

export type { ScriptHistoryRef };

interface QueryHistoryProps {
    onSelectQuery: (query: string) => void;
}

// Extended history entry with query property
interface QueryHistoryEntry extends HistoryEntry {
    query: string;
    objectName?: string;
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
                return qItem.objectName ? (
                    <span className={styles.objectBadge}>{qItem.objectName}</span>
                ) : null;
            }}
            getFavoriteMetadata={(_, item) => {
                const qItem = item as QueryHistoryEntry;
                return qItem.objectName ? { objectName: qItem.objectName } : undefined;
            }}
            onLoad={onSelectQuery}
        />
    )
);

QueryHistory.displayName = 'QueryHistory';
