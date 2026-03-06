// Shared Script List Components for History and Favorites
import { useCallback, type ReactNode } from 'react';
import { type HistoryEntry, type FavoriteEntry } from '../../lib/history-manager';
import styles from './ScriptList.module.css';

// Generic content accessor type
type ContentAccessor<T> = (item: T) => string;

interface HistoryListProps<T extends HistoryEntry> {
    items: T[];
    emptyMessage: ReactNode;
    getContent: ContentAccessor<T>;
    getPreview: (content: string) => string;
    formatTime: (timestamp: number) => string;
    onLoad: (content: string, item: T) => void;
    onAddToFavorites: (content: string, item: T) => void;
    onDelete: (id: string) => void;
    renderMeta?: (item: T) => ReactNode;
}

/**
 * Renders a list of history items with load, favorite, and delete actions.
 */
export function HistoryList<T extends HistoryEntry>({
    items,
    emptyMessage,
    getContent,
    getPreview,
    formatTime,
    onLoad,
    onAddToFavorites,
    onDelete,
    renderMeta,
}: HistoryListProps<T>) {
    const handleLoad = useCallback(
        (content: string, item: T) => {
            onLoad(content, item);
        },
        [onLoad]
    );

    const handleFavorite = useCallback(
        (content: string, item: T, e: React.MouseEvent) => {
            e.stopPropagation();
            onAddToFavorites(content, item);
        },
        [onAddToFavorites]
    );

    const handleDelete = useCallback(
        (id: string, e: React.MouseEvent) => {
            e.stopPropagation();
            onDelete(id);
        },
        [onDelete]
    );

    if (items.length === 0) {
        return <div className={styles.scriptEmpty}>{emptyMessage}</div>;
    }

    return (
        <div className={styles.scriptList}>
            {items.map(item => {
                const content = getContent(item);
                return (
                    <div
                        key={item.id}
                        className={styles.scriptItem}
                        onClick={() => handleLoad(content, item)}
                        data-testid="script-item"
                    >
                        <div className={styles.scriptMeta}>
                            <div className={styles.scriptMetaLeft}>
                                {renderMeta?.(item)}
                                <span>{formatTime(item.timestamp)}</span>
                            </div>
                            <div className={styles.scriptActions}>
                                <button
                                    className={styles.scriptAction}
                                    title="Add to favorites"
                                    onClick={e => handleFavorite(content, item, e)}
                                    data-testid="script-action-favorite"
                                >
                                    &#9733;
                                </button>
                                <button
                                    className={styles.scriptAction}
                                    title="Delete"
                                    onClick={e => handleDelete(item.id, e)}
                                    data-testid="script-action-delete"
                                >
                                    &times;
                                </button>
                            </div>
                        </div>
                        <div className={styles.scriptPreview} data-testid="script-preview">
                            {getPreview(content)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

interface FavoritesListProps<T extends FavoriteEntry> {
    items: T[];
    emptyMessage: ReactNode;
    getContent: ContentAccessor<T>;
    getPreview: (content: string) => string;
    formatTime: (timestamp: number) => string;
    onLoad: (content: string, item: T) => void;
    onDelete: (id: string) => void;
    renderMeta?: (item: T) => ReactNode;
}

/**
 * Renders a list of favorite items with load and delete actions.
 */
export function FavoritesList<T extends FavoriteEntry>({
    items,
    emptyMessage,
    getContent,
    getPreview,
    formatTime,
    onLoad,
    onDelete,
    renderMeta,
}: FavoritesListProps<T>) {
    const handleLoad = useCallback(
        (content: string, item: T) => {
            onLoad(content, item);
        },
        [onLoad]
    );

    const handleDelete = useCallback(
        (id: string, e: React.MouseEvent) => {
            e.stopPropagation();
            onDelete(id);
        },
        [onDelete]
    );

    if (items.length === 0) {
        return <div className={styles.scriptEmpty}>{emptyMessage}</div>;
    }

    return (
        <div className={styles.scriptList}>
            {items.map(item => {
                const content = getContent(item);
                return (
                    <div
                        key={item.id}
                        className={styles.scriptItem}
                        onClick={() => handleLoad(content, item)}
                        data-testid="script-item"
                    >
                        {item.label && (
                            <div className={styles.scriptLabel} data-testid="script-label">
                                {item.label}
                            </div>
                        )}
                        <div className={styles.scriptMeta}>
                            <div className={styles.scriptMetaLeft}>
                                {renderMeta?.(item)}
                                <span>{formatTime(item.timestamp)}</span>
                            </div>
                            <div className={styles.scriptActions}>
                                <button
                                    className={styles.scriptAction}
                                    title="Delete"
                                    onClick={e => handleDelete(item.id, e)}
                                    data-testid="script-action-delete"
                                >
                                    &times;
                                </button>
                            </div>
                        </div>
                        <div className={styles.scriptPreview} data-testid="script-preview">
                            {getPreview(content)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
