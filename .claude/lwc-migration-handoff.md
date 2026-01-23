# Frontend Refactor: Plain Web Components → LWC Open Source

## Overview

Migrate the sftools Chrome extension from plain Custom Elements to Lightning Web Components Open Source (LWC OSS). This is a **full rewrite** adopting Shadow DOM for proper encapsulation.

**Current State:**
- 6 tab components, 2 standalone pages, 9 shared components
- Templates via `?raw` imports, light DOM, manual state management
- Vite bundler with Monaco chunking
- Custom Playwright test framework with light DOM selectors

**Target State:**
- LWC OSS components with Shadow DOM encapsulation
- Reactive state via `@track` and `@api` decorators
- CSS variables penetrate Shadow DOM for theming
- Updated test selectors with `data-testid` attributes

---

## Phase 1: Infrastructure Setup

### 1.1 Install LWC Dependencies

```bash
npm install lwc @lwc/engine-dom
npm install -D @nicholasdejong/vite-plugin-lwc  # or @nicholasdejong/lwc-bundler
```

### 1.2 Create LWC Directory Structure

```
src/
├── modules/                      # LWC components
│   └── c/                        # Namespace
│       ├── appContainer/
│       ├── queryTab/
│       ├── apexTab/
│       ├── ... (other components)
│       └── monacoEditor/
├── pages/                        # Entry shells (unchanged)
├── lib/                          # Utilities (unchanged)
└── style.css                     # CSS variables (unchanged)
```

### 1.3 Update Vite Configuration

**File:** `vite.config.js`

```javascript
import lwc from '@nicholasdejong/vite-plugin-lwc';

export default defineConfig({
  root: 'src',
  base: './',
  plugins: [
    lwc({
      modules: [{ dir: 'src/modules' }]
    })
  ],
  // ... rest of config unchanged
});
```

### 1.4 Create Pubsub Module for Inter-Component Communication

**File:** `src/lib/pubsub.js`

Replace document-level events (`connection-changed`, `theme-changed`) with:
- `subscribe(channel, callback)` → returns unsubscribe function
- `publish(channel, data)` → broadcasts to subscribers

### 1.5 Update Entry Points

**File:** `src/pages/app/app.js`

```javascript
import { createElement } from 'lwc';
import { initTheme } from '../../lib/theme.js';
import AppContainer from 'c/appContainer';

initTheme();
const app = createElement('c-app-container', { is: AppContainer });
document.body.appendChild(app);
```

---

## Phase 2: Migrate Shared Components

**Order (least to most dependencies):**

| Component | Current File | Notes |
|-----------|--------------|-------|
| sf-icon | `src/components/sf-icon/sf-icon.js` | SVG sprite reference |
| button-icon | `src/components/button-icon/button-icon.js` | Uses sf-icon |
| button-dropdown | `src/components/button-dropdown/button-dropdown.js` | Uses button-icon |
| modal-popup | `src/components/modal-popup/modal-popup.js` | Overlay behavior |
| monaco-editor | `src/components/monaco-editor/monaco-editor.js` | **Critical**: use `lwc:dom="manual"` |

### Monaco Editor Strategy

Monaco requires direct DOM access. Use LWC's manual DOM mode:

```html
<!-- monacoEditor.html -->
<template>
  <div class="editor-container" lwc:dom="manual"></div>
</template>
```

```javascript
// monacoEditor.js
renderedCallback() {
  if (!this.editor) {
    const container = this.template.querySelector('.editor-container');
    this.editor = monaco.editor.create(container, { /* options */ });
  }
}
```

---

## Phase 3: Migrate Utility Components

**Files in `src/components/utils-tools/`:**
- search-box.js
- debug-logs.js
- flow-cleanup.js
- schema-browser-link.js

These are simpler components, good warm-up before tabs.

---

## Phase 4: Migrate Tab Components

**Order (simpler to complex):**

| Tab | Lines | File | Key Complexity |
|-----|-------|------|----------------|
| settings-tab | 569 | `src/components/settings/settings-tab.js` | Chrome storage, OAuth |
| utils-tab | 186 | `src/components/utils/utils-tab.js` | Container only |
| apex-tab | 431 | `src/components/apex/apex-tab.js` | Monaco + history |
| rest-api-tab | 410 | `src/components/rest-api/rest-api-tab.js` | Monaco + methods |
| events-tab | 589 | `src/components/events/events-tab.js` | Streaming, proxy |
| query-tab | 1352 | `src/components/query/query-tab.js` | Most complex, save for last |

### Component Migration Template

**Current pattern:**
```javascript
import template from './component.html?raw';
import './component.css';

class ComponentTab extends HTMLElement {
  connectedCallback() {
    this.innerHTML = template;
    this.initElements();
    this.attachEventListeners();
  }
}
```

