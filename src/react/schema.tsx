import { createRoot } from 'react-dom/client';
import { AppProviders } from './AppProviders';
import { SchemaPage } from '../components/schema/SchemaPage';
import { initTheme } from '../lib/theme';

// Initialize theme before rendering to prevent flash
initTheme();

/**
 * Schema page entry point - wraps SchemaPage with providers.
 */
function SchemaApp() {
  return (
    <AppProviders>
      <SchemaPage />
    </AppProviders>
  );
}

// Mount the React app
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<SchemaApp />);
}
