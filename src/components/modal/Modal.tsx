import { useEffect, useCallback, type ReactNode } from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  children: ReactNode;
  className?: string;
}

/**
 * Centered modal dialog with backdrop overlay.
 * Supports closing via Escape key and backdrop click.
 */
export function Modal({ isOpen, onClose, onOpen, children, className }: ModalProps) {
  // Handle Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Fire onOpen callback when modal opens
  useEffect(() => {
    if (isOpen && onOpen) {
      onOpen();
    }
  }, [isOpen, onOpen]);

  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    // Prevent backdrop click from firing when clicking content
    e.stopPropagation();
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <div className={`${styles.modal}${className ? ` ${className}` : ''}`}>
      <div className={styles.backdrop} onClick={handleBackdropClick} />
      <div className={styles.content} onClick={handleContentClick}>
        {children}
      </div>
    </div>
  );
}
