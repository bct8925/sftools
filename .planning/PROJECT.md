# sftools SLDS Icons

## What This Is

Replace all icons in the sftools Chrome Extension with SLDS (Salesforce Lightning Design System) icons via the npm package. This brings visual consistency with the Salesforce Lightning aesthetic across all tabs and standalone tools.

## Core Value

Visual consistency with Salesforce Lightning — icons should feel native to the Salesforce ecosystem.

## Requirements

### Validated

- ✓ Query tab with SOQL editor, column metadata, subquery support — existing
- ✓ Apex tab with anonymous execution and debug log retrieval — existing
- ✓ REST API tab with Monaco editors for request/response — existing
- ✓ Events tab with gRPC/CometD streaming via local proxy — existing
- ✓ Utils tab with debug logs, flow cleanup tools — existing
- ✓ Record Viewer standalone tool — existing
- ✓ Schema Browser standalone tool with formula editing — existing
- ✓ Multi-connection OAuth with per-connection Client IDs — existing
- ✓ Local proxy for CORS bypass and streaming — existing
- ✓ Side panel and tab modes — existing
- ✓ Responsive nav with overflow dropdown — existing

### Active

- [ ] Install SLDS icons npm package
- [ ] Create reusable icon component/utility for SLDS icons
- [ ] Replace all existing icons with SLDS equivalents
- [ ] Ensure only used icons are included in bundle (tree-shaking)

### Out of Scope

- Icon animations or hover transitions — not needed for v1
- Dark mode icon variants — single color scheme for now

## Context

sftools already uses a Salesforce Lightning-inspired design with CSS variables for theming. The current icons are inconsistent and don't match the Lightning aesthetic. SLDS icons will provide:
- Official Salesforce iconography
- Consistent sizing and styling
- Future-proof icon set as new tools are added

Existing icon locations to audit:
- Header: Open Org, Open in Tab, connection selector
- Tab navigation
- Query tab: Execute, history, export buttons
- Apex tab: Execute, clear, log toggle
- REST API tab: Send, clear, method selector
- Events tab: Subscribe/unsubscribe, clear
- Utils tools: Various action buttons
- Record Viewer: Save, refresh
- Schema Browser: Object list, field actions

## Constraints

- **Bundle size**: Include only icons actually used — no full icon sprite
- **Offline**: Must work without CDN or external loading (Chrome extension requirement)
- **Tech stack**: Vite build system, Web Components without Shadow DOM

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use SLDS npm package | Official Salesforce icons, user's preference | — Pending |
| Tree-shake unused icons | Minimize bundle size constraint | — Pending |

---
*Last updated: 2026-01-15 after initialization*
