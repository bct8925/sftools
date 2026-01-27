---
trigger: always_on
---

# sftools - Chrome Extension for Salesforce Developers

> **This CLAUDE.md is the authoritative source for development guidelines.**
> Subdirectories contain specialized CLAUDE.md files that extend these rules.

## Overview

| Aspect | Details |
|--------|---------|
| **Type** | Chrome Extension (Manifest V3) |
| **Stack** | React 19, TypeScript 5.9, Vite 7, Monaco Editor |
| **State** | React Context API (3 providers) |
| **Testing** | Vitest (unit), Playwright headless (E2E) |
| **Optional** | Node.js native messaging proxy for gRPC/CometD streaming |

## Universal Development Rules

### Code Quality (MUST)

- **MUST** write TypeScript in strict mode (all files `.ts` or `.tsx`)
- **MUST** use React functional components with hooks
- **MUST** use CSS Modules for component-scoped styling (`.module.css`)
- **MUST** use CSS variables for all colors, shadows, z-index, and radii
- **MUST** use `salesforceRequest()` for all Salesforce API calls
- **MUST** use context hooks (`useConnection`, `useTheme`, `useProxy`) for global state
- **MUST** include tests for new features (unit for lib/, frontend for UI)

### Best Practices (SHOULD)

- **SHOULD** use `useCallback` for event handlers passed to children
- **SHOULD** keep components under 300 lines; extract logic to custom hooks
- **SHOULD** use shared CSS classes from `style.css` before creating new ones
- **SHOULD** prefer early returns over nested conditionals
- **SHOULD** use semantic CSS variable names (purpose, not color)

### Anti-Patterns (MUST NOT)

- **MUST NOT** use `any` type without explicit justification
- **MUST NOT** bypass TypeScript errors with `@ts-ignore`
- **MUST NOT** hard-code colors, use `var(--variable-name)` instead
- **MUST NOT** store secrets in code - use Chrome storage or `.env.test`
- **MUST NOT** use inline styles - use CSS classes or CSS Modules

## Quick Reference

### Build Commands

```bash
npm install                    # Install dependencies
npm run build                  # Build for development (debug mode)
npm run watch                  # Build with watch mode
npm run package                # Build production + create zip archive
npm run typecheck              # TypeScript validation
npm run typecheck:watch        # TypeScript watch mode
```

### Test Commands

```bash
# Unit tests (Vitest with mocks)
npm run test:unit                        # Run all unit tests
npm run test:unit -- auth.test.ts        # Run specific test file
npm run test:unit:watch                  # Watch mode
npm run test:unit:coverage               # With coverage report

# Integration tests (real Salesforce API)
npm run test:integration                 # Run all integration tests
npm run test:integration -- query        # Run tests matching "query"

# Frontend tests (Playwright headless with mocks)
npm run test:frontend                    # Run all (headless, no .env.test needed)
npm run test:frontend -- --filter=query  # Run tests matching "query"
npm run test:frontend:slow               # With human-like timing
npm run test:frontend:extension          # Run with real Chrome extension
```

### Code Quality

```bash
npm run lint                   # ESLint check
npm run lint:fix               # Auto-fix linting issues
npm run format                 # Prettier format
npm run format:check           # Check formatting
npm run fix                    # Auto-fix lint + format
npm run check                  # Run typecheck + lint + format:check
npm run validate               # Auto-fix, then run all checks
```

### Pre-PR Validation

```bash
npm run validate && npm run test:unit && npm run test:frontend && npm run build
```

## Project Structure

### Applications

- **`src/`** → Extension source code
  - `components/` → React components ([see src/components/CLAUDE.md](src/components/CLAUDE.md))
  - `contexts/` → React Context providers ([see src/contexts/CLAUDE.md](src/contexts/CLAUDE.md))
  - `hooks/` → Custom React hooks (re-exports from contexts)
  - `lib/` → TypeScript utilities ([see src/lib/CLAUDE.md](src/lib/CLAUDE.md))
  - `types/` → TypeScript type definitions
  - `pages/` → Entry points (app, callback, record, schema)
  - `react/` → App shell (App.tsx, providers, entry points)
  - `background/` → Service worker (auth, messaging, context menu)

