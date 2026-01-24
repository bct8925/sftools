// Apex History - History and favorites modal with shared components
import { useState, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { ButtonIcon } from '../button-icon/ButtonIcon';
import { Modal } from '../modal/Modal';
import { HistoryList, FavoritesList, FavoriteModal } from '../script-list';
import { HistoryManager, type HistoryEntry, type FavoriteEntry } from '../../lib/history-manager';
import { getPreview } from '../../lib/apex-utils';
import styles from './ApexTab.module.css';

export interface ApexHistoryRef {
  saveToHistory: (code: string) => Promise<void>;
}

interface ApexHistoryProps {
  onLoadScript: (code: string) => void;
}

// Extended history entry with code property
interface ApexHistoryEntry extends HistoryEntry {
  code: string;
}

interface ApexFavoriteEntry extends FavoriteEntry {
  code: string;
}

/**
 * History & Favorites modal for Apex Tab
 * Manages history and favorites lists with HistoryManager
 */
export const ApexHistory = forwardRef<ApexHistoryRef, ApexHistoryProps>(({ onLoadScript }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'favorites'>('history');

  // Favorite modal state
  const [favoriteModalOpen, setFavoriteModalOpen] = useState(false);
  const [pendingFavorite, setPendingFavorite] = useState<{ code: string; label: string } | null>(null);

  // Create history manager instance (persists across re-renders)
  const historyManager = useMemo(
    () =>
      new HistoryManager(
        { history: 'apexHistory', favorites: 'apexFavorites' },
        { contentProperty: 'code' }
      ),
    []
  );

  const [history, setHistory] = useState<ApexHistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<ApexFavoriteEntry[]>([]);

  // Load history and favorites when modal opens
  const handleOpen = useCallback(async () => {
    await historyManager.load();
    setHistory([...(historyManager.history as ApexHistoryEntry[])]);
    setFavorites([...(historyManager.favorites as ApexFavoriteEntry[])]);
  }, [historyManager]);

  const refreshLists = useCallback(() => {
    setHistory([...(historyManager.history as ApexHistoryEntry[])]);
    setFavorites([...(historyManager.favorites as ApexFavoriteEntry[])]);
  }, [historyManager]);

  const handleLoadScript = useCallback(
    (code: string) => {
      onLoadScript(code);
      setIsOpen(false);
    },
    [onLoadScript]
  );

  const handleAddToFavorites = useCallback((code: string) => {
    const defaultLabel = getPreview(code);
    setPendingFavorite({ code, label: defaultLabel });
    setFavoriteModalOpen(true);
    setIsOpen(false);
  }, []);

  const handleSaveFavorite = useCallback(
    async (label: string) => {
      if (pendingFavorite) {
        await historyManager.addToFavorites(pendingFavorite.code, label);
        refreshLists();
        setFavoriteModalOpen(false);
        setPendingFavorite(null);
      }
    },
    [pendingFavorite, historyManager, refreshLists]
  );

  const handleCloseFavoriteModal = useCallback(() => {
    setFavoriteModalOpen(false);
    setPendingFavorite(null);
  }, []);

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

  // Content accessor for history entries
  const getCodeContent = useCallback((item: ApexHistoryEntry) => item.code, []);

  // Time formatter
  const formatTime = useCallback(
    (timestamp: number) => historyManager.formatRelativeTime(timestamp),
    [historyManager]
  );

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
                emptyMessage={<>No scripts yet.<br />Execute some Apex to see history here.</>}
                getContent={getCodeContent}
                getPreview={getPreview}
                formatTime={formatTime}
                onLoad={handleLoadScript}
                onAddToFavorites={handleAddToFavorites}
                onDelete={handleDeleteHistory}
              />
            )}
            {activeTab === 'favorites' && (
              <FavoritesList
                items={favorites}
                emptyMessage={<>No favorites yet.<br />Click &#9733; on a script to save it.</>}
                getContent={getCodeContent}
                formatTime={formatTime}
                onLoad={handleLoadScript}
                onDelete={handleDeleteFavorite}
              />
            )}
          </div>
        </div>
      </Modal>

      {/* Favorite Modal */}
      <FavoriteModal
        isOpen={favoriteModalOpen}
        defaultLabel={pendingFavorite?.label || ''}
        placeholder="Enter a label for this script"
        onSave={handleSaveFavorite}
        onClose={handleCloseFavoriteModal}
      />
    </>
  );
});

ApexHistory.displayName = 'ApexHistory';
