import type { ReactNode } from 'react';
import { ConnectionProvider } from '../contexts/ConnectionContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ProxyProvider } from '../contexts/ProxyContext';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Wrapper component that provides all app-level contexts.
 * Order matters: ConnectionProvider is outermost as other contexts may depend on it.
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ConnectionProvider>
      <ThemeProvider>
        <ProxyProvider>
          {children}
        </ProxyProvider>
      </ThemeProvider>
    </ConnectionProvider>
  );
}
