import { useCallback } from 'react';
import { useConnection } from '../../contexts/ConnectionContext.js';

/**
 * Schema Browser Link component.
 * Opens the Schema Browser in a new tab with the current connection.
 */
export function SchemaBrowserLink() {
  const { activeConnection } = useConnection();

  const handleOpenSchemaBrowser = useCallback(() => {
    if (!activeConnection) {
      alert('Please select a connection first');
      return;
    }

    const url = `/dist/pages/schema/schema.html?connectionId=${encodeURIComponent(activeConnection.id)}`;
    window.open(url, '_blank');
  }, [activeConnection]);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-header-icon" style={{ backgroundColor: '#0070d2' }}>
          S
        </div>
        <h2>Schema Browser</h2>
      </div>
      <div className="card-body">
        <p className="tool-description">
          Browse and explore Salesforce object schemas and field metadata.
        </p>
        <button className="button-brand" onClick={handleOpenSchemaBrowser}>
          Open Schema Browser
        </button>
      </div>
    </div>
  );
}
