# React - sftools App Shell

> **Parent context**: This extends [../../CLAUDE.md](../../CLAUDE.md)

## Overview

This directory contains the **React application shell** - the main App component, context providers wrapper, navigation components, and entry points for different pages. It serves as the orchestration layer between pages and components.

## Directory Structure

```
react/
├── App.tsx                    # Main tabbed interface component
├── App.module.css             # App-specific styles
├── AppProviders.tsx           # Context provider wrapper
├── TabNavigation.tsx          # Desktop tab navigation
├── TabNavigation.module.css   # Tab navigation styles
├── MobileMenu.tsx             # Mobile responsive menu
├── MobileMenu.module.css      # Mobile menu styles
├── ConnectionSelector.tsx     # Org dropdown in header
├── ConnectionSelector.module.css
├── AuthExpirationHandler.tsx  # Auth expiration modal handler
├── CorsErrorHandler.tsx       # CORS error detection/display
├── index.tsx                  # Main app entry point
├── record.tsx                 # Record Viewer entry point
└── schema.tsx                 # Schema Browser entry point
```

## Key Files

### App.tsx - Main Application

The primary application component with tabbed interface:

```typescript
function App() {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>('query');

  // Renders 6 tabs: Query, Apex, REST API, Events, Utils, Settings
  // All tabs are rendered but only active one is visible (for state preservation)
}
```

**Key Features:**
- Uses `AppProviders` wrapper for all context providers
- Dispatches `tab-changed` custom event on tab change
- Renders all tabs simultaneously, hides inactive ones
- Includes `AuthExpirationHandler` and `CorsErrorHandler` modals

### AppProviders.tsx - Context Wrapper

Wraps the entire app with all required context providers:

```typescript
export function AppProviders({ children }: { children: ReactNode }) {
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
```

**Provider Order:** ConnectionProvider (outermost) → ThemeProvider → ProxyProvider (innermost)

### Entry Points

#### index.tsx - Main App Entry

```typescript
// Initialize theme before rendering to prevent flash
initTheme();

// Run data migrations for upgrading users
Promise.all([
  migrateFromSingleConnection(),
  migrateCustomConnectedApp(),
  migrateDescribeCache(),
]).then(() => {
  const root = createRoot(document.getElementById('root')!);
  root.render(<App />);
});
```

#### record.tsx - Record Viewer Entry

```typescript
initTheme();

const root = createRoot(document.getElementById('root')!);
root.render(
  <AppProviders>
    <RecordPage />
  </AppProviders>
);
```

#### schema.tsx - Schema Browser Entry

```typescript
initTheme();

const root = createRoot(document.getElementById('root')!);
root.render(
  <AppProviders>
    <SchemaPage />
  </AppProviders>
);
```

## Navigation Components

### ConnectionSelector.tsx

Dropdown for switching between Salesforce orgs:

```typescript
export function ConnectionSelector() {
  const { connections, activeConnection, setActiveConnection } = useConnection();

  // Renders dropdown with org labels
  // Shows "No connection" when disconnected
}
```

### MobileMenu.tsx

Hamburger menu for mobile/narrow viewports:

```typescript
export function MobileMenu({ activeTab, onTabChange }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Renders hamburger button + slide-out menu
  // Shows all 6 tabs as menu items
}
```

### TabNavigation.tsx

Desktop tab bar (if used separately):

```typescript
export type TabId = 'query' | 'apex' | 'rest-api' | 'events' | 'utils' | 'settings';

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  // Renders horizontal tab buttons
}
```

## Error Handlers

### AuthExpirationHandler.tsx

Listens for auth expiration events and shows modal:

```typescript
export function AuthExpirationHandler() {
  const [expiredConnection, setExpiredConnection] = useState<string | null>(null);

  // Listens for 'auth-expired' event
  // Shows modal with reconnection options
}
```

### CorsErrorHandler.tsx

Detects and displays CORS errors with guidance:

```typescript
export function CorsErrorHandler() {
  const [showCorsError, setShowCorsError] = useState(false);

  // Detects CORS failures (status 0)
  // Shows modal suggesting proxy usage
}
```

## Adding a New Entry Point

### 1. Create Entry File

```typescript
// src/react/mypage.tsx
import { createRoot } from 'react-dom/client';
import { AppProviders } from './AppProviders';
import { MyPage } from '../components/mypage/MyPage';
import { initTheme } from '../lib/theme';

// Initialize theme first
initTheme();

// Mount React app
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <AppProviders>
      <MyPage />
    </AppProviders>
  );
}
```

### 2. Create HTML Shell

See `src/pages/CLAUDE.md` for HTML template.

### 3. Add to Vite Config

```typescript
// vite.config.ts
rollupOptions: {
  input: {
    // ...existing entries
    mypage: resolve(__dirname, 'src/pages/mypage/mypage.html'),
  }
}
```

## Tab Configuration

To add a new tab to the main app:

### 1. Create Tab Component

```typescript
// src/components/mytab/MyTab.tsx
export function MyTab() {
  // Tab implementation
}
```

### 2. Add to TabId Type

```typescript
// src/react/TabNavigation.tsx
export type TabId = 'query' | 'apex' | 'rest-api' | 'events' | 'utils' | 'settings' | 'mytab';
```

### 3. Import and Register in App.tsx

```typescript
import { MyTab } from '../components/mytab/MyTab';

const tabs: { id: TabId; component: ReactNode }[] = [
  // ...existing tabs
  { id: 'mytab', component: <MyTab /> },
];
```

### 4. Add to MobileMenu

Update the menu items array in `MobileMenu.tsx` to include the new tab.

## Patterns

### Theme Initialization

Always call `initTheme()` before rendering:

```typescript
// GOOD - theme initialized first
initTheme();
const root = createRoot(document.getElementById('root')!);
root.render(<App />);

// BAD - may cause theme flash
const root = createRoot(document.getElementById('root')!);
root.render(<App />);
```

### Provider Wrapping

All pages must use `AppProviders`:

```typescript
// GOOD
<AppProviders>
  <MyPage />
</AppProviders>

// BAD - contexts unavailable
<MyPage />
```

### Data Migrations

Run migrations before mounting (main app only):

```typescript
Promise.all([
  migrateFromSingleConnection(),
  migrateCustomConnectedApp(),
  migrateDescribeCache(),
]).then(() => {
  // Mount app after migrations
});
```

## Best Practices

### MUST Follow

1. **Always wrap with AppProviders** - All pages need context access
2. **Initialize theme first** - Call `initTheme()` before render
3. **Use CSS Modules** - All styles in `*.module.css` files
4. **Export TabId type** - Keep tab types in sync across components

### SHOULD Follow

1. **Keep App.tsx simple** - Complex logic belongs in components
2. **Use useCallback for handlers** - Memoize functions passed to children
3. **Render all tabs** - Hide inactive tabs rather than conditional rendering

### SHOULD NOT

1. **Don't add business logic here** - Keep in lib/ or component hooks
2. **Don't create new providers** - Add them to contexts/ directory
3. **Don't import components directly** - Use the component directory structure
