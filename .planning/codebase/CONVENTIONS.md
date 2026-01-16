# Coding Conventions

**Analysis Date:** 2026-01-15

## Naming Patterns

**Files:**
- kebab-case for all files: `query-tab.js`, `salesforce-request.js`, `text-utils.js`
- Component files paired with template: `query-tab.js` + `query.html` + `query.css`
- Entry points match directory: `app/app.js`, `record/record.js`

**Functions:**
- camelCase for all functions: `getAccessToken()`, `executeQuery()`, `handleConnectionChange()`
- Async functions: No special prefix (async/await used throughout)
- Event handlers: `handle*` prefix: `handleClick()`, `handleSubmit()`, `handleConnectionChange()`

**Variables:**
- camelCase for variables: `accessToken`, `instanceUrl`, `queryTabs`
- Constants: UPPER_SNAKE_CASE: `API_VERSION`, `STORAGE_KEYS`, `CALLBACK_URL`
- Private state: Module-level variables (no underscore prefix)

**Types:**
- Not applicable (JavaScript codebase, no TypeScript)

## Code Style

**Formatting:**
- 4-space indentation for JavaScript
- 2-space indentation for CSS
- Single quotes for strings
- Semicolons required at statement endings
- Template literals for multi-line strings

**Linting:**
- No ESLint configuration
- No Prettier configuration
- Manual code review for consistency

## Import Organization

**Order:**
1. External packages (none typically - Web APIs used directly)
2. Relative imports from lib: `import { ... } from '../lib/auth.js'`
3. Component imports: `import '../monaco-editor/monaco-editor.js'`
4. Template imports: `import template from './query.html?raw'`
5. CSS imports: `import './query.css'`

**Grouping:**
- Single blank line between groups
- No alphabetical sorting enforced

**Path Aliases:**
- No path aliases configured
- Relative paths used throughout: `../../lib/`, `../components/`

## Error Handling

**Patterns:**
- Service layer throws exceptions via `throw new Error()`
- Components wrap API calls in try/catch
- Auth expiration triggers callback: `triggerAuthExpired(connectionId, error)`

**Error Types:**
- Standard Error objects: `throw new Error('message')`
- No custom error classes

**Async:**
- async/await pattern (no .then() chains)
- try/catch for error handling

## Logging

**Framework:**
- Console logging (console.log, console.error, console.warn)
- No structured logging library

**Patterns:**
- `console.error()` for errors with context: `console.error('Query error:', error)`
- `console.warn()` for warnings: `console.warn('Failed to fetch metadata:', err)`
- `console.log()` for debug output (sparse usage)
- Prefix pattern for proxy: `console.log('[proxyFetch]', method, url)`

## Comments

**When to Comment:**
- File headers: Single-line description at top
- Section headers: Double-line format for major sections
- Complex logic: Explain why, not what
- Business rules: Document edge cases and quirks

**JSDoc/TSDoc:**
- Required for exported functions in lib/
- Format: `@param`, `@returns`, `@deprecated` tags
- Example from `src/lib/auth.js`:
  ```javascript
  /**
   * Register a callback to be called when auth expires
   * @param {Function} callback - Function to call when auth expires
   */
  ```

**Section Headers:**
```javascript
// ============================================================
// Storage Operations
// ============================================================
```

**TODO Comments:**
- Format: `// TODO: description`
- No tracking convention (use git blame for attribution)

## Function Design

**Size:**
- Target under 50 lines
- Large components exist (query-tab.js is 1309 lines)
- Extract helpers for complex logic

**Parameters:**
- Options objects for multiple optional params: `function execute(options = {})`
- Destructuring in callbacks: `(e) => { const { target } = e; }`

**Return Values:**
- Explicit returns (no implicit undefined)
- Return early for guard clauses
- Async functions return Promises

## Module Design

**Exports:**
- Named exports for all public functions: `export function getAccessToken() {}`
- Named exports for constants: `export const API_VERSION = '62.0'`
- No default exports

**Barrel Files:**
- `src/lib/utils.js` re-exports from auth.js (legacy pattern)
- Otherwise, import directly from source module

**Component Pattern:**
```javascript
import template from './name.html?raw';
import './name.css';

class ComponentName extends HTMLElement {
    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.attachEventListeners();
    }
}

customElements.define('component-name', ComponentName);
```

---

*Convention analysis: 2026-01-15*
*Update when patterns change*
