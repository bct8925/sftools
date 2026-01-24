import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { SalesforceConnection } from '../types/salesforce';
import {
  loadConnections,
  setActiveConnection as setActiveConn,
  addConnection as addConn,
  updateConnection as updateConn,
  removeConnection as removeConn,
  getActiveConnectionId,
  isAuthenticated as checkAuth,
  type ConnectionData,
} from '../lib/auth.js';

interface ConnectionContextType {
  connections: SalesforceConnection[];
  activeConnection: SalesforceConnection | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setActiveConnection: (conn: SalesforceConnection | null) => Promise<void>;
  addConnection: (data: ConnectionData) => Promise<SalesforceConnection>;
  updateConnection: (id: string, updates: Partial<SalesforceConnection>) => Promise<void>;
  removeConnection: (id: string) => Promise<void>;
  refreshConnections: () => Promise<void>;
}

const ConnectionContext = createContext<ConnectionContextType | null>(null);

interface ConnectionProviderProps {
  children: ReactNode;
}

export function ConnectionProvider({ children }: ConnectionProviderProps) {
  const [connections, setConnections] = useState<SalesforceConnection[]>([]);
  const [activeConnection, setActiveConnectionState] = useState<SalesforceConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Refresh connections from storage and sync active connection state
  const refreshConnections = useCallback(async () => {
    const conns = await loadConnections();
    setConnections(conns);

    // Sync active connection with current module state
    const activeId = getActiveConnectionId();
    const active = conns.find((c) => c.id === activeId) || null;
    setActiveConnectionState(active);
  }, []);

  // Initial load - auto-select most recently used connection if none is active
  useEffect(() => {
    const initializeConnections = async () => {
      const conns = await loadConnections();
      setConnections(conns);

      const activeId = getActiveConnectionId();
      let active = conns.find((c) => c.id === activeId) || null;

      // On initial load, auto-select most recently used connection if none is active
      if (!active && conns.length > 0) {
        // Sort by lastUsedAt descending, fall back to first if no timestamps
        const sorted = [...conns].sort((a, b) => {
          const aTime = a.lastUsedAt ?? 0;
          const bTime = b.lastUsedAt ?? 0;
          return bTime - aTime;
        });
        active = sorted[0];
        setActiveConn(active); // Set module-level auth state
      }

      setActiveConnectionState(active);
      setIsLoading(false);
    };

    initializeConnections();

    // Listen for storage changes from other tabs
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area === 'local' && changes.connections) {
        refreshConnections();
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }
  }, [refreshConnections]);

  const setActiveConnection = useCallback(async (conn: SalesforceConnection | null) => {
    setActiveConn(conn);
    setActiveConnectionState(conn);
    // Update lastUsedAt timestamp when switching connections
    if (conn) {
      await updateConn(conn.id, {});
    }
  }, []);

  const addConnection = useCallback(
    async (data: ConnectionData) => {
      const newConn = await addConn(data);
      await refreshConnections();
      return newConn;
    },
    [refreshConnections]
  );

  const updateConnection = useCallback(
    async (id: string, updates: Partial<SalesforceConnection>) => {
      await updateConn(id, updates);
      await refreshConnections();
    },
    [refreshConnections]
  );

  const removeConnection = useCallback(
    async (id: string) => {
      await removeConn(id);
      await refreshConnections();
    },
    [refreshConnections]
  );

  return (
    <ConnectionContext.Provider
      value={{
        connections,
        activeConnection,
        isAuthenticated: checkAuth(),
        isLoading,
        setActiveConnection,
        addConnection,
        updateConnection,
        removeConnection,
        refreshConnections,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnection must be used within ConnectionProvider');
  }
  return context;
}
