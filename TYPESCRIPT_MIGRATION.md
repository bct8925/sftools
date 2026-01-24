# TypeScript Migration Plan

> **Status:** In Progress
> **Started:** 2026-01-23
> **Branch:** `typescript`

## Overview

Incremental migration to strict TypeScript for the sftools Chrome extension. JavaScript and TypeScript files coexist during migration.

| Metric | Count |
|--------|-------|
| Source files | ~49 |
| Test files | ~42 |
| Total | ~91 |

---

## Progress Tracker

### Phase 1: Foundation Setup
- [x] Install TypeScript dependencies
- [x] Create `tsconfig.json`
- [x] Create `src/types/vite-env.d.ts`
- [x] Create `src/types/salesforce.d.ts`
- [x] Create `src/types/components.d.ts`
- [x] Update `eslint.config.js` for TypeScript
- [x] Update `package.json` scripts
- [x] Verify: `npm run typecheck && npm run build && npm run test:unit`

### Phase 2: Wave 1 - Pure Utilities
- [x] `src/lib/text-utils.js` → `.ts`
- [x] `src/lib/icons.js` → `.ts`
- [x] `src/lib/debug.js` → `.ts`
- [x] Verify: typecheck + build + tests

### Phase 2: Wave 2 - Core Infrastructure
- [x] `src/lib/oauth-credentials.js` → `.ts`
- [x] `src/lib/theme.js` → `.ts`
- [x] `src/lib/ui-helpers.js` → `.ts`
- [x] `src/lib/auth.js` → `.ts` (critical - defines Connection type)
- [x] Verify: typecheck + build + tests

### Phase 2: Wave 3 - Fetch/Request Layer
- [x] `src/lib/fetch.js` → `.ts`
- [x] `src/lib/salesforce-request.js` → `.ts`
- [x] `src/lib/background-utils.js` → `.ts`
- [x] `src/lib/cors-detection.js` → `.ts` (dependency of salesforce-request)
- [x] Verify: typecheck + build + tests

### Phase 2: Wave 4 - Salesforce API Operations
- [x] `src/lib/salesforce.js` → `.ts`
- [x] `src/lib/query-utils.js` → `.ts`
- [x] `src/lib/record-utils.js` → `.ts`
- [x] `src/lib/schema-utils.js` → `.ts`
- [x] `src/lib/apex-utils.js` → `.ts`
- [x] `src/lib/rest-api-utils.js` → `.ts`
- [x] Verify: typecheck + build + tests

### Phase 2: Wave 5 - Feature Utilities
- [x] `src/lib/history-manager.js` → `.ts`
- [x] `src/lib/settings-utils.js` → `.ts`
- [x] `src/lib/events-utils.js` → `.ts`
- [x] `src/lib/soql-autocomplete.js` → `.ts`
- [x] Verify: typecheck + build + tests

### Phase 2: Wave 6 - Reusable Components
- [x] `src/components/sf-icon/sf-icon.js` → `.ts`
- [x] `src/components/button-icon/button-icon.js` → `.ts`
- [x] `src/components/button-dropdown/button-dropdown.js` → `.ts`
- [x] `src/components/modal-popup/modal-popup.js` → `.ts`
- [x] `src/components/monaco-editor/monaco-editor.js` → `.ts`
- [x] Verify: typecheck + build + tests

### Phase 2: Wave 7 - Tab Components
- [ ] `src/components/settings/settings-tab.js` → `.ts`
- [ ] `src/components/utils/utils-tab.js` → `.ts`
- [ ] `src/components/utils-tools/debug-logs.js` → `.ts`
- [ ] `src/components/utils-tools/flow-cleanup.js` → `.ts`
- [ ] `src/components/utils-tools/limits.js` → `.ts`
- [ ] `src/components/utils-tools/deploy-status.js` → `.ts`
- [ ] `src/components/utils-tools/field-usage.js` → `.ts`
- [ ] `src/components/query/query-tab.js` → `.ts`
- [ ] `src/components/apex/apex-tab.js` → `.ts`
- [ ] `src/components/rest-api/rest-api-tab.js` → `.ts`
- [ ] `src/components/events/events-tab.js` → `.ts`
- [ ] Verify: typecheck + build + tests

