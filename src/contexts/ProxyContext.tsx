import {
    createContext,
    useContext,
    useReducer,
    useEffect,
    useCallback,
    useMemo,
    type ReactNode,
} from 'react';
import { setProxyConnected } from '../api/fetch';

interface ProxyContextType {
    isConnected: boolean;
    isConnecting: boolean;
    httpPort: number | null;
    version: string | null;
    error: string | null;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    checkStatus: () => Promise<void>;
}

const ProxyContext = createContext<ProxyContextType | null>(null);

interface ProxyProviderProps {
    children: ReactNode;
}

interface ProxyConnectResponse {
    success: boolean;
    httpPort?: number;
    version?: string;
    error?: string;
}

// Reducer state and actions for proxy connection
interface ProxyState {
    status: 'disconnected' | 'connecting' | 'connected';
    httpPort: number | null;
    version: string | null;
    error: string | null;
}

type ProxyAction =
    | { type: 'CONNECTING' }
    | { type: 'CONNECTED'; payload: { httpPort: number | null; version: string | null } }
    | { type: 'DISCONNECTED' }
    | { type: 'ERROR'; payload: string };

function proxyReducer(state: ProxyState, action: ProxyAction): ProxyState {
    switch (action.type) {
        case 'CONNECTING':
            return { ...state, status: 'connecting', error: null };
        case 'CONNECTED':
            return {
                status: 'connected',
                httpPort: action.payload.httpPort,
                version: action.payload.version,
                error: null,
            };
        case 'DISCONNECTED':
            return { status: 'disconnected', httpPort: null, version: null, error: null };
        case 'ERROR':
            return { ...state, status: 'disconnected', error: action.payload };
        default:
            return state;
    }
}

const initialState: ProxyState = {
    status: 'disconnected',
    httpPort: null,
    version: null,
    error: null,
};

export function ProxyProvider({ children }: ProxyProviderProps) {
    const [state, dispatch] = useReducer(proxyReducer, initialState);

    const checkStatus = useCallback(async () => {
        if (typeof chrome === 'undefined' || !chrome.runtime) {
            return;
        }

        try {
            const response = (await chrome.runtime.sendMessage({
                type: 'getProxyInfo',
            })) as { success: boolean; connected: boolean; httpPort?: number; version?: string };

            if (response.connected) {
                dispatch({
                    type: 'CONNECTED',
                    payload: {
                        httpPort: response.httpPort ?? null,
                        version: response.version ?? null,
                    },
                });
            } else {
                dispatch({ type: 'DISCONNECTED' });
            }
        } catch {
            dispatch({ type: 'DISCONNECTED' });
        }
    }, []);

    useEffect(() => {
        checkStatus();
    }, [checkStatus]);

    // Keep the fetch routing flag in sync with proxy connection state
    useEffect(() => {
        setProxyConnected(state.status === 'connected');
    }, [state.status]);

    const connect = useCallback(async () => {
        if (typeof chrome === 'undefined' || !chrome.runtime) {
            dispatch({ type: 'ERROR', payload: 'Chrome runtime not available' });
            return;
        }

        dispatch({ type: 'CONNECTING' });
        try {
            const response = (await chrome.runtime.sendMessage({
                type: 'connectProxy',
            })) as ProxyConnectResponse;
            if (response.success) {
                dispatch({
                    type: 'CONNECTED',
                    payload: {
                        httpPort: response.httpPort ?? null,
                        version: response.version ?? null,
                    },
                });
            } else {
                dispatch({ type: 'ERROR', payload: response.error || 'Failed to connect' });
            }
        } catch (err) {
            dispatch({
                type: 'ERROR',
                payload: err instanceof Error ? err.message : 'Connection failed',
            });
        }
    }, []);

    const disconnect = useCallback(async () => {
        if (typeof chrome === 'undefined' || !chrome.runtime) {
            dispatch({ type: 'ERROR', payload: 'Chrome runtime not available' });
            return;
        }

        try {
            await chrome.runtime.sendMessage({ type: 'disconnectProxy' });
            dispatch({ type: 'DISCONNECTED' });
        } catch (err) {
            dispatch({
                type: 'ERROR',
                payload: err instanceof Error ? err.message : 'Disconnect failed',
            });
        }
    }, []);

    // Memoize context value to prevent unnecessary re-renders
    const value = useMemo<ProxyContextType>(
        () => ({
            isConnected: state.status === 'connected',
            isConnecting: state.status === 'connecting',
            httpPort: state.httpPort,
            version: state.version,
            error: state.error,
            connect,
            disconnect,
            checkStatus,
        }),
        [state, connect, disconnect, checkStatus]
    );

    return <ProxyContext.Provider value={value}>{children}</ProxyContext.Provider>;
}

export function useProxy() {
    const context = useContext(ProxyContext);
    if (!context) {
        throw new Error('useProxy must be used within ProxyProvider');
    }
    return context;
}
