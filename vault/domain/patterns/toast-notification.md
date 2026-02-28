---
title: Toast Notification Pattern
type: domain
category: patterns
tags:
  - pattern
  - notifications
  - toast
  - context
  - ux
aliases:
  - Toast
  - Notifications
created: 2026-02-28
updated: 2026-02-28
status: active
related-code:
  - src/contexts/ToastContext.tsx
  - src/components/toast/Toast.tsx
  - src/components/toast/Toast.module.css
confidence: high
---

# Toast Notification Pattern

## What Is It?

Global toast notification system accessed via `ToastContext`. Replaced the per-component `StatusBadge` pattern in PR #142. Toasts appear fixed in the top-right corner and can be shown from any component in the app.

## How It Works

### Context API

```typescript
const { show, update, dismiss } = useToast();

// Show a toast, returns toast ID
const id = show('Query executed successfully', 'success');
const id = show('Connection error', 'error', { autoDismiss: false });

// Update a toast in-place (e.g. progress → success)
update(id, { message: 'Done!', type: 'success' });

// Dismiss manually
dismiss(id);
```

### Toast Types

| Type | Use Case |
|------|----------|
| `success` | Operation completed |
| `error` | Error or failure |
| `info` | Informational message |
| `warning` | Non-fatal warning |

### Visual Features

- Fixed top-right position, above all other content
- Slide-in animation on show
- Auto-close progress bar (visual countdown)
- Themed accent border matching toast type
- Stacks vertically when multiple toasts are active

> [!note]
> The toast layer uses `--z-toast: 1100` from the CSS variable z-index scale, placing it above modals (`--z-modal: 1000`). See [[css-variables-theming|CSS Variables and Theming]] for the full z-index scale.

### Test Selectors

```typescript
// Select by role and type
await page.locator('[role="alert"][data-type="success"]').waitFor();
await page.locator('[role="alert"][data-type="error"]').isVisible();
```

## Consumers

Used across all feature tabs: ApexTab, QueryTab, DebugLogsTab, EventsTab, EventPublisher, RestApiTab, RecordPage.

## Key Files

- `src/contexts/ToastContext.tsx` — Context provider with show/update/dismiss API
- `src/components/toast/Toast.tsx` — Toast UI component
- `src/components/toast/Toast.module.css` — Component-scoped toast styles
- `src/react/AppProviders.tsx` — ToastProvider is registered here (innermost provider)

## Related

- [[state-management|State Management]]
- [[component-architecture|Component Architecture]]
- [[css-variables-theming|CSS Variables and Theming]]
