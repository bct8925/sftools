// Query History - History and favorites modal with shared components
import { useState, useEffect, useCallback } from 'react';
import { ButtonIcon } from '../button-icon/ButtonIcon';
import { Modal } from '../modal/Modal';
import { HistoryList, FavoritesList, FavoriteModal } from '../script-list';
import { HistoryManager, type HistoryEntry, type FavoriteEntry } from '../../lib/history-manager.js';
import styles from './QueryTab.module.css';

interface QueryHistoryProps {
  /** Called when a query is selected from history/favorites */
  onSelectQuery: (query: string) => void;
  /** Called when a query is saved to history (after execution) */
  historyManagerRef: React.MutableRefObject<HistoryManager | null>;
}

// Extended history entry with query property
interface QueryHistoryEntry extends HistoryEntry {
  query: string;
}

interface QueryFavoriteEntry extends FavoriteEntry {
  query: string;
}

/**
 * History and favorites modal for query tab.
 * Includes a modal for adding favorites with custom labels.
 */
export function QueryHistory({ onSelectQuery, historyManagerRef }: QueryHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'favorites'>('history');
  const [history, setHistory] = useState<QueryHistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<QueryFavoriteEntry[]>([]);

  // Favorite modal state
  const [favoriteModalOpen, setFavoriteModalOpen] = useState(false);
  const [pendingFavorite, setPendingFavorite] = useState<{ query: string; label: string } | null>(null);

  // Initialize history manager
  useEffect(() => {
    const manager = new HistoryManager(
      { history: 'queryHistory', favorites: 'queryFavorites' },
      { contentProperty: 'query' }
    );
    historyManagerRef.current = manager;

    // Load initial data
    manager.load().then(() => {
      setHistory(manager.history as QueryHistoryEntry[]);
      setFavorites(manager.favorites as QueryFavoriteEntry[]);
    });
  }, [historyManagerRef]);

  // Refresh lists from manager
  const refreshLists = useCallback(() => {
    const manager = historyManagerRef.current;
    if (manager) {
      setHistory([...(manager.history as QueryHistoryEntry[])]);
      setFavorites([...(manager.favorites as QueryFavoriteEntry[])]);
    }
  }, [historyManagerRef]);

  // Load data when modal opens
  const handleOpen = useCallback(async () => {
    const manager = historyManagerRef.current;
    if (manager) {
      await manager.load();
      setHistory([...(manager.history as QueryHistoryEntry[])]);
      setFavorites([...(manager.favorites as QueryFavoriteEntry[])]);
    }
  }, [historyManagerRef]);

  // Handle selecting a query
  const handleSelectQuery = useCallback(
    (query: string) => {
      onSelectQuery(query);
      setIsOpen(false);
    },
    [onSelectQuery]
  );

  // Handle adding to favorites (opens modal)
  const handleAddToFavorites = useCallback((query: string) => {
    const manager = historyManagerRef.current;
    if (!manager) return;

    const defaultLabel = manager.getPreview(query);
    setPendingFavorite({ query, label: defaultLabel });
    setFavoriteModalOpen(true);
    setIsOpen(false);
  }, [historyManagerRef]);

  // Handle saving favorite
  const handleSaveFavorite = useCallback(async (label: string) => {
    const manager = historyManagerRef.current;
    if (!manager || !pendingFavorite) return;

    await manager.addToFavorites(pendingFavorite.query, label);
    refreshLists();
    setFavoriteModalOpen(false);
    setPendingFavorite(null);
  }, [historyManagerRef, pendingFavorite, refreshLists]);

  // Handle closing favorite modal
  const handleCloseFavoriteModal = useCallback(() => {
    setFavoriteModalOpen(false);
    setPendingFavorite(null);
  }, []);

  // Handle deleting from history
  const handleDeleteFromHistory = useCallback(
    async (id: string) => {
      const manager = historyManagerRef.current;
      if (!manager) return;

      await manager.removeFromHistory(id);
      refreshLists();
    },
    [historyManagerRef, refreshLists]
  );

  // Handle deleting from favorites
  const handleDeleteFromFavorites = useCallback(
    async (id: string) => {
      const manager = historyManagerRef.current;
      if (!manager) return;

      await manager.removeFromFavorites(id);
      refreshLists();
    },
    [historyManagerRef, refreshLists]
  );

  const manager = historyManagerRef.current;

  // Content accessor for history entries
  const getQueryContent = useCallback((item: QueryHistoryEntry) => item.query, []);

  // Preview generator
  const getPreview = useCallback(
    (query: string) => manager?.getPreview(query) || query,
    [manager]
  );

  // Time formatter
  const formatTime = useCallback(
    (timestamp: number) => manager?.formatRelativeTime(timestamp) || '',
    [manager]
  );

  return (
    <>
      <ButtonIcon
        icon="clock"
        title="History & Favorites"
        className={styles.historyBtn}
        onClick={() => setIsOpen(true)}
      />

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} onOpen={handleOpen}>
        <div className={styles.historyModal}>
          <div className={styles.dropdownTabs}>
            <button
              className={`${styles.dropdownTab}${activeTab === 'history' ? ` ${styles.dropdownTabActive}` : ''}`}
              onClick={() => setActiveTab('history')}
            >
              History
            </button>
            <button
              className={`${styles.dropdownTab}${activeTab === 'favorites' ? ` ${styles.dropdownTabActive}` : ''}`}
              onClick={() => setActiveTab('favorites')}
            >
              Favorites
            </button>
          </div>

          <div className={styles.dropdownContent}>
            {activeTab === 'history' && (
              <HistoryList
                items={history}
                emptyMessage={<>No queries yet.<br />Execute some SOQL to see history here.</>}
                getContent={getQueryContent}
                getPreview={getPreview}
                formatTime={formatTime}
                onLoad={handleSelectQuery}
                onAddToFavorites={handleAddToFavorites}
                onDelete={handleDeleteFromHistory}
              />
            )}

            {activeTab === 'favorites' && (
              <FavoritesList
                items={favorites}
                emptyMessage={<>No favorites yet.<br />Click &#9733; on a query to save it.</>}
                getContent={getQueryContent}
                formatTime={formatTime}
                onLoad={handleSelectQuery}
                onDelete={handleDeleteFromFavorites}
              />
            )}
          </div>
        </div>
      </Modal>

      {/* Favorite Modal */}
      <FavoriteModal
        isOpen={favoriteModalOpen}
        defaultLabel={pendingFavorite?.label || ''}
        placeholder="Enter a label for this query"
        onSave={handleSaveFavorite}
        onClose={handleCloseFavoriteModal}
      />
    </>
  );
}

// Export a hook for saving to history
export function useSaveToHistory(
  historyManagerRef: React.MutableRefObject<HistoryManager | null>
) {
  return useCallback(
    async (query: string) => {
      const manager = historyManagerRef.current;
      if (manager) {
        await manager.saveToHistory(query);
      }
    },
    [historyManagerRef]
  );
}
