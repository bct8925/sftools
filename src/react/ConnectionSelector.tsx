import { useConnection } from '../contexts/ConnectionContext';
import styles from './ConnectionSelector.module.css';

/**
 * Displays the currently active connection label in the header.
 * Shows truncated label with full text on hover via title attribute.
 */
export function ConnectionSelector() {
  const { activeConnection } = useConnection();

  if (!activeConnection?.label) {
    return null;
  }

  return (
    <div
      className={styles.currentConnectionDisplay}
      title={activeConnection.label}
    >
      {activeConnection.label}
    </div>
  );
}
