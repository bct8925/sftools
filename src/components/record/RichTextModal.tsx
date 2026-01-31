import DOMPurify from 'dompurify';
import { Modal } from '../modal/Modal';
import { SfIcon } from '../sf-icon/SfIcon';
import type { FieldDescribe } from '../../types/salesforce';
import styles from './RecordPage.module.css';

interface RichTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  field: FieldDescribe | null;
  value: unknown;
}

/**
 * Modal for previewing rich text, textarea, and encrypted string fields.
 * HTML content is sanitized for security.
 */
export function RichTextModal({ isOpen, onClose, field, value }: RichTextModalProps) {
  if (!field || value === null || value === undefined) {
    return null;
  }

  const stringValue = String(value);
  const isHtml = field.type === 'html';

  return (
    <Modal isOpen={isOpen} onClose={onClose} className={styles.richTextModal}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div>
            <h3>Rich Text Preview</h3>
            <div className={styles.modalFieldInfo}>
              {field.label} ({field.name})
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close">
            <SfIcon name="close" />
          </button>
        </div>
        <div className={styles.modalBody}>
          {isHtml ? (
            <div
              className={styles.modalContentArea}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(stringValue) }}
            />
          ) : (
            <div className={`${styles.modalContentArea} ${styles.preWrap}`}>
              {stringValue}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
