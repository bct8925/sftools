# Components - sftools

> **Parent context**: This extends [../../CLAUDE.md](../../CLAUDE.md)

## Overview

All UI components are Web Components (Custom Elements) **without Shadow DOM**. This keeps CSS simple while providing JS encapsulation.

## Component Types

| Type | Pattern | Location | Example |
|------|---------|----------|---------|
| **Tab** | `*-tab.js` | `components/<name>/` | `query-tab.js` |
| **Standalone Page** | `*-page.js` | `components/<name>/` | `record-page.js` |
| **Utility Tool** | `*.js` | `components/utils-tools/` | `debug-logs.js` |
| **Reusable** | `*.js` | `components/<name>/` | `monaco-editor.js` |

## Directory Structure

```
components/
├── apex/                 # Apex tab
│   ├── apex-tab.js       # Component class
│   └── apex.html         # Template
├── button-dropdown/      # Reusable dropdown
│   └── button-dropdown.js
├── button-icon/          # Reusable icon button
│   └── button-icon.js
├── events/               # Events tab
│   ├── events-tab.js
│   └── events.html
├── modal-popup/          # Reusable modal
│   └── modal-popup.js
├── monaco-editor/        # Monaco wrapper
│   └── monaco-editor.js
├── query/                # Query tab
│   ├── query-tab.js
│   ├── query.html
│   └── query.css
├── record/               # Record Viewer (standalone)
│   ├── record-page.js
│   ├── record.html
│   └── record.css
├── rest-api/             # REST API tab
│   ├── rest-api-tab.js
│   └── rest-api.html
├── schema/               # Schema Browser (standalone)
│   ├── schema-page.js
│   ├── schema.html
│   └── schema.css
├── settings/             # Settings tab
│   ├── settings-tab.js
│   ├── settings.html
│   └── settings.css
├── utils/                # Utils tab container
│   ├── utils-tab.js
│   └── utils.html
└── utils-tools/          # Individual utilities
    ├── utils-tools.css   # Shared utility styles
    ├── debug-logs.js
    ├── debug-logs.html
    ├── flow-cleanup.js
    ├── flow-cleanup.html
    ├── schema-browser-link.js
    └── schema-browser-link.html
```

## Component Pattern

### Standard Component Template

```javascript
// src/components/example/example-tab.js
import template from './example.html?raw';
import './example.css';
import { salesforceRequest } from '../../lib/salesforce-request.js';
import { getAccessToken, isAuthenticated } from '../../lib/utils.js';

class ExampleTab extends HTMLElement {
    // State as class properties
    data = null;
    isLoading = false;

    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.attachEventListeners();
        this.loadData();
    }

    initElements() {
        this.button = this.querySelector('.example-button');
        this.results = this.querySelector('.example-results');
        this.status = this.querySelector('.example-status');
    }

    attachEventListeners() {
        // Button clicks
        this.button.addEventListener('click', () => this.handleClick());

        // Connection changes - REQUIRED for tab components
        document.addEventListener('connection-changed', () => this.handleConnectionChange());
    }

    async loadData() {
        if (!isAuthenticated()) return;

        this.setLoading(true);
        try {
            this.data = await salesforceRequest('/services/data/v62.0/endpoint');
            this.renderResults();
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.setLoading(false);
        }
    }

    handleConnectionChange() {
        // Clear state and reload for new org
        this.data = null;
        this.loadData();
    }

    setLoading(loading) {
        this.isLoading = loading;
        this.button.disabled = loading;
        this.status.textContent = loading ? 'Loading...' : '';
    }

    showError(message) {
        this.status.textContent = message;
        this.status.classList.add('error');
    }

    renderResults() {
        // Update DOM with this.data
    }
}

customElements.define('example-tab', ExampleTab);
```

### Template HTML

