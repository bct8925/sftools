import { useState, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { ButtonIcon } from '../button-icon/ButtonIcon';
import { Modal } from '../modal/Modal';
import { HistoryManager, type HistoryEntry, type FavoriteEntry } from '../../lib/history-manager';
import { getPreview } from '../../lib/apex-utils';
import styles from './ApexTab.module.css';

export interface ApexHistoryRef {
  saveToHistory: (code: string) => Promise<void>;
}

interface ApexHistoryProps {
  onLoadScript: (code: string) => void;
}

/**
 * History & Favorites modal for Apex Tab
 * Manages history and favorites lists with HistoryManager
 */
export const ApexHistory = forwardRef<ApexHistoryRef, ApexHistoryProps>(({ onLoadScript }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'favorites'>('history');
  const [favoriteModalData, setFavoriteModalData] = useState<{
    code: string;
    defaultLabel: string;
  } | null>(null);

  // Create history manager instance (persists across re-renders)
  const historyManager = useMemo(
    () =>
      new HistoryManager(
        { history: 'apexHistory', favorites: 'apexFavorites' },
        { contentProperty: 'code' }
      ),
    []
  );

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);

  // Load history and favorites when modal opens
  const handleOpen = useCallback(async () => {
    await historyManager.load();
    setHistory([...historyManager.history]);
    setFavorites([...historyManager.favorites]);
  }, [historyManager]);

  const refreshLists = useCallback(() => {
    setHistory([...historyManager.history]);
    setFavorites([...historyManager.favorites]);
  }, [historyManager]);

  const handleLoadScript = useCallback(
    (code: string) => {
      onLoadScript(code);
      setIsOpen(false);
    },
    [onLoadScript]
  );

  const handleAddToFavorites = useCallback(
    (code: string) => {
      const defaultLabel = getPreview(code);
      setFavoriteModalData({ code, defaultLabel });
      setIsOpen(false);
    },
    []
  );

  const handleSaveFavorite = useCallback(
    async (label: string) => {
      if (favoriteModalData) {
        await historyManager.addToFavorites(favoriteModalData.code, label);
        refreshLists();
        setFavoriteModalData(null);
      }
    },
    [favoriteModalData, historyManager, refreshLists]
  );

  const handleDeleteHistory = useCallback(
    async (id: string) => {
      await historyManager.removeFromHistory(id);
      refreshLists();
    },
    [historyManager, refreshLists]
  );

  const handleDeleteFavorite = useCallback(
    async (id: string) => {
      await historyManager.removeFromFavorites(id);
      refreshLists();
    },
    [historyManager, refreshLists]
  );

  // Public method for saving to history (called from parent)
  const saveToHistory = useCallback(
    async (code: string) => {
      await historyManager.saveToHistory(code);
      refreshLists();
    },
    [historyManager, refreshLists]
  );

  // Expose saveToHistory via ref
  useImperativeHandle(ref, () => ({
    saveToHistory,
  }));

  return (
    <>
      <ButtonIcon
        icon="clock"
        title="History & Favorites"
        onClick={() => setIsOpen(true)}
        className={styles.historyBtn}
      />

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} onOpen={handleOpen}>
        <div className={styles.historyModal}>
          <div className={styles.dropdownTabs}>
            <button
              className={`${styles.dropdownTab} ${activeTab === 'history' ? styles.active : ''}`}
              onClick={() => setActiveTab('history')}
            >
              History
            </button>
            <button
              className={`${styles.dropdownTab} ${activeTab === 'favorites' ? styles.active : ''}`}
              onClick={() => setActiveTab('favorites')}
            >
              Favorites
            </button>
          </div>

          <div className={styles.dropdownContent}>
            {activeTab === 'history' && (
              <HistoryList
                items={history}
                onLoad={handleLoadScript}
                onAddToFavorites={handleAddToFavorites}
                onDelete={handleDeleteHistory}
                historyManager={historyManager}
              />
            )}
            {activeTab === 'favorites' && (
              <FavoritesList
                items={favorites}
                onLoad={handleLoadScript}
                onDelete={handleDeleteFavorite}
                historyManager={historyManager}
              />
            )}
          </div>
        </div>
      </Modal>

      {favoriteModalData && (
        <FavoriteModal
          defaultLabel={favoriteModalData.defaultLabel}
          onSave={handleSaveFavorite}
          onCancel={() => setFavoriteModalData(null)}
        />
      )}
    </>
  );
});

ApexHistory.displayName = 'ApexHistory';

interface HistoryListProps {
  items: HistoryEntry[];
  onLoad: (code: string) => void;
  onAddToFavorites: (code: string) => void;
  onDelete: (id: string) => void;
  historyManager: HistoryManager;
}

function HistoryList({ items, onLoad, onAddToFavorites, onDelete, historyManager }: HistoryListProps) {
  if (items.length === 0) {
    return (
      <div className="script-empty">
        No scripts yet.
        <br />
        Execute some Apex to see history here.
      </div>
    );
  }

  return (
    <div className="script-list">
      {items.map((item) => {
        const code = (item as any).code as string;
        return (
          <div key={item.id} className="script-item" onClick={() => onLoad(code)}>
            <div className="script-preview">{getPreview(code)}</div>
            <div className="script-meta">
              <span>{historyManager.formatRelativeTime(item.timestamp)}</span>
              <div className="script-actions">
                <button
                  className="script-action load"
                  title="Load script"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoad(code);
                  }}
                >
                  &#8629;
                </button>
                <button
                  className="script-action favorite"
                  title="Add to favorites"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToFavorites(code);
                  }}
                >
                  &#9733;
                </button>
                <button
                  className="script-action delete"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item.id);
                  }}
                >
                  &times;
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface FavoritesListProps {
  items: FavoriteEntry[];
  onLoad: (code: string) => void;
  onDelete: (id: string) => void;
  historyManager: HistoryManager;
}

function FavoritesList({ items, onLoad, onDelete, historyManager }: FavoritesListProps) {
  if (items.length === 0) {
    return (
      <div className="script-empty">
        No favorites yet.
        <br />
        Click &#9733; on a script to save it.
      </div>
    );
  }

  return (
    <div className="script-list">
      {items.map((item) => {
        const code = (item as any).code as string;
        return (
          <div key={item.id} className="script-item" onClick={() => onLoad(code)}>
            <div className="script-label">{item.label}</div>
            <div className="script-meta">
              <span>{historyManager.formatRelativeTime(item.timestamp)}</span>
              <div className="script-actions">
                <button
                  className="script-action load"
                  title="Load script"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoad(code);
                  }}
                >
                  &#8629;
                </button>
                <button
                  className="script-action delete"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item.id);
                  }}
                >
                  &times;
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface FavoriteModalProps {
  defaultLabel: string;
  onSave: (label: string) => void;
  onCancel: () => void;
}

function FavoriteModal({ defaultLabel, onSave, onCancel }: FavoriteModalProps) {
  const [label, setLabel] = useState(defaultLabel);

  const handleSave = useCallback(() => {
    const trimmed = label.trim();
    if (trimmed) {
      onSave(trimmed);
    }
  }, [label, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSave();
      } else if (e.key === 'Escape') {
        onCancel();
      }
    },
    [handleSave, onCancel]
  );

  return (
    <div className="modal-overlay show" onClick={onCancel}>
      <div
        className={`modal-dialog ${styles.favoriteDialog}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Add to Favorites</h3>
        <input
          type="text"
          className={styles.favoriteInput}
          placeholder="Enter a label for this script"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
        <div className="modal-buttons">
          <button className="button-neutral" onClick={onCancel}>
            Cancel
          </button>
          <button className="button-brand" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
