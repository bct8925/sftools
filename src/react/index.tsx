import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initTheme } from '../lib/theme';
import {
  migrateFromSingleConnection,
  migrateCustomConnectedApp,
} from '../lib/auth';
import { migrateDescribeCache } from '../lib/salesforce';

// Initialize theme before rendering to prevent flash
initTheme();

// Run data migrations for users upgrading from older versions
// These are idempotent and safe to run on every load
Promise.all([
  migrateFromSingleConnection(),
  migrateCustomConnectedApp(),
  migrateDescribeCache(),
]).then(() => {
  // Mount the React app after migrations complete
  const rootElement = document.getElementById('root');
  if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<App />);
  }
});
