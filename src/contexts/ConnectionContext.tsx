import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
    type ReactNode,
} from 'react';
import type { SalesforceConnection } from '../types/salesforce';
import { salesforceRequest } from '../api/salesforce-request';
import { API_VERSION } from '../api/constants';
import {
    loadConnections,
    setActiveConnection as setActiveConn,
    addConnection as addConn,
    updateConnection as updateConn,
    removeConnection as removeConn,
    getActiveConnectionId,
    isAuthenticated as checkAuth,
    type ConnectionData,
} from '../auth/auth';
import { storage } from '../platform';

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

/**
 * Choose the connection a new sftools page starts on:
 * the sf CLI default org when there is one (VS Code), otherwise the most recently used.
 */
export function pickInitialConnection(
    connections: SalesforceConnection[]
): SalesforceConnection | null {
    if (connections.length === 0) return null;
    const defaultConnection = connections.find(c => c.isDefault);
    if (defaultConnection) return defaultConnection;
    return [...connections].sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))[0];
}

interface ConnectionProviderProps {
    children: ReactNode;
}

export function ConnectionProvider({ children }: ConnectionProviderProps) {
    const [connections, setConnections] = useState<SalesforceConnection[]>([]);
    const [activeConnection, setActiveConnectionState] = useState<SalesforceConnection | null>(
        null
    );
    const [isLoading, setIsLoading] = useState(true);

    // Refresh connections from storage and sync active connection state
    const refreshConnections = useCallback(async () => {
        const conns = await loadConnections();
        setConnections(conns);

        // Sync active connection with current module state
        const activeId = getActiveConnectionId();
        let active = conns.find(c => c.id === activeId) || null;

        // Auto-select the default org (sf CLI) or the most recently used connection
        if (!active && conns.length > 0) {
            active = pickInitialConnection(conns);
            setActiveConn(active);
        }

        setActiveConnectionState(active);
    }, []);

    // Initial load
    useEffect(() => {
        refreshConnections().then(() => {
            setIsLoading(false);

            // Validate session on panel open — triggers reauth modal on 401
            if (checkAuth()) {
                salesforceRequest(`/services/data/v${API_VERSION}/`).catch(() => {});
            }
        });

        // Listen for storage changes from other tabs (or the sf CLI org list in VS Code)
        return storage.onChanged(changes => {
            if (changes.connections) {
                refreshConnections();
            }
        });
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

    // Memoize context value to prevent unnecessary re-renders
    const value = useMemo<ConnectionContextType>(
        () => ({
            connections,
            activeConnection,
            isAuthenticated: checkAuth(),
            isLoading,
            setActiveConnection,
            addConnection,
            updateConnection,
            removeConnection,
            refreshConnections,
        }),
        [
            connections,
            activeConnection,
            isLoading,
            setActiveConnection,
            addConnection,
            updateConnection,
            removeConnection,
            refreshConnections,
        ]
    );

    return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

export function useConnection() {
    const context = useContext(ConnectionContext);
    if (!context) {
        throw new Error('useConnection must be used within ConnectionProvider');
    }
    return context;
}
