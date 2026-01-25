# Pages - sftools Entry Points

> **Parent context**: This extends [../../CLAUDE.md](../../CLAUDE.md)

## Overview

This directory contains **HTML entry points** and their corresponding TypeScript loaders for each page in the extension. Each page is a separate HTML file that loads a React application or handles a specific flow.

## Directory Structure

```
pages/
├── app/                    # Main tabbed application
│   ├── app.html           # HTML shell
│   └── app.ts             # Entry point (re-exports index.tsx)
│
├── callback/              # OAuth callback handler
│   ├── callback.html      # HTML shell
│   └── callback.ts        # OAuth flow handler (no React)
│
├── record/                # Record Viewer standalone page
│   ├── record.html        # HTML shell
│   └── record.ts          # Entry point (re-exports record.tsx)
│
└── schema/                # Schema Browser standalone page
    ├── schema.html        # HTML shell
    └── schema.ts          # Entry point (re-exports schema.tsx)
```

## Page Types

### React Pages (app, record, schema)

These pages render React applications:

**Pattern:**
```
HTML shell → TS entry → React entry → AppProviders → Component
```

**Example: app/**
```html
<!-- app.html -->
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>sftools</title>
    <link rel="icon" type="image/png" href="../../icon.png" />
    <link rel="stylesheet" href="../../style.css" />
</head>
<body>
    <div id="root"></div>
    <script type="module" src="app.ts"></script>
</body>
</html>
```

```typescript
// app.ts
import '../../react/index';  // Re-export to React entry
```

### Non-React Pages (callback)

The OAuth callback page handles token flows without React:

```typescript
// callback.ts - Direct DOM manipulation, no React
const statusEl = document.getElementById('status')!;

// Handle OAuth responses
if (authCode) {
  handleCodeFlow(authCode, state);
} else if (hashAccessToken) {
  handleImplicitFlow(hashAccessToken, instanceUrl, state);
}
```

## Page Descriptions

### app/

The main extension interface with tabbed navigation.

- **URL**: `chrome-extension://<id>/dist/pages/app/app.html`
- **Usage**: Side panel, popup, or standalone tab
- **Features**: Query, Apex, REST API, Events, Utils, Settings tabs

### callback/

OAuth callback handler for both authorization code and implicit flows.

- **URL**: `https://sftools.dev/sftools-callback` (redirects here)
- **Query params**: `code`, `state`, `error`, `error_description`
- **Hash params**: `access_token`, `instance_url`, `state`
- **Features**:
  - Validates OAuth state parameter (CSRF protection)
  - Handles code flow via service worker token exchange
  - Handles implicit flow with direct token storage
  - Updates existing connections or creates new ones

### record/

Standalone record viewer/editor.

- **URL**: `chrome-extension://<id>/dist/pages/record/record.html`
- **Query params**: `objectType`, `recordId`, `connectionId`
- **Features**: View/edit any record by ID, field-level editing

### schema/

Standalone schema browser.

- **URL**: `chrome-extension://<id>/dist/pages/schema/schema.html`
- **Query params**: `object`, `connectionId`
- **Features**: Browse objects, view field details, formula editor

## HTML Template

All HTML shells follow this pattern:

```html
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>[Page Title] - sftools</title>
    <link rel="icon" type="image/png" href="../../icon.png" />
    <link rel="stylesheet" href="../../style.css" />
</head>
<body>
    <div id="root"></div>
    <script type="module" src="[page].ts"></script>
</body>
</html>
```

**Key Elements:**
- `<link rel="stylesheet" href="../../style.css" />` - Global styles
- `<div id="root"></div>` - React mount point
- `<script type="module">` - ES module entry point

## Adding a New Page

### 1. Create Directory Structure

```bash
mkdir src/pages/mypage
```

### 2. Create HTML Shell

```html
<!-- src/pages/mypage/mypage.html -->
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Page - sftools</title>
    <link rel="icon" type="image/png" href="../../icon.png" />
    <link rel="stylesheet" href="../../style.css" />
</head>
<body>
    <div id="root"></div>
    <script type="module" src="mypage.ts"></script>
</body>
</html>
```

### 3. Create TypeScript Entry

For React pages:
```typescript
// src/pages/mypage/mypage.ts
import '../../react/mypage';
```

For non-React pages:
```typescript
// src/pages/mypage/mypage.ts
// Direct DOM manipulation here
const root = document.getElementById('root')!;
// ... page logic
```

### 4. Create React Entry (if React page)

```typescript
// src/react/mypage.tsx
import { createRoot } from 'react-dom/client';
import { AppProviders } from './AppProviders';
import { MyPage } from '../components/mypage/MyPage';
import { initTheme } from '../lib/theme';

initTheme();

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

### 5. Add to Vite Config

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        app: resolve(__dirname, 'src/pages/app/app.html'),
        callback: resolve(__dirname, 'src/pages/callback/callback.html'),
        record: resolve(__dirname, 'src/pages/record/record.html'),
        schema: resolve(__dirname, 'src/pages/schema/schema.html'),
        mypage: resolve(__dirname, 'src/pages/mypage/mypage.html'),  // Add here
      },
    },
  },
});
```

### 6. Add to Manifest (if needed)

```json
// manifest.json
{
  "web_accessible_resources": [{
    "resources": [
      "dist/pages/app/app.html",
      "dist/pages/record/record.html",
      "dist/pages/schema/schema.html",
      "dist/pages/mypage/mypage.html"
    ],
    "matches": ["<all_urls>"]
  }]
}
```

## URL Parameters

### Passing Parameters

```typescript
// Opening a page with parameters
const url = chrome.runtime.getURL('dist/pages/record/record.html');
const params = new URLSearchParams({
  objectType: 'Account',
  recordId: '001xx000003DGbY',
  connectionId: activeConnection.id,
});
chrome.tabs.create({ url: `${url}?${params}` });
```

### Reading Parameters

```typescript
// In page code
const params = new URLSearchParams(window.location.search);
const objectType = params.get('objectType');
const recordId = params.get('recordId');
const connectionId = params.get('connectionId');
```

## OAuth Callback Flow

The callback page handles two OAuth flows:

### Authorization Code Flow (with proxy)

```
1. User clicks "Authorize"
2. Opens Salesforce login page with response_type=code
3. User logs in, grants access
4. Salesforce redirects to callback with ?code=xxx&state=yyy
5. callback.ts validates state, sends tokenExchange to service worker
6. Service worker exchanges code for tokens via proxy
7. callback.ts stores connection and closes tab
```

### Implicit Flow (without proxy)

```
1. User clicks "Authorize"
2. Opens Salesforce login page with response_type=token
3. User logs in, grants access
4. Salesforce redirects to callback with #access_token=xxx&instance_url=yyy
5. callback.ts validates state, stores tokens directly
6. Closes tab
```

## Best Practices

### MUST Follow

1. **Always include global styles** - Link to `../../style.css`
2. **Use module scripts** - `<script type="module">`
3. **Initialize theme first** - Call `initTheme()` before rendering
4. **Validate OAuth state** - CSRF protection is required

### SHOULD Follow

1. **Keep HTML minimal** - Logic belongs in TypeScript
2. **Use re-exports for React** - Page TS just imports React entry
3. **Include viewport meta** - For responsive design
4. **Add to Vite config** - Required for build to include page

### SHOULD NOT

1. **Don't add inline styles** - Use CSS files
2. **Don't add inline scripts** - Use TypeScript files
3. **Don't skip state validation** - Security requirement for OAuth