```html
<!-- src/components/example/example.html -->
<div class="card">
    <div class="card-header">
        <h3>Example</h3>
    </div>
    <div class="card-body">
        <div class="example-status"></div>
        <div class="example-results"></div>
        <button class="example-button button-brand">Execute</button>
    </div>
</div>
```

### Component CSS

```css
/* src/components/example/example.css */

/* Use compound selectors for specificity over global styles */
.card-body.example-card-body {
    padding: 0;
}

/* ALWAYS use CSS variables */
.example-results {
    background: var(--bg-secondary);
    color: var(--text-main);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
}

.example-results:hover {
    background: var(--bg-hover);
}

/* NEVER hard-code colors */
/* BAD: color: #333; */
/* GOOD: color: var(--text-main); */
```

## Monaco Editor Component

The `<monaco-editor>` wrapper provides a consistent editor experience:

### Usage

```html
<monaco-editor class="my-editor" language="sql"></monaco-editor>
<monaco-editor class="my-editor" language="apex" readonly></monaco-editor>
<monaco-editor class="my-editor" language="json"></monaco-editor>
```

### Attributes

| Attribute | Values | Description |
|-----------|--------|-------------|
| `language` | sql, apex, json, text | Editor language mode |
| `readonly` | (presence) | Makes editor read-only |

### Methods

```javascript
const editor = this.querySelector('.my-editor');

// Get/set content
editor.setValue('SELECT Id FROM Account');
const value = editor.getValue();

// Append content (scrolls to bottom)
editor.appendValue('\n// More content');

// Clear content
editor.clear();

// Error markers
editor.setMarkers([{
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: 1,
    endColumn: 10,
    message: 'Error message',
    severity: 8 // Error
}]);
editor.clearMarkers();
```

### Events

```javascript
// Ctrl/Cmd+Enter triggers execute event
editor.addEventListener('execute', () => {
    this.runQuery();
});
```

### Accessing Monaco Instance

```javascript
// For advanced use cases
editor.editor?.getModel().getLineCount();
editor.editor?.revealLine(10);
```

## Adding Components

### New Tab Component

1. **Create component folder**: `src/components/<name>/`

2. **Create files**:
   - `<name>-tab.js` - Component class
   - `<name>.html` - Template
   - `<name>.css` - Styles (optional)

3. **Import in app.js**:
   ```javascript
   // src/pages/app/app.js
   import '../../components/<name>/<name>-tab.js';
   ```

4. **Add to app.html**:
   ```html
   <!-- Tab button in nav -->
   <button class="tab-link" data-tab="<name>">Tab Name</button>

   <!-- Tab content in main -->
   <<name>-tab id="<name>" class="tab-content"></<name>-tab>
   ```

### New Standalone Page

1. **Create component folder**: `src/components/<name>/`

2. **Create component files**:
   - `<name>-page.js` - Component class
   - `<name>.html` - Template (body content only, no DOCTYPE)
   - `<name>.css` - Styles

3. **Create entry point**: `src/pages/<name>/`

   `<name>.html` (entry shell):
   ```html
   <!DOCTYPE html>
   <html lang="en">
   <head>
       <meta charset="UTF-8">
       <title>Tool Name - sftools</title>
       <link rel="stylesheet" href="../../style.css">
   </head>
   <body>
       <<name>-page></<name>-page>
       <script type="module" src="<name>.js"></script>
   </body>
   </html>
   ```

   `<name>.js` (entry script):
   ```javascript
   import { initTheme } from '../../lib/theme.js';
   import '../../components/<name>/<name>-page.js';

   initTheme();
   ```

4. **Add to vite.config.js**:
   ```javascript
   rollupOptions: {
       input: {
           // ...existing entries
           <name>: resolve(__dirname, 'src/pages/<name>/<name>.html'),
       }
   }
   ```

### New Utility Tool

