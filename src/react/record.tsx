import { createRoot } from 'react-dom/client';
import { AppProviders } from './AppProviders';
import { RecordPage } from '../components/record/RecordPage';
import { initTheme } from '../lib/theme';

// Initialize theme before rendering to prevent flash
initTheme();

/**
 * Record page entry point - wraps RecordPage with providers.
 */
function RecordApp() {
  return (
    <AppProviders>
      <RecordPage />
    </AppProviders>
  );
}

// Mount the React app
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<RecordApp />);
}