- **`sftools-proxy/`** → Native messaging host ([see sftools-proxy/CLAUDE.md](sftools-proxy/CLAUDE.md))
  - gRPC client for Pub/Sub API
  - CometD client for PushTopics
  - REST proxy for CORS bypass

### Testing

- **`tests/`** → All test files ([see tests/CLAUDE.md](tests/CLAUDE.md))
  - `unit/` → Vitest with mocks (jsdom)
  - `integration/` → Vitest with real API (node)
  - `frontend/` → Playwright headless tests

### Build Output

- **`dist/`** → Built extension (referenced by manifest.json)
  - `pages/` → Built HTML/JS
  - `chunks/` → Shared code
  - `assets/` → Monaco workers, fonts

## Directory Structure

```
sftools/
├── src/
│   ├── components/           # React Components (37 TSX files)
│   │   ├── apex/             # Apex tab: ApexTab, ApexHistory, ApexOutput
│   │   ├── button-dropdown/  # ButtonDropdown.tsx
│   │   ├── button-icon/      # ButtonIcon.tsx
│   │   ├── events/           # Events tab: EventsTab, ChannelSelector, EventPublisher
│   │   ├── modal/            # Modal.tsx
│   │   ├── monaco-editor/    # MonacoEditor.tsx + useMonacoTheme hook
│   │   ├── query/            # Query tab: QueryTab, QueryEditor, QueryTabs, QueryResults, QueryResultsTable, QueryHistory
│   │   ├── record/           # Record Viewer: RecordPage, FieldRow, RichTextModal
│   │   ├── rest-api/         # REST API tab: RestApiTab
│   │   ├── schema/           # Schema Browser: SchemaPage, ObjectList, FieldList, FormulaEditor
│   │   ├── settings/         # Settings tab: SettingsTab, ConnectionList, ConnectionCard, EditConnectionModal, ThemeSettings, ProxySettings, CacheSettings
│   │   ├── sf-icon/          # SfIcon.tsx
│   │   ├── utils/            # Utils tab: UtilsTab
│   │   └── utils-tools/      # Utility tools: SearchBox, DebugLogs, FlowCleanup, SchemaBrowserLink
│   │
│   ├── contexts/             # React Context API (3 providers)
│   │   ├── ConnectionContext.tsx  # Multi-org state
│   │   ├── ThemeContext.tsx       # Dark/light mode
│   │   ├── ProxyContext.tsx       # Native messaging proxy
│   │   └── index.ts               # Barrel exports
│   │
│   ├── hooks/                # Custom React hooks
│   │   └── index.ts          # Re-exports: useConnection, useTheme, useProxy
│   │
│   ├── react/                # App shell (8 TSX files)
│   │   ├── App.tsx                    # Main tabbed interface
│   │   ├── AppProviders.tsx           # Context provider wrapper
│   │   ├── TabNavigation.tsx          # Tab navigation
│   │   ├── ConnectionSelector.tsx     # Org selector
│   │   ├── MobileMenu.tsx             # Responsive menu
│   │   ├── index.tsx                  # Main app entry
│   │   ├── record.tsx                 # Record page entry
│   │   └── schema.tsx                 # Schema page entry
│   │
│   ├── lib/                  # TypeScript utilities (24 TS files)
│   │   ├── auth.ts           # Multi-connection storage
│   │   ├── salesforce.ts     # API operations (executeQuery, executeApex, etc.)
│   │   ├── salesforce-request.ts # Request wrapper with error handling
│   │   ├── fetch.ts          # Smart routing (proxy/extension)
│   │   ├── query-utils.ts    # SOQL parsing
│   │   ├── apex-utils.ts     # Apex execution
│   │   ├── record-utils.ts   # Field manipulation
│   │   ├── schema-utils.ts   # Metadata operations
│   │   ├── history-manager.ts # Query/Apex history
│   │   ├── soql-autocomplete.ts # Editor autocomplete
│   │   ├── theme.ts          # Dark/light mode
│   │   └── ...               # 13 more utilities
│   │
│   ├── types/                # TypeScript definitions
│   │   ├── salesforce.d.ts   # Salesforce API types
│   │   ├── vite-env.d.ts     # Vite environment types
│   │   └── components.d.ts   # Component types
│   │
│   ├── pages/                # HTML entry points
│   │   ├── app/              # Main tabbed app
│   │   ├── callback/         # OAuth callback
│   │   ├── record/           # Record Viewer
│   │   └── schema/           # Schema Browser
│   │
│   ├── background/           # Service worker (4 TS files)
│   │   ├── background.ts     # Message routing, context menu
│   │   ├── auth.ts           # Token exchange/refresh
│   │   ├── native-messaging.ts # Proxy communication
│   │   └── debug.ts          # Debug utilities
│   │
│   ├── public/               # Static assets
│   └── style.css             # Global styles + CSS variables
│
├── tests/
│   ├── unit/                 # Vitest unit tests (24 TS files)
│   │   ├── lib/              # Library tests
│   │   ├── mocks/            # Chrome, Salesforce mocks
│   │   └── setup.ts          # Test setup
│   │
│   ├── frontend/             # Playwright headless tests
│   │   ├── specs/            # Test suites
│   │   ├── pages/            # Page objects
│   │   ├── services/         # Headless/extension loaders
│   │   └── framework/        # Test runner, base class
│   │
│   └── integration/          # Real API tests
│
├── sftools-proxy/            # Native messaging host
│   ├── src/                  # Proxy source
│   ├── proto/                # gRPC proto files
│   └── install.js            # Native host installer
│
├── manifest.json             # Chrome MV3 manifest
├── vite.config.ts            # Vite build config
├── vitest.config.ts          # Unit test config
├── tsconfig.json             # TypeScript config (strict mode)
└── rules.json                # Declarative net request rules
```

