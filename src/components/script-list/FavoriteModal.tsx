// Shared Favorite Modal Component
import { useState, useCallback, useRef, useEffect } from 'react';
import { Modal } from '../modal/Modal';
import styles from './ScriptList.module.css';

interface FavoriteModalProps {
  isOpen: boolean;
  defaultLabel: string;
  placeholder?: string;
  onSave: (label: string) => void;
  onClose: () => void;
  /** Test ID prefix for the modal elements (e.g., "apex" results in data-testid="apex-favorite-dialog") */
  testIdPrefix?: string;
}

/**
 * Modal for adding an item to favorites with a custom label.
 */
export function FavoriteModal({
  isOpen,
  defaultLabel,
  placeholder = 'Enter a label',
  onSave,
  onClose,
  testIdPrefix = 'favorite',
}: FavoriteModalProps) {
  const [label, setLabel] = useState(defaultLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset label when modal opens with new default
  useEffect(() => {
    if (isOpen) {
      setLabel(defaultLabel);
    }
  }, [isOpen, defaultLabel]);

  const handleOpen = useCallback(() => {
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
  }, []);

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
      }
    },
    [handleSave]
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} onOpen={handleOpen}>
      <div className={styles.favoriteDialog} data-testid={`${testIdPrefix}-favorite-dialog`}>
        <h3>Add to Favorites</h3>
        <input
          ref={inputRef}
          type="text"
          className={styles.favoriteInput}
          placeholder={placeholder}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={handleKeyDown}
          data-testid={`${testIdPrefix}-favorite-input`}
        />
        <div className={styles.favoriteButtons}>
          <button className="button-neutral" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button-brand"
            onClick={handleSave}
            disabled={!label.trim()}
            data-testid={`${testIdPrefix}-favorite-save`}
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