### Phase 2: Wave 8 - Standalone Pages
- [ ] `src/components/record/record-page.js` → `.ts`
- [ ] `src/components/schema/schema-page.js` → `.ts`
- [ ] Verify: typecheck + build + tests

### Phase 2: Wave 9 - Background Scripts
- [ ] `src/background/debug.js` → `.ts`
- [ ] `src/background/auth.js` → `.ts`
- [ ] `src/background/native-messaging.js` → `.ts`
- [ ] `src/background/background.js` → `.ts`
- [ ] Update `vite.config.js` background entry to `.ts`
- [ ] Verify: typecheck + build + tests

### Phase 2: Wave 10 - Entry Points
- [ ] `src/pages/app/app.js` → `.ts`
- [ ] `src/pages/callback/callback.js` → `.ts`
- [ ] `src/pages/record/record.js` → `.ts`
- [ ] `src/pages/schema/schema.js` → `.ts`
- [ ] Verify: typecheck + build + tests

### Phase 2: Wave 11 - Tests
- [ ] `tests/unit/mocks/chrome.js` → `.ts`
- [ ] `tests/unit/setup.js` → `.ts`
- [ ] `tests/unit/lib/*.test.js` → `.test.ts`
- [ ] `tests/integration/*.test.js` → `.test.ts`
- [ ] Verify: all tests pass

### Phase 3: Cleanup
- [ ] Convert `vite.config.js` → `vite.config.ts`
- [ ] Convert `vitest.config.js` → `vitest.config.ts`
- [ ] Convert `vitest.config.integration.js` → `vitest.config.integration.ts`
- [ ] Remove `allowJs: true` from tsconfig (optional)
- [ ] Final verification: full test suite

---

## Phase 1: Foundation Setup (Detailed)

### 1.1 Install Dependencies

```bash
npm install -D typescript @types/chrome typescript-eslint
```

### 1.2 Create tsconfig.json

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true,

    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],

    "allowJs": true,
    "checkJs": false,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,

    "noEmit": true,
    "skipLibCheck": true,

    "typeRoots": ["./node_modules/@types", "./src/types"]
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.js",
    "src/types/**/*.d.ts"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "sftools-proxy"
  ]
}
```

### 1.3 Create src/types/vite-env.d.ts

```typescript
/// <reference types="vite/client" />

// Support for ?raw imports (HTML templates)
declare module '*.html?raw' {
  const content: string;
  export default content;
}

// Support for ?url imports
declare module '*?url' {
  const url: string;
  export default url;
}

// CSS imports
declare module '*.css' {
  const classes: Record<string, string>;
  export default classes;
}

// Build-time constants
declare const __SFTOOLS_DEBUG__: boolean;
```

### 1.4 Create src/types/salesforce.d.ts

```typescript
// Salesforce Connection
export interface SalesforceConnection {
  id: string;
  label: string;
  instanceUrl: string;
  loginDomain: string;
  accessToken: string;
  refreshToken: string | null;
  clientId: string | null;
  createdAt: number;
  lastUsedAt: number;
}

// Query Results
export interface QueryResult<T = SObject> {
  totalSize: number;
  done: boolean;
  records: T[];
  nextRecordsUrl?: string;
}

export interface ColumnMetadata {
  columnName: string;
  displayName: string;
  aggregate: boolean;
  joinColumns?: ColumnMetadata[];
}

// Generic SObject
export interface SObject {
  Id: string;
  attributes?: {
    type: string;
    url: string;
  };
  [key: string]: unknown;
}

// Describe Results
export interface DescribeGlobalResult {
  encoding: string;
  maxBatchSize: number;
  sobjects: SObjectDescribe[];
}

