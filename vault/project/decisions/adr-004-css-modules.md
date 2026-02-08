---
title: "ADR-004: CSS Modules for Component Styling"
type: decision
category: decisions
tags:
  - vault/project/decisions
  - adr
  - css
  - styling
  - css-modules
aliases:
  - CSS Modules Decision
created: 2026-02-08
updated: 2026-02-08
status: accepted
confidence: high
---

# ADR-004: CSS Modules for Component Styling

## Status

Accepted

## Context

sftools is a Chrome extension built with React 19 and Vite 7. The styling system must:
- Provide component-scoped styles to avoid class name collisions
- Support dark/light theming via CSS variables
- Work efficiently with Vite's build pipeline
- Keep bundle size minimal (Chrome extension constraint)
- Enable shared design system patterns (cards, buttons, inputs, modals)
- Work in extension environment (no server-side rendering)

The codebase has a global design system with:
- CSS variables for colors, spacing, typography in `src/style.css`
- Shared component classes (`.card`, `.button-brand`, `.input-field`, `.modal-overlay`)
- Dark/light theme support via `[data-theme="dark"]` attribute selectors

## Decision

Use **CSS Modules** (`.module.css` files) for component-scoped styling, combined with CSS variables for theming.

### Pattern

Component-specific styles in `.module.css`:
```css
/* QueryEditor.module.css */
.container {
  padding: var(--spacing-md);
}

.results {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
}
```

Import and use in React component:
```tsx
import styles from './QueryEditor.module.css';

<div className={styles.container}>
  <div className={styles.results}>...</div>
</div>
```

Combined with global `src/style.css` for shared patterns:
```tsx
<div className="card">
  <button className="button-brand">Execute</button>
</div>
```

### Integration Points
- Vite automatically processes `.module.css` files and generates scoped class names
- CSS variables (`var(--name)`) work naturally in `.module.css` files
- Global classes from `style.css` can be combined with module classes

## Consequences

### Positive
- **Zero runtime overhead** — CSS Modules compiled at build time by Vite, no runtime CSS-in-JS library
- **Automatic scoping** — Class names hashed to prevent collisions (`.container` becomes `.QueryEditor_container_a3b2c1`)
- **CSS variables integration** — Just use `var(--name)` in any `.module.css`, no special setup
- **Standard CSS** — No new syntax to learn, works with standard CSS tooling
- **Small bundle** — No CSS-in-JS runtime library (~12KB+ saved)
- **Clean separation** — Global design tokens in `style.css`, component-specific styles in `.module.css`
- **Vite-native** — Built-in Vite support, same transform pipeline as production build

### Negative
- **No dynamic prop-based styling** — Cannot generate styles based on component props; must use CSS classes or inline styles for dynamic values
- **No TypeScript type safety** — Can reference non-existent CSS classes without type error
- **Two systems** — Developers must understand both CSS Modules (for scoping) and global classes (for shared patterns)
- **Build step required** — Cannot use plain CSS class names, must import from `.module.css`

## Alternatives Considered

### 1. styled-components / Emotion (CSS-in-JS)
**Pros**: Dynamic styling based on props, TypeScript integration, single-file components
**Cons**:
- Runtime overhead (~12KB+ for library)
- Theme requires `ThemeProvider` wrapper vs simple CSS variables
- Runtime style injection slower than build-time CSS
- Unnecessary complexity for a Chrome extension

**Rejected**: Bundle size and runtime overhead not justified for this use case

### 2. Tailwind CSS
**Pros**: Utility-first approach, no `.module.css` files, design system in config
**Cons**:
- Makes JSX harder to read with many utility classes (`className="flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-800 border border-gray-300..."`)
- Doesn't align well with existing CSS variable theming system
- Requires additional build configuration and PostCSS
- Less semantic class names

**Rejected**: Readability concerns and mismatch with CSS variable theming

### 3. Plain CSS (no modules)
**Pros**: Simplest approach, no build transforms
**Cons**:
- Risk of class name collisions across components (`.container`, `.header`, `.results` used in many places)
- Requires strict BEM or other naming convention to avoid collisions
- Manual scoping discipline

**Rejected**: Collision risk in growing codebase not worth the simplicity

### 4. CSS-in-JS with zero runtime (vanilla-extract, linaria)
**Pros**: Build-time CSS-in-JS, TypeScript type safety for styles, no runtime overhead
**Cons**:
- Adds complexity and build tool dependencies
- Requires learning new API and patterns
- Benefits over CSS Modules don't justify added complexity

**Rejected**: Complexity not justified when CSS Modules already provides build-time scoping

## Related

- [[css-variables-theming]] - CSS variable system for dark/light themes
- [[component-architecture]] - React component patterns and structure
- [[Vite]] - Build tool with native CSS Modules support