## Quick Find Commands

### Find Components

```bash
# Find React component definition
rg -n "export function [A-Z]" src/components

# Find component usage
rg -n "<[A-Z][a-zA-Z]+" src/

# Find CSS class definition
rg -n "^\." src/style.css src/components/**/*.module.css
```

### Find API Methods

```bash
# Find Salesforce API functions
rg -n "^export (async )?function" src/lib/salesforce.ts

# Find background message handlers
rg -n "^\s+\w+:" src/background/background.ts

# Find auth functions
rg -n "^export" src/lib/auth.ts
```

### Find Types

```bash
# Find TypeScript interfaces
rg -n "^export (interface|type)" src/types

# Find context types
rg -n "interface.*ContextType" src/contexts
```

### Find Tests

```bash
# Find test for a function
rg -n "describe.*functionName" tests/

# Find page object methods
rg -n "async \w+\(" tests/frontend/pages/
```

## Tool Tabs

| Tab | Purpose | Key Files |
|-----|---------|-----------|
| **Query** | SOQL editor with tabbed results | `components/query/QueryTab.tsx` |
| **Apex** | Anonymous Apex execution | `components/apex/ApexTab.tsx` |
| **REST API** | REST explorer with Monaco | `components/rest-api/RestApiTab.tsx` |
| **Events** | Streaming (requires proxy) | `components/events/EventsTab.tsx` |
| **Utils** | Debug logs, flow cleanup | `components/utils/UtilsTab.tsx` |
| **Settings** | Connections, appearance | `components/settings/SettingsTab.tsx` |

## Standalone Tools

| Tool | Purpose | Entry Point |
|------|---------|-------------|
| **Record Viewer** | View/edit record fields | `pages/record/record.html` |
| **Schema Browser** | Browse object metadata | `pages/schema/schema.html` |

## Testing Overview

See [tests/CLAUDE.md](tests/CLAUDE.md) for comprehensive testing documentation.

### Three Test Types

1. **Unit Tests** (`tests/unit/`) - Vitest with mocks, TypeScript
2. **Integration Tests** (`tests/integration/`) - Real Salesforce API
3. **Frontend Tests** (`tests/frontend/`) - Playwright headless (no .env.test needed)

### Test Files to Match Source

| Source | Test Location |
|--------|---------------|
| `src/lib/auth.ts` | `tests/unit/lib/auth.test.ts` |
| `components/query/` | `tests/frontend/specs/query/` |