export interface SObjectDescribe {
  name: string;
  label: string;
  labelPlural: string;
  keyPrefix: string | null;
  custom: boolean;
  customSetting: boolean;
  queryable: boolean;
  createable: boolean;
  updateable: boolean;
  deletable: boolean;
  searchable: boolean;
}

export interface FieldDescribe {
  name: string;
  label: string;
  type: FieldType;
  length: number;
  precision: number;
  scale: number;
  nillable: boolean;
  updateable: boolean;
  createable: boolean;
  calculated: boolean;
  nameField: boolean;
  referenceTo: string[];
  relationshipName: string | null;
  picklistValues?: PicklistValue[];
  defaultValue?: unknown;
}

export type FieldType =
  | 'string' | 'boolean' | 'int' | 'double' | 'date' | 'datetime'
  | 'time' | 'currency' | 'percent' | 'phone' | 'email' | 'url'
  | 'textarea' | 'picklist' | 'multipicklist' | 'combobox'
  | 'reference' | 'id' | 'base64' | 'address' | 'location';

export interface PicklistValue {
  value: string;
  label: string;
  active: boolean;
  defaultValue: boolean;
}

// Apex Execution
export interface ApexExecutionResult {
  success: boolean;
  compiled: boolean;
  compileProblem: string | null;
  exceptionMessage: string | null;
  exceptionStackTrace: string | null;
  line: number;
  column: number;
}

// Request/Response
export interface SalesforceRequestOptions {
  method?: string;
  params?: Record<string, string>;
  body?: string;
  headers?: Record<string, string>;
}

export interface SalesforceRequestResult<T = unknown> {
  json: T;
  status: number;
}
```

### 1.5 Create src/types/components.d.ts

```typescript
import type { editor } from 'monaco-editor';
import type { SalesforceConnection } from './salesforce';

// Monaco Editor Component
export interface MonacoEditorElement extends HTMLElement {
  editor: editor.IStandaloneCodeEditor | null;
  getValue(): string;
  setValue(value: string): void;
  appendValue(text: string): void;
  clear(): void;
  setMarkers(markers: editor.IMarkerData[]): void;
  clearMarkers(): void;
}

// Connection Changed Event
export interface ConnectionChangedEvent extends CustomEvent<SalesforceConnection | null> {
  type: 'connection-changed';
}

// Declare custom elements
declare global {
  interface HTMLElementTagNameMap {
    'monaco-editor': MonacoEditorElement;
    'query-tab': HTMLElement;
    'apex-tab': HTMLElement;
    'rest-api-tab': HTMLElement;
    'events-tab': HTMLElement;
    'utils-tab': HTMLElement;
    'settings-tab': HTMLElement;
    'record-page': HTMLElement;
    'schema-page': HTMLElement;
    'button-dropdown': HTMLElement;
    'button-icon': HTMLElement;
    'modal-popup': HTMLElement;
    'sf-icon': HTMLElement;
  }

  interface DocumentEventMap {
    'connection-changed': ConnectionChangedEvent;
  }
}

export {};
```

### 1.6 Update eslint.config.js

Add TypeScript configuration blocks:

```javascript
import tseslint from 'typescript-eslint';

// Add to exports array:

// TypeScript files
...tseslint.configs.recommended.map(config => ({
  ...config,
  files: ['src/**/*.ts'],
})),

{
  files: ['src/**/*.ts'],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      project: './tsconfig.json',
    },
  },
  plugins: {
    '@typescript-eslint': tseslint.plugin,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
  },
},
```

### 1.7 Update package.json Scripts

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "typecheck:watch": "tsc --noEmit --watch",
    "format": "prettier --write \"src/**/*.{js,ts,css,html}\" \"tests/**/*.{js,ts}\" \"scripts/**/*.js\"",
    "format:check": "prettier --check \"src/**/*.{js,ts,css,html}\" \"tests/**/*.{js,ts}\" \"scripts/**/*.js\""
  }
}
```