1. **Create files in utils-tools/**:
   - `<name>.js` - Component class
   - `<name>.html` - Template (card structure)

2. **Import in utils-tab.js**:
   ```javascript
   import '../utils-tools/<name>.js';
   ```

3. **Add to utils.html**:
   ```html
   <<name>></<name>>
   ```

## Required Patterns

### Connection Change Handling

**MUST** listen for connection changes in all tab components:

```javascript
connectedCallback() {
    document.addEventListener('connection-changed', (e) => {
        this.handleConnectionChange(e.detail);
    });
}

handleConnectionChange(connection) {
    // Clear current state
    this.data = null;
    this.results.innerHTML = '';

    // Reload for new org
    if (connection) {
        this.loadData();
    }
}
```

### Theme Initialization

**MUST** initialize theme in all standalone page entry points:

```javascript
// src/pages/<name>/<name>.js
import { initTheme } from '../../lib/theme.js';
import '../../components/<name>/<name>-page.js';

initTheme(); // Call before page renders
```

### CSS Variable Usage

**MUST** use CSS variables for all visual properties:

```css
/* CORRECT */
.my-component {
    background: var(--card-bg);
    color: var(--text-main);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: 0 2px 4px var(--shadow-sm);
}

/* INCORRECT - hard-coded values */
.my-component {
    background: #ffffff;
    color: #333333;
    border: 1px solid #dddddd;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
```

## Common Patterns

### Loading States

```javascript
setLoading(loading) {
    this.isLoading = loading;
    this.button.disabled = loading;
    this.button.textContent = loading ? 'Loading...' : 'Execute';

    // Use status indicator classes
    this.statusIndicator.classList.toggle('status-loading', loading);
}
```

### Error Handling

```javascript
showError(message) {
    this.errorContainer.textContent = message;
    this.errorContainer.style.display = 'block';
    this.statusIndicator.classList.add('status-error');
}

clearError() {
    this.errorContainer.textContent = '';
    this.errorContainer.style.display = 'none';
    this.statusIndicator.classList.remove('status-error');
}
```

### API Calls

```javascript
import { salesforceRequest } from '../../lib/salesforce-request.js';

async fetchData() {
    try {
        const result = await salesforceRequest('/services/data/v62.0/query', {
            method: 'GET',
            params: { q: 'SELECT Id FROM Account' }
        });
        return result;
    } catch (error) {
        // Error already parsed by salesforceRequest
        this.showError(error.message);
        throw error;
    }
}
```

### Cleanup on Disconnect

```javascript
disconnectedCallback() {
    // Remove event listeners if needed
    document.removeEventListener('connection-changed', this.boundHandler);

    // Clear intervals/timeouts
    if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
    }
}
```

## CSS Specificity

When component CSS needs to override global styles, use compound selectors:

```css
/* In query.css - overrides .card-body from style.css */
.card-body.query-card-body {
    padding: 0;
}

/* Compound selector has higher specificity */
.button-brand.query-execute {
    width: 100%;
}
```

## Shared CSS Classes

Use these from `style.css` before creating new ones:

| Pattern | Classes |
|---------|---------|
| Cards | `.card`, `.card-header`, `.card-body` |
| Buttons | `.button-brand`, `.button-neutral` |
| Inputs | `.input`, `.select`, `.search-input` |
| Modal | `.modal-overlay`, `.modal-dialog`, `.modal-buttons` |
| Dropdown | `.dropdown-menu`, `.dropdown-item` |
| Status | `.status-indicator.status-loading/success/error` |
| List | `.script-list`, `.script-item` |

## Examples

### Query Tab

See `query/query-tab.js` for:
- Monaco editor integration
- Tabbed results display
- History/favorites dropdown
- Column metadata parsing

### Record Page

See `record/record-page.js` for:
- Standalone page pattern
- URL parameter parsing
- Field editing with dirty tracking
- Save/refresh functionality

### Debug Logs Tool

See `utils-tools/debug-logs.js` for:
- Utility tool pattern
- User search
- Status indicators
- Tooling API usage
