// Query History - History and favorites dropdown with modal support
import { useState, useEffect, useCallback, useRef } from 'react';
import { ButtonIcon } from '../button-icon/ButtonIcon';
import { Modal } from '../modal/Modal';
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
 * History and favorites dropdown for query tab.
 * Includes a modal for adding favorites with custom labels.
 */
export function QueryHistory({ onSelectQuery, historyManagerRef }: QueryHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeDropdownTab, setActiveDropdownTab] = useState<'history' | 'favorites'>('history');
  const [history, setHistory] = useState<QueryHistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<QueryFavoriteEntry[]>([]);

  // Favorite modal state
  const [favoriteModalOpen, setFavoriteModalOpen] = useState(false);
  const [pendingFavoriteQuery, setPendingFavoriteQuery] = useState<string | null>(null);
  const [favoriteLabel, setFavoriteLabel] = useState('');
  const favoriteInputRef = useRef<HTMLInputElement>(null);

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

  // Handle dropdown toggle
  const handleToggle = useCallback((open: boolean) => {
    setIsOpen(open);
    if (open) {
      refreshLists();
    }
  }, [refreshLists]);

  // Handle tab switch
  const handleTabSwitch = useCallback((tab: 'history' | 'favorites') => {
    setActiveDropdownTab(tab);
  }, []);

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
    setFavoriteLabel(defaultLabel);
    setPendingFavoriteQuery(query);
    setFavoriteModalOpen(true);
    setIsOpen(false);
  }, [historyManagerRef]);

  // Handle saving favorite
  const handleSaveFavorite = useCallback(async () => {
    const manager = historyManagerRef.current;
    if (!manager || !pendingFavoriteQuery || !favoriteLabel.trim()) return;

    await manager.addToFavorites(pendingFavoriteQuery, favoriteLabel.trim());
    refreshLists();
    setFavoriteModalOpen(false);
    setPendingFavoriteQuery(null);
    setFavoriteLabel('');
  }, [historyManagerRef, pendingFavoriteQuery, favoriteLabel, refreshLists]);

  // Handle deleting from history
  const handleDeleteFromHistory = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const manager = historyManagerRef.current;
      if (!manager) return;

      await manager.removeFromHistory(id);
      refreshLists();
    },
    [historyManagerRef, refreshLists]
  );

  // Handle deleting from favorites
  const handleDeleteFromFavorites = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const manager = historyManagerRef.current;
      if (!manager) return;

      await manager.removeFromFavorites(id);
      refreshLists();
    },
    [historyManagerRef, refreshLists]
  );

  // Handle favorite modal open (focus input)
  const handleFavoriteModalOpen = useCallback(() => {
    setTimeout(() => {
      favoriteInputRef.current?.focus();
      favoriteInputRef.current?.select();
    }, 50);
  }, []);

  // Handle Enter key in favorite input
  const handleFavoriteKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSaveFavorite();
      } else if (e.key === 'Escape') {
        setFavoriteModalOpen(false);
      }
    },
    [handleSaveFavorite]
  );

  const manager = historyManagerRef.current;

  return (
    <>
      <ButtonIcon
        icon="clock"
        title="History & Favorites"
        className={styles.historyBtn}
        onToggle={handleToggle}
      >
        {/* Dropdown content */}
        <div className={styles.historyDropdown}>
          <div className={styles.dropdownTabs}>
            <button
              className={`${styles.dropdownTab}${activeDropdownTab === 'history' ? ` ${styles.dropdownTabActive}` : ''}`}
              onClick={() => handleTabSwitch('history')}
            >
              History
            </button>
            <button
              className={`${styles.dropdownTab}${activeDropdownTab === 'favorites' ? ` ${styles.dropdownTabActive}` : ''}`}
              onClick={() => handleTabSwitch('favorites')}
            >
              Favorites
            </button>
          </div>

          <div className={styles.dropdownContent}>
            {/* History list */}
            {activeDropdownTab === 'history' && (
              <div className={styles.scriptList}>
                {history.length === 0 ? (
                  <div className={styles.scriptEmpty}>
                    No queries yet.<br />Execute some SOQL to see history here.
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      className={styles.scriptItem}
                      onClick={() => handleSelectQuery(item.query)}
                    >
                      <div className={styles.scriptPreview}>
                        {manager?.getPreview(item.query) || item.query}
                      </div>
                      <div className={styles.scriptMeta}>
                        <span>{manager?.formatRelativeTime(item.timestamp)}</span>
                        <div className={styles.scriptActions}>
                          <button
                            className={styles.scriptAction}
                            title="Load query"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectQuery(item.query);
                            }}
                          >
                            &#8629;
                          </button>
                          <button
                            className={styles.scriptAction}
                            title="Add to favorites"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToFavorites(item.query);
                            }}
                          >
                            &#9733;
                          </button>
                          <button
                            className={styles.scriptAction}
                            title="Delete"
                            onClick={(e) => handleDeleteFromHistory(item.id, e)}
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Favorites list */}
            {activeDropdownTab === 'favorites' && (
              <div className={styles.scriptList}>
                {favorites.length === 0 ? (
                  <div className={styles.scriptEmpty}>
                    No favorites yet.<br />Click &#9733; on a query to save it.
                  </div>
                ) : (
                  favorites.map((item) => (
                    <div
                      key={item.id}
                      className={styles.scriptItem}
                      onClick={() => handleSelectQuery(item.query)}
                    >
                      <div className={styles.scriptLabel}>{item.label}</div>
                      <div className={styles.scriptMeta}>
                        <span>{manager?.formatRelativeTime(item.timestamp)}</span>
                        <div className={styles.scriptActions}>
                          <button
                            className={styles.scriptAction}
                            title="Load query"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectQuery(item.query);
                            }}
                          >
                            &#8629;
                          </button>
                          <button
                            className={styles.scriptAction}
                            title="Delete"
                            onClick={(e) => handleDeleteFromFavorites(item.id, e)}
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </ButtonIcon>

      {/* Favorite Modal */}
      <Modal
        isOpen={favoriteModalOpen}
        onClose={() => setFavoriteModalOpen(false)}
        onOpen={handleFavoriteModalOpen}
      >
        <div className={styles.favoriteDialog}>
          <h3>Add to Favorites</h3>
          <input
            ref={favoriteInputRef}
            type="text"
            className={styles.favoriteInput}
            placeholder="Enter a label for this query"
            value={favoriteLabel}
            onChange={(e) => setFavoriteLabel(e.target.value)}
            onKeyDown={handleFavoriteKeyDown}
          />
          <div className={styles.favoriteButtons}>
            <button
              className="button-neutral"
              onClick={() => setFavoriteModalOpen(false)}
            >
              Cancel
            </button>
            <button
              className="button-brand"
              onClick={handleSaveFavorite}
              disabled={!favoriteLabel.trim()}
            >
              Save
            </button>
          </div>
        </div>
      </Modal>
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