**LWC pattern:**
```javascript
import { LightningElement, api, track } from 'lwc';

export default class ComponentTab extends LightningElement {
  @track items = [];
  @track isLoading = false;

  connectedCallback() {
    this.subscribeToEvents();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
  }
}
```

### Key Transformations

| Current | LWC |
|---------|-----|
| `this.innerHTML = template` | Automatic via `.html` file |
| `this.querySelector('.x')` | `this.template.querySelector('.x')` |
| `element.innerHTML = html` | `@track` array + `for:each` |
| `classList.toggle('active')` | Computed getter + `class={computedClass}` |
| `document.addEventListener(...)` | `subscribe()` from pubsub |

---

## Phase 5: Migrate Standalone Pages

| Page | File |
|------|------|
| record-page | `src/components/record/record-page.js` |
| schema-page | `src/components/schema/schema-page.js` |

These follow the same pattern as tabs.

---

## Phase 6: Update Testing Infrastructure

### 6.1 Add data-testid Attributes

All interactive elements need stable selectors:

```html
<button class="query-action-btn" data-testid="query-execute-btn">Query</button>
<div class="status-badge" data-testid="query-status">...</div>
```

### 6.2 Update Page Objects for Shadow DOM

**File:** `tests/frontend/pages/query-tab.page.ts`

Use Playwright's shadow-piercing selectors:

```typescript
// Before (light DOM)
this.executeBtn = page.locator('.query-action-btn');

// After (shadow DOM)
this.executeBtn = page.locator('c-query-tab >> [data-testid="query-execute-btn"]');
```

### 6.3 Update BasePage Helpers

Add Shadow DOM utilities to `tests/frontend/pages/base.page.ts`:

```typescript
async shadowQuery(component: string, testId: string) {
  return this.page.locator(`${component} >> [data-testid="${testId}"]`);
}
```

---

## CSS Architecture

### CSS Variables (Keep Current Approach)

The existing `src/style.css` CSS variables penetrate Shadow DOM:

```css
:root {
  --primary-color: #0070d2;
  --bg-color: #f3f3f3;
  /* ... */
}
```

Component CSS references these:
```css
/* queryTab.css */
.card { background: var(--card-bg); }
```

### Shared Styles

For common patterns (cards, buttons), either:
1. Create `src/modules/c/shared/sharedStyles.js` with exported CSS strings
2. Or duplicate in each component (LWC's recommended approach)

---

## Critical Files Summary

**Must Modify:**
- `vite.config.js` - Add LWC plugin
- `package.json` - Add LWC dependencies
- `src/pages/*/` - Update entry points to use `createElement()`
- All component files - Full rewrite to LWC

**Keep Unchanged:**
- `src/lib/*.js` - Utility functions work as-is
- `src/background/` - Service worker has no UI
- `src/style.css` - CSS variables work with Shadow DOM
- `manifest.json` - LWC compiles to standard web components

**Testing Updates:**
- `tests/frontend/pages/*.ts` - Shadow-piercing selectors
- `tests/frontend/framework/` - May need Shadow DOM helpers
- All templates - Add `data-testid` attributes

---

## Verification Plan

### After Each Phase

1. **Build succeeds**: `npm run build` produces valid dist/
2. **Extension loads**: Load unpacked in Chrome, no console errors
3. **Theme works**: Toggle dark/light mode, colors update
4. **Basic functionality**: Tab switching, Monaco editing

### After Full Migration

1. **Run all tests**: `npm run test:frontend`
2. **Manual testing checklist**:
   - [ ] Query tab: Execute SOQL, edit records inline, export CSV
   - [ ] Apex tab: Execute anonymous Apex, view logs
   - [ ] REST API tab: Make API calls, view responses
   - [ ] Settings tab: Add/remove connections, switch orgs
   - [ ] Events tab: Subscribe to streaming events (requires proxy)
   - [ ] Record viewer: Open from context menu, edit fields
   - [ ] Schema browser: Browse objects and fields

3. **Performance check**: Compare load times before/after
4. **Build size check**: Compare dist/ sizes

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Monaco doesn't work in Shadow DOM | Use `lwc:dom="manual"` - proven pattern |
| CSS variables don't propagate | Test early in Phase 1 with prototype |
| Test selectors break | Add `data-testid` systematically before migration |
| Build size increases | LWC OSS is ~40KB gzipped, acceptable tradeoff |

---

## Dependencies to Add

```json
{
  "dependencies": {
    "lwc": "^7.x",
    "@lwc/engine-dom": "^7.x"
  },
  "devDependencies": {
    "@nicholasdejong/vite-plugin-lwc": "^x.x"
  }
}
```

Note: Verify latest LWC OSS version at https://lwc.dev before starting.
