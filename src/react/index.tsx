import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initTheme } from '../lib/theme';

// Initialize theme before rendering to prevent flash
initTheme();

// Mount the React app
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}
