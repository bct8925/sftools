---
title: CSS Variables and Theming
type: domain
category: patterns
tags:
  - css
  - theming
  - dark-mode
  - css-modules
  - design-system
aliases:
  - Theming
  - CSS Variables
  - Dark Mode
created: 2026-02-08
updated: 2026-02-08
status: active
confidence: high
---

# CSS Variables and Theming

## What Is It?

sftools uses CSS custom properties (variables) for a consistent design system with light/dark mode support. All visual properties (colors, shadows, z-index, spacing, radii) are defined as CSS variables in `src/style.css`.

## How It Works

### CSS Variable System

```css
/* Colors */
--primary-color          /* Brand blue */
--bg-color               /* Page background */
--bg-secondary           /* Secondary background */
--card-bg                /* Card backgrounds */
--text-main              /* Primary text */
--text-muted             /* Secondary text */
--border-color           /* Borders */
--error-color / --error-bg
--success-color

/* Shadows */
--shadow-sm, --shadow-md, --shadow-lg

/* Z-index scale */
--z-dropdown: 100    --z-sticky: 200    --z-modal-backdrop: 900
--z-modal: 1000      --z-toast: 1100

/* Border radius */
--radius-sm: 3px    --radius-md: 4px    --radius-lg: 8px

/* Spacing */
--spacing-xs: 4px   --spacing-sm: 8px   --spacing-md: 16px   --spacing-lg: 24px
```

### Theme Switching

`lib/theme.ts` manages theme with three modes:
- `light` — Light theme
- `dark` — Dark theme
- `system` — Auto-detect from `prefers-color-scheme`

`initTheme()` is called before React render to prevent flash of wrong theme.

### CSS Modules

Component-scoped styles via `.module.css` files:

```css
/* Component.module.css */
.container { padding: var(--spacing-md); }
.results { background: var(--bg-secondary); color: var(--text-main); }
```

### Shared CSS Classes

Global classes in `style.css` for common patterns:

| Pattern | Classes |
|---------|---------|
| Cards | `.card`, `.card-header`, `.card-body`, `.card-header-icon` |
| Buttons | `.button-brand`, `.button-neutral` |
| Inputs | `.input`, `.select`, `.search-input` |
| Modal | `.modal-overlay`, `.modal-dialog`, `.modal-buttons` |
| Dropdown | `.dropdown-menu`, `.dropdown-item` |
| Status | `.status-badge[data-status="loading/success/error"]` |

## Key Principles

**MUST**: Use CSS variables for all colors, shadows, z-index, and radii.
**MUST**: Use CSS Modules for component-scoped styling.
**MUST**: Use shared classes from `style.css` before creating new ones.
**MUST NOT**: Hard-code colors (`#ffffff`), use `var(--variable-name)` instead.
**MUST NOT**: Use inline styles — use CSS classes or CSS Modules.

```css
/* CORRECT */
.component { background: var(--card-bg); color: var(--text-main); }

/* INCORRECT */
.component { background: #ffffff; color: #333; }
```

## Resources

- `src/style.css` — All variable definitions and shared classes
- `src/lib/theme.ts` — Theme initialization and switching
- `src/contexts/ThemeContext.tsx` — React theme context
