import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';

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

export function ProxyProvider({ children }: ProxyProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [httpPort, setHttpPort] = useState<number | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      return;
    }

    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'getProxyInfo',
      })) as { success: boolean; connected: boolean; httpPort?: number; version?: string };

      setIsConnected(response.connected);
      setHttpPort(response.httpPort ?? null);
      setVersion(response.version ?? null);
    } catch {
      setIsConnected(false);
      setHttpPort(null);
      setVersion(null);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const connect = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      setError('Chrome runtime not available');
      return;
    }

    setIsConnecting(true);
    setError(null);
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'connectProxy',
      })) as ProxyConnectResponse;
      if (response.success) {
        setIsConnected(true);
        setHttpPort(response.httpPort || null);
        setVersion(response.version || null);
      } else {
        setError(response.error || 'Failed to connect');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      setError('Chrome runtime not available');
      return;
    }

    try {
      await chrome.runtime.sendMessage({ type: 'disconnectProxy' });
      setIsConnected(false);
      setHttpPort(null);
      setVersion(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed');
    }
  }, []);

  return (
    <ProxyContext.Provider
      value={{
        isConnected,
        isConnecting,
        httpPort,
        version,
        error,
        connect,
        disconnect,
        checkStatus,
      }}
    >
      {children}
    </ProxyContext.Provider>
  );
}

export function useProxy() {
  const context = useContext(ProxyContext);
  if (!context) {
    throw new Error('useProxy must be used within ProxyProvider');
  }
  return context;
}
