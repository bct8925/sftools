# React - sftools App Shell

> **Parent context**: This extends [../../CLAUDE.md](../../CLAUDE.md)

## Overview

This directory contains the **React application shell** - the main App component with home screen navigation, context providers wrapper, connection selector, and entry points for different pages. It serves as the orchestration layer between pages and components.

## Directory Structure

```
react/
├── App.tsx                    # Main app with home/feature view state
├── App.module.css             # App-specific styles
├── AppProviders.tsx           # Context provider wrapper
├── HomeScreen.tsx             # Tile-based feature navigation
├── HomeScreen.module.css      # Home screen styles
├── TabNavigation.tsx          # Feature/tab type definitions and data
├── ConnectionSelector.tsx     # Org dropdown selector in header
├── ConnectionSelector.module.css
├── AuthExpirationHandler.tsx  # Auth expiration modal handler
├── CorsErrorHandler.tsx       # CORS error detection/display
├── index.tsx                  # Main app entry point
└── record.tsx                 # Record Viewer entry point
```

## Key Files

### App.tsx - Main Application

The primary application component with home screen and feature views:

```typescript
type ViewState = { view: 'home' } | { view: 'feature'; featureId: TabId };

function AppContent() {
  const [viewState, setViewState] = useState<ViewState>(getInitialViewState);

  // Home view: shows tile grid (HomeScreen)
  // Feature view: shows the selected tab content
  // All tabs are rendered but only active one is visible (for state preservation)
}
```

**Key Features:**
- Uses `ViewState` to switch between home screen and feature views
- Reads `?feature=<id>` URL parameter for direct feature navigation
- Waffle button (apps icon) in header navigates back to home
- Brand text is clickable in feature view to return home
- All tabs rendered simultaneously, only active visible (state preservation)
- Includes `AuthExpirationHandler` and `CorsErrorHandler` modals
- Lazy loads tab components with `React.lazy()`

**Tab Registry:**
```typescript
const TAB_COMPONENTS: Record<TabId, ComponentType> = {
    query: QueryTab,
    apex: ApexTab,
    logs: DebugLogsTab,
    'rest-api': RestApiTab,
    events: EventsTab,
    schema: SchemaTab,
    utils: UtilsTab,
    settings: SettingsTab,
};
```

### HomeScreen.tsx - Tile Navigation

Renders a grid of feature tiles for navigating to each feature:

```typescript
interface HomeScreenProps {
    onFeatureSelect: (featureId: FeatureId) => void;
    onSettingsClick: () => void;
}

export function HomeScreen({ onFeatureSelect, onSettingsClick }: HomeScreenProps) {
    // Renders FEATURES array as clickable tiles
    // Tiles show icon + label with color-coded backgrounds
    // Cmd/Ctrl+click opens feature in a new browser tab
    // Disables tiles requiring auth/proxy when unavailable
}
```

**Key Features:**
- Uses `FEATURES` array from `TabNavigation.tsx` for tile data
- Each tile has a colored icon container and label
- Auth-required tiles disabled when not authenticated
- Proxy-required tiles disabled when proxy not connected
- Settings button rendered separately at bottom

### TabNavigation.tsx - Type Definitions & Data

Exports feature/tab type definitions and the `FEATURES` data array. **Not a component** — purely data and types:

```typescript
export type FeatureId = 'query' | 'apex' | 'logs' | 'rest-api' | 'events' | 'schema' | 'utils';
export type TabId = FeatureId | 'settings';

export interface Feature {
    id: FeatureId;
    label: string;
    requiresAuth: boolean;
    requiresProxy: boolean;
    tileIcon: IconName;
    tileColor: string;
}

export const FEATURES: Feature[] = [
    { id: 'query', label: 'Query', requiresAuth: true, requiresProxy: false, tileIcon: 'tileQuery', tileColor: 'var(--icon-query)' },
    { id: 'schema', label: 'Schema', requiresAuth: true, requiresProxy: false, tileIcon: 'tileSchema', tileColor: 'var(--icon-schema)' },
    // ... other features
];
```

### ConnectionSelector.tsx - Org Dropdown

Dropdown selector for switching between Salesforce org connections:

```typescript
export function ConnectionSelector() {
    const { connections, activeConnection, setActiveConnection } = useConnection();
    const [isOpen, setIsOpen] = useState(false);

    // Shows active connection label with Salesforce icon
    // Chevron indicator when multiple connections available
    // Dropdown list with all connections, active one highlighted
    // Closes on click outside or Escape key
}
```

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

To add a new feature tab to the main app:

### 1. Create Tab Component

```typescript
// src/components/mytab/MyTab.tsx
export function MyTab() {
  // Tab implementation
}
```

### 2. Add to Feature Types and Data

```typescript
// src/react/TabNavigation.tsx

// Add to FeatureId type
export type FeatureId = 'query' | 'apex' | 'logs' | 'rest-api' | 'events' | 'schema' | 'utils' | 'mytab';

// Add to FEATURES array
export const FEATURES: Feature[] = [
  // ...existing features
  {
    id: 'mytab',
    label: 'My Tab',
    requiresAuth: true,
    requiresProxy: false,
    tileIcon: 'tileMyTab',
    tileColor: 'var(--icon-mytab)',
  },
];
```

### 3. Import and Register in App.tsx

```typescript
// Lazy load the component
const MyTab = lazy(() =>
    import('../components/mytab/MyTab').then(m => ({ default: m.MyTab }))
);

// Add to TAB_COMPONENTS registry
const TAB_COMPONENTS: Record<TabId, ComponentType> = {
    // ...existing tabs
    mytab: MyTab,
};

// Add to TAB_IDS array
const TAB_IDS: TabId[] = [..., 'mytab', ...];
```

### 4. Add Tile Icon

Add the tile icon SVG to `src/lib/icons.ts` and its color CSS variable to `src/style.css`.

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

### URL-Based Feature Navigation

Features can be opened directly via URL parameter:

```typescript
// Open feature in new tab
const url = chrome.runtime.getURL(`dist/pages/app/app.html?feature=${featureId}`);
chrome.tabs.create({ url });
```

## Best Practices

### MUST Follow

1. **Always wrap with AppProviders** - All pages need context access
2. **Initialize theme first** - Call `initTheme()` before render
3. **Use CSS Modules** - All styles in `*.module.css` files
4. **Use TabNavigation types** - Keep `FeatureId`/`TabId` types in sync

### SHOULD Follow

1. **Keep App.tsx simple** - Complex logic belongs in components
2. **Use useCallback for handlers** - Memoize functions passed to children
3. **Render all tabs** - Hide inactive tabs rather than conditional rendering
4. **Lazy load tab components** - Use `React.lazy()` for code splitting

### SHOULD NOT

1. **Don't add business logic here** - Keep in lib/ or component hooks
2. **Don't create new providers** - Add them to contexts/ directory
3. **Don't import components directly** - Use the component directory structure
