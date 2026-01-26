import { useState } from 'react';
import { useConnection } from '../../contexts/ConnectionContext';
import { clearDescribeCache } from '../../lib/salesforce';
import styles from './CacheSettings.module.css';

export function CacheSettings() {
  const { isAuthenticated } = useConnection();
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error' | ''>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshCache = async () => {
    if (!isAuthenticated) {
      setStatus('Please connect to an org first');
      setStatusType('error');
      return;
    }

    setIsRefreshing(true);
    setStatus('Clearing cache...');
    setStatusType('');

    try {
      await clearDescribeCache();
      setStatus('Cache cleared successfully');
      setStatusType('success');

      setTimeout(() => {
        setStatus('');
        setStatusType('');
      }, 3000);
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
      setStatusType('error');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div>
      <p className={styles.description}>
        SObject definitions are cached locally for faster performance. Refresh if schema changes
        aren't appearing.
      </p>

      <div className={styles.cacheRow}>
        <button
          className="button-neutral"
          onClick={handleRefreshCache}
          disabled={isRefreshing}
        >
          Refresh SObject Definitions
        </button>
        {status && (
          <span className={`${styles.cacheStatus} ${statusType ? styles[statusType] : ''}`}>
            {status}
          </span>
        )}
      </div>
    </div>
  );
}
