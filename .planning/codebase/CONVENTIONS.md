# Coding Conventions

**Analysis Date:** 2026-01-15

## Naming Patterns

**Files:**
- `kebab-case.js` for all JavaScript files: `query-tab.js`, `salesforce-request.js`
- `{name}-tab.js` for tab components: `query-tab.js`, `apex-tab.js`
- `{name}-page.js` for page components: `record-page.js`, `schema-page.js`
- Co-located assets: `{name}.js`, `{name}.html`, `{name}.css`

**Functions:**
- camelCase for all functions
- `get*` for retrieval: `getDescribeCache()`, `getAccessToken()`
- `set*` for assignment: `setDescribeCache()`, `setActiveConnection()`
- `execute*` for operations: `executeQuery()`, `executeApex()`
- `handle*` for event handlers: `handleConnectionChange()`, `handleClick()`
- `is*`, `has*`, `can*` for booleans: `isAuthenticated()`, `isProxyConnected()`

**Variables:**
- camelCase for variables: `activeTabId`, `queryTabs`
- UPPER_SNAKE_CASE for constants: `API_VERSION`, `STORAGE_KEYS`
- Descriptive names: `boundConnectionHandler`, `bulkExportInProgress`

**Types:**
- PascalCase for classes: `QueryTab`, `RecordPage`, `HistoryManager`
- No I prefix for interfaces (not using TypeScript)

## Code Style

**Formatting:**
- 4-space indentation
- Single quotes for strings
- Semicolons required
- No external formatter (Prettier not configured)

**Linting:**
- No ESLint configuration
- Manual code review for consistency

## Import Organization

**Order:**
1. External packages (if any)
2. Template imports (`import template from './name.html?raw'`)
3. CSS imports (`import './name.css'`)
4. Internal lib modules (`import { ... } from '../../lib/utils.js'`)
5. Component imports (`import '../monaco-editor/monaco-editor.js'`)

**Example from `src/components/query/query-tab.js`:**
```javascript
import template from './query.html?raw';
import './query.css';
import { isAuthenticated, getActiveConnectionId } from '../../lib/utils.js';
import '../monaco-editor/monaco-editor.js';
import { executeQueryWithColumns } from '../../lib/salesforce.js';
```

**Path Aliases:**
- None configured (relative paths used)

## Error Handling

**Patterns:**
- Try/catch at async operation boundaries
- Error messages shown in UI status elements
- console.error for debugging

**Example:**
```javascript
async executeQuery() {
    try {
        const results = await executeQueryWithColumns(soql);
        this.displayResults(results);
    } catch (error) {
        this.showError(error.message);
    }
}
```

**Error Types:**
- Throw Error with descriptive message
- 401 handled specially: trigger auth expiration flow

## Logging

**Framework:**
- Console logging (console.log, console.error)
- No external logging library

**Patterns:**
- Debug info: `console.log('Loaded auth for instance:', instanceUrl)`
- Errors: `console.error('Failed to fetch:', error)`
- Proxy: File logging to `/tmp/sftools-proxy.log`

## Comments

**When to Comment:**
- JSDoc for exported functions with complex signatures
- Section headers for logical grouping
- Inline comments for non-obvious business logic

**JSDoc Example:**
```javascript
/**
 * Escape single quotes for SOQL queries
 * @param {string} str - String to escape
 * @returns {string} - Escaped string safe for SOQL
 */
function escapeSoql(str) {
    return str.replace(/'/g, "\\'");
}
```

**Section Headers:**
```javascript
// ============================================================
// Describe Cache
// ============================================================
```

**TODO Comments:**
- Format: `// TODO: description`
- No tracking system (use git blame for attribution)

## Function Design

**Size:**
- No strict limit enforced
- Large components exist (query-tab.js: 1309 lines)

**Parameters:**
- Use object destructuring for multiple options
- Required params first, optional with defaults

**Return Values:**
- Async functions return promises
- Return meaningful values or throw errors

## Module Design

**Exports:**
- Named exports preferred: `export async function getDescribeCache()`
- No default exports
- Central re-export in `utils.js` for common imports

**Custom Elements:**
- Pattern: Class extends HTMLElement
- Registration: `customElements.define('element-name', ClassName)`
- Methods: `connectedCallback()`, `disconnectedCallback()`, `initElements()`, `attachEventListeners()`

**Template:**
```javascript
import template from './name.html?raw';
import './name.css';

class ComponentName extends HTMLElement {
    // State properties
    element = null;

    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.attachEventListeners();
    }

    disconnectedCallback() {
        // Cleanup listeners
    }

    initElements() {
        this.element = this.querySelector('.element-class');
    }

    attachEventListeners() {
        this.element.addEventListener('click', () => this.handleClick());
    }
}

customElements.define('component-name', ComponentName);
```

## DOM & CSS Conventions

**CSS Class Naming:**
- Component prefix: `.query-editor`, `.settings-proxy-toggle`
- kebab-case: `.card-header`, `.button-brand`
- State classes: `.active`, `.loading`, `.error`

**CSS Variables:**
- Defined in `:root` in `src/style.css`
- Example: `--primary-color`, `--text-main`, `--bg-color`

**CSS Specificity:**
- Compound selectors for overrides: `.card-body.query-card-body`

---

*Convention analysis: 2026-01-15*
*Update when patterns change*
