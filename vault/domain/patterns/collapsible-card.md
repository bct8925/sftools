---
title: Collapsible Card Pattern
type: domain
category: patterns
tags:
  - vault/domain/patterns
  - pattern
  - ui
  - collapse
  - cards
aliases:
  - CollapseChevron
  - Collapsible Section
created: 2026-02-28
updated: 2026-02-28
status: active
confidence: high
related-code:
  - src/components/collapse-chevron/CollapseChevron.tsx
---

# Collapsible Card Pattern

## What Is It?

A shared `CollapseChevron` component provides animated expand/collapse for card sections. Uses the HTML `hidden` attribute (not conditional rendering) so collapsed content retains its state.

## How It Works

### CollapseChevron Component

```typescript
import { CollapseChevron } from '../collapse-chevron/CollapseChevron';

// In card header
<div className="card-header" onClick={() => setExpanded(!expanded)}>
  <h3>Settings</h3>
  <CollapseChevron expanded={expanded} />
</div>

// Card body — use hidden attribute, not conditional rendering
<div className="card-body" hidden={!expanded}>
  {/* content preserved when collapsed */}
</div>
```

### Why `hidden` Instead of Conditional Rendering

Using `hidden` rather than `{expanded && <Content />}` means:
- Component state (form inputs, scroll position) is preserved when section is collapsed
- No re-mount/unmount cost when toggling
- Better performance for sections with expensive renders

### Global CSS

A global rule in `style.css` ensures hidden elements don't take up space:

```css
[hidden] { display: none !important; }
```

## Usage

Applied across all main feature tabs:

- **Apex** — collapsible settings/output section
- **Query** — collapsible query settings
- **Events** — collapsible EventPublisher card
- **REST API** — collapsible request settings

## Key Principles

- **State preservation**: `hidden` keeps DOM alive so inputs and scroll position survive collapse
- **Single shared component**: One `CollapseChevron` handles animation across all tabs
- **Global enforcement**: The `[hidden]` CSS rule ensures consistent hide behavior regardless of element type

## Key Files

- `src/components/collapse-chevron/CollapseChevron.tsx` — Animated chevron indicator
- `src/style.css` — Global `[hidden]` rule

## Related

- [[component-architecture|Component Architecture]]
