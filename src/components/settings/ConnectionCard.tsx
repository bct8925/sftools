import type { SalesforceConnection } from '../../types/salesforce';
import { icons } from '../../lib/icons';
import styles from './ConnectionCard.module.css';

interface ConnectionCardProps {
  connection: SalesforceConnection;
  isActive: boolean;
  onEdit: (id: string) => void;
  onReauth: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ConnectionCard({
  connection,
  isActive,
  onEdit,
  onReauth,
  onDelete,
}: ConnectionCardProps) {
  return (
    <div className={`${styles.connectionItem} ${isActive ? styles.active : ''}`}>
      <div className={styles.connectionInfo}>
        <div className={styles.connectionLabel}>{connection.label}</div>
        <div className={styles.connectionDetail}>
          {connection.refreshToken && (
            <span className={`${styles.badge} ${styles.refreshEnabled}`} title="Auto-refresh enabled">
              <span dangerouslySetInnerHTML={{ __html: icons.refreshSmall }} />
              Auto-refresh
            </span>
          )}
          {connection.clientId && (
            <span className={styles.badge}>Custom App</span>
          )}
        </div>
      </div>
      <div className={styles.connectionActions}>
        <button
          className={styles.actionButton}
          onClick={() => onEdit(connection.id)}
          title="Edit"
        >
          <span dangerouslySetInnerHTML={{ __html: icons.edit }} />
        </button>
        <button
          className={styles.actionButton}
          onClick={() => onReauth(connection.id)}
          title="Re-authorize"
        >
          <span dangerouslySetInnerHTML={{ __html: icons.refresh }} />
        </button>
        <button
          className={`${styles.actionButton} ${styles.deleteButton}`}
          onClick={() => onDelete(connection.id)}
          title="Delete"
        >
          <span dangerouslySetInnerHTML={{ __html: icons.trash }} />
        </button>
      </div>
    </div>
  );
}
