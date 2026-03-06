// ScriptHistory - Generic history/favorites modal component
import {
    useState,
    useMemo,
    useCallback,
    forwardRef,
    useImperativeHandle,
    type ReactNode,
} from 'react';
import { ButtonIcon } from '../button-icon/ButtonIcon';
import { Modal } from '../modal/Modal';
import { HistoryList, FavoritesList } from './ScriptList';
import { FavoriteModal } from './FavoriteModal';
import {
    HistoryManager,
    type HistoryEntry,
    type FavoriteEntry,
    type StorageKeys,
} from '../../lib/history-manager';
import styles from './ScriptList.module.css';

export interface ScriptHistoryRef {
    saveToHistory: (content: string, metadata?: Record<string, unknown>) => Promise<void>;
}

interface ScriptHistoryProps {
    storageKeys: StorageKeys;
    contentProperty: string;
    getContent: (item: HistoryEntry) => string;
    getPreview: (content: string) => string;
    emptyHistoryMessage: ReactNode;
    emptyFavoritesMessage: ReactNode;
    favoritePlaceholder: string;
    testIdPrefix: string;
    buttonClassName?: string;
    renderMeta?: (item: HistoryEntry) => ReactNode;
    getFavoriteMetadata?: (
        content: string,
        item: HistoryEntry
    ) => Record<string, unknown> | undefined;
    onLoad: (content: string, item: HistoryEntry) => void;
}

export const ScriptHistory = forwardRef<ScriptHistoryRef, ScriptHistoryProps>(
    (
        {
            storageKeys,
            contentProperty,
            getContent,
            getPreview,
            emptyHistoryMessage,
            emptyFavoritesMessage,
            favoritePlaceholder,
            testIdPrefix,
            buttonClassName,
            renderMeta,
            getFavoriteMetadata,
            onLoad,
        },
        ref
    ) => {
        const [isOpen, setIsOpen] = useState(false);
        const [activeTab, setActiveTab] = useState<'history' | 'favorites'>('history');
        const [history, setHistory] = useState<HistoryEntry[]>([]);
        const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
        const [favoriteModalOpen, setFavoriteModalOpen] = useState(false);
        const [pendingFavorite, setPendingFavorite] = useState<{
            content: string;
            label: string;
            metadata?: Record<string, unknown>;
        } | null>(null);

        const { history: historyKey, favorites: favoritesKey } = storageKeys;
        const manager = useMemo(
            () =>
                new HistoryManager(
                    { history: historyKey, favorites: favoritesKey },
                    { contentProperty }
                ),
            [historyKey, favoritesKey, contentProperty]
        );

        const refreshLists = useCallback(() => {
            setHistory([...manager.history]);
            setFavorites([...manager.favorites]);
        }, [manager]);

        const handleOpen = useCallback(async () => {
            await manager.load();
            refreshLists();
        }, [manager, refreshLists]);

        const handleLoad = useCallback(
            (content: string, item: HistoryEntry) => {
                onLoad(content, item);
                setIsOpen(false);
            },
            [onLoad]
        );

        const handleAddToFavorites = useCallback(
            (content: string, item: HistoryEntry) => {
                const defaultLabel = '';
                const metadata = getFavoriteMetadata?.(content, item);
                setPendingFavorite({ content, label: defaultLabel, metadata });
                setFavoriteModalOpen(true);
                setIsOpen(false);
            },
            [getPreview, getFavoriteMetadata]
        );

        const handleSaveFavorite = useCallback(
            async (label: string) => {
                if (!pendingFavorite) return;
                await manager.addToFavorites(
                    pendingFavorite.content,
                    label,
                    pendingFavorite.metadata
                );
                refreshLists();
                setFavoriteModalOpen(false);
                setPendingFavorite(null);
            },
            [manager, pendingFavorite, refreshLists]
        );

        const handleCloseFavoriteModal = useCallback(() => {
            setFavoriteModalOpen(false);
            setPendingFavorite(null);
        }, []);

        const handleDeleteFromHistory = useCallback(
            async (id: string) => {
                await manager.removeFromHistory(id);
                refreshLists();
            },
            [manager, refreshLists]
        );

        const handleDeleteFromFavorites = useCallback(
            async (id: string) => {
                await manager.removeFromFavorites(id);
                refreshLists();
            },
            [manager, refreshLists]
        );

        const saveToHistory = useCallback(
            async (content: string, metadata?: Record<string, unknown>) => {
                await manager.saveToHistory(content, metadata);
                refreshLists();
            },
            [manager, refreshLists]
        );

        useImperativeHandle(ref, () => ({ saveToHistory }));

        const formatTime = useCallback(
            (timestamp: number) => manager.formatRelativeTime(timestamp),
            [manager]
        );

        return (
            <>
                <ButtonIcon
                    icon="clock"
                    title="History & Favorites"
                    className={buttonClassName}
                    onClick={() => setIsOpen(true)}
                    data-testid={`${testIdPrefix}-history-btn`}
                />

                <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} onOpen={handleOpen}>
                    <div
                        className={styles.historyModal}
                        data-testid={`${testIdPrefix}-history-modal`}
                    >
                        <div className={styles.dropdownTabs}>
                            <button
                                className={`${styles.dropdownTab}${activeTab === 'history' ? ` ${styles.dropdownTabActive}` : ''}`}
                                onClick={() => setActiveTab('history')}
                                data-testid={`${testIdPrefix}-history-tab`}
                            >
                                History
                            </button>
                            <button
                                className={`${styles.dropdownTab}${activeTab === 'favorites' ? ` ${styles.dropdownTabActive}` : ''}`}
                                onClick={() => setActiveTab('favorites')}
                                data-testid={`${testIdPrefix}-favorites-tab`}
                            >
                                Favorites
                            </button>
                        </div>

                        <div className={styles.dropdownContent}>
                            {activeTab === 'history' && (
                                <div data-testid={`${testIdPrefix}-history-list`}>
                                    <HistoryList
                                        items={history}
                                        emptyMessage={emptyHistoryMessage}
                                        getContent={getContent}
                                        getPreview={getPreview}
                                        formatTime={formatTime}
                                        onLoad={handleLoad}
                                        onAddToFavorites={handleAddToFavorites}
                                        onDelete={handleDeleteFromHistory}
                                        renderMeta={renderMeta}
                                    />
                                </div>
                            )}

                            {activeTab === 'favorites' && (
                                <div data-testid={`${testIdPrefix}-favorites-list`}>
                                    <FavoritesList
                                        items={favorites}
                                        emptyMessage={emptyFavoritesMessage}
                                        getContent={getContent}
                                        getPreview={getPreview}
                                        formatTime={formatTime}
                                        onLoad={handleLoad}
                                        onDelete={handleDeleteFromFavorites}
                                        renderMeta={renderMeta}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>

                <FavoriteModal
                    isOpen={favoriteModalOpen}
                    defaultLabel={pendingFavorite?.label ?? ''}
                    placeholder={favoritePlaceholder}
                    onSave={handleSaveFavorite}
                    onClose={handleCloseFavoriteModal}
                    testIdPrefix={testIdPrefix}
                />
            </>
        );
    }
);

ScriptHistory.displayName = 'ScriptHistory';