---

## Web Component Migration Pattern

### Before (JavaScript)

```javascript
import template from './example.html?raw';
import './example.css';

class ExampleTab extends HTMLElement {
    connectedCallback() {
        this.innerHTML = template;
        this.button = this.querySelector('.example-button');
        this.button.addEventListener('click', () => this.handleClick());
        document.addEventListener('connection-changed', (e) => this.handleConnection(e));
    }

    handleClick() {
        console.log('clicked');
    }

    handleConnection(event) {
        const connection = event.detail;
        // ...
    }
}

customElements.define('example-tab', ExampleTab);
```

### After (TypeScript)

```typescript
import template from './example.html?raw';
import './example.css';
import type { SalesforceConnection } from '../../types/salesforce';
import type { ConnectionChangedEvent } from '../../types/components';

class ExampleTab extends HTMLElement {
  private button!: HTMLButtonElement;

  connectedCallback(): void {
    this.innerHTML = template;
    this.button = this.querySelector<HTMLButtonElement>('.example-button')!;
    this.button.addEventListener('click', this.handleClick);
    document.addEventListener('connection-changed', this.handleConnection);
  }

  disconnectedCallback(): void {
    this.button.removeEventListener('click', this.handleClick);
    document.removeEventListener('connection-changed', this.handleConnection);
  }

  private handleClick = (): void => {
    console.log('clicked');
  };

  private handleConnection = (event: ConnectionChangedEvent): void => {
    const connection = event.detail;
    // ...
  };
}

customElements.define('example-tab', ExampleTab);
```

### Key Patterns

1. **Non-null assertion (`!`)** for DOM elements known to exist after `innerHTML = template`
2. **Generic `querySelector<T>()`** for proper element typing
3. **Arrow functions for event handlers** to preserve `this` binding
4. **Cleanup in `disconnectedCallback()`** for event listeners
5. **Import types with `import type`** for tree-shaking

---

## Verification Commands

```bash
# Type check only
npm run typecheck

# Full validation (run after each wave)
npm run typecheck && npm run build && npm run test:unit

# Complete validation (run before commits)
npm run typecheck && npm run build && npm run test:unit && npm run test:frontend
```

---

## Notes

- Keep this document updated as migration progresses
- Mark items with `[x]` when complete
- Add any issues or learnings in the Notes section below

### Migration Log

| Date | Wave | Files | Notes |
|------|------|-------|-------|
| 2026-01-23 | - | - | Plan created |
| 2026-01-23 | Phase 1 | 6 | Foundation complete: tsconfig, types, eslint, scripts |
| 2026-01-23 | Wave 1 | 3 | Pure utilities: text-utils, icons, debug |
| 2026-01-23 | Wave 2 | 4 | Core infrastructure: oauth-credentials, theme, ui-helpers, auth |
| 2026-01-23 | Wave 3 | 4 | Fetch/Request layer: fetch, salesforce-request, background-utils, cors-detection |
| 2026-01-23 | Wave 4 | 6 | Salesforce API operations: salesforce, query-utils, record-utils, schema-utils, apex-utils, rest-api-utils |
| 2026-01-23 | Wave 5 | 4 | Feature utilities: history-manager, settings-utils, events-utils, soql-autocomplete |
| 2026-01-23 | Wave 6 | 5 | Reusable components: sf-icon, button-icon, button-dropdown, modal-popup, monaco-editor |

### Issues Encountered

(None yet)

### Learnings

- Vitest doesn't auto-resolve `.js` imports to `.ts` files. Added custom `jsToTsResolver` plugin to `vitest.config.js` that checks for `.ts` files when `.js` imports fail
- Vite build resolves `.js` → `.ts` automatically, but Vitest needs the plugin
- Keep using `.js` extensions in imports (ESM standard) - the resolver plugin handles the migration
