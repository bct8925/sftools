---
title: Vault Gap Analysis - 2026-02-28
type: project
category: meta
tags:
  - vault/meta
  - gap-analysis
  - documentation-review
aliases:
  - gap-analysis
  - vault-review
created: 2026-02-08
updated: 2026-02-28
status: active
related-code:
  - src/api/soql-autocomplete.ts
  - src/components/script-list/ScriptList.tsx
  - src/components/debug-logs/DebugLogsTab.tsx
  - .github/workflows/
  - vitest.config.browser.ts
  - scripts/dead-code.sh
confidence: high
---

# Vault Gap Analysis

Comprehensive review of vault documentation coverage compared to actual codebase, identifying missing entries, incomplete documentation, and priorities for future documentation work.

## Review Summary

- **Review Date**: 2026-02-28
- **Previous Review**: 2026-02-08
- **Vault Entries**: ~44 entries (up from 34)
- **Overall Coverage**: ~95% of major features documented
- **Method**: Manual comparison of vault entries against dora file index and previously identified gaps

## Resolved Gaps (Since Feb 8)

All critical gaps and most moderate gaps from the February 8 analysis have been addressed.

### Previously Critical - Now Resolved

| Gap | Entry Created |
|-----|--------------|
| SOQL Autocomplete feature | [[soql-autocomplete]] |
| Debug Logs Viewer feature | [[debug-logs-viewer]] |
| Script List Component architecture | [[script-list-component]] |
| CI/CD Pipeline config | [[ci-cd-pipeline]] |
| ADR-001 through ADR-005 | All five decision records created |
| Chrome Native Messaging domain concept | [[chrome-native-messaging]] |
| SOQL domain concept | [[soql]] |

### Previously Moderate - Now Resolved

- Browser test configuration expanded in [[testing]]
- Testing patterns and mock strategies expanded in [[testing]]
- Build system internals expanded in [[environment]]

### New Entries (This Session)

- [[toast-notification]] - Global toast notification system replacing per-feature status badges
- [[collapsible-card]] - Collapsible card UI pattern used on home screen
- [[home-screen-navigation]] - Home screen layout and navigation pattern

## Remaining Gaps

### MEDIUM: Settings and Connections Entry May Be Stale

**Status**: Potentially outdated
**Priority**: MEDIUM
**Entry**: [[settings-and-connections]]

The `ConnectionSelector` component moved from the settings tab into the extension header during the home screen redesign. The [[settings-and-connections]] entry may still describe the old layout where connection switching lived in a settings panel. The entry should be reviewed and updated to reflect that connection selection is now a persistent header control, not a settings-only interaction.

### LOW: Dead-Code Tooling Not Reflected in Config Docs

**Status**: Missing detail
**Priority**: LOW
**Entry**: [[environment]] or `vault/project/config/`

The `scripts/dead-code.sh` script and the `npm run dead-code` / `npm run dead-code -- --all` commands are documented in CLAUDE.md but have no corresponding vault entry. The [[environment]] entry covers build and test commands but does not mention dead-code analysis tooling. A brief section in [[environment]] would close this gap without requiring a new entry.

### LOW: SOQL Autocomplete API Entry Missing

**Status**: Missing
**Priority**: LOW
**Entry**: `vault/project/apis/soql-autocomplete-api.md`

The [[soql-autocomplete]] feature entry was created, but the companion API entry documenting the exports and Monaco provider integration surface of `src/api/soql-autocomplete.ts` was not created. The [[apis/_index|APIs index]] shows 1 of 2 planned API entries present. Given the feature entry already covers the key concepts, this is low priority.

## Coverage Metrics

| Category | Documented | Total | Coverage | Status |
|----------|-----------|-------|----------|--------|
| **Features** | 10 | 10 | 100% | Complete |
| **Architecture** | 8 | 8 | 100% | Complete |
| **APIs** | 1 | 2 | 50% | Acceptable |
| **Domain Concepts** | 4 | 4 | 100% | Complete |
| **Domain Technologies** | 6 | 6 | 100% | Complete |
| **Domain Patterns** | 5 | 5 | 100% | Complete |
| **Decision Records** | 5 | 5 | 100% | Complete |
| **Configuration** | 3 | 3 | 100% | Complete |

**Overall Assessment**: The vault has reached near-complete coverage of all major categories. The only substantive gap is a potentially stale [[settings-and-connections]] entry following the connection selector UI change. The missing SOQL Autocomplete API entry and dead-code tooling documentation are low-priority incremental improvements.

## Recommendations

1. **Review [[settings-and-connections]]** - Verify the entry correctly describes `ConnectionSelector` as a header control, not a settings-tab control. Update any screenshots descriptions or workflow text that assumes the old placement.

2. **Add dead-code tooling to [[environment]]** - Add a short section documenting `npm run dead-code` and its `--all` flag alongside the existing build and test command documentation.

3. **Create `soql-autocomplete-api.md`** - Low priority, but would complete the APIs category to 100%. Use the api-entry template; link to [[soql-autocomplete]] and [[monaco-editor]].

4. **Schedule next quarterly review** - Recommended after the next major feature addition or by 2026-05-28, whichever comes first.

## Methodology Notes

This analysis was conducted using:

1. **Previous gap analysis** (2026-02-08) as the baseline
2. **Vault entry enumeration** — counting entries across all category directories
3. **Manual cross-reference** — comparing resolved gaps against the February list
4. **Index file review** — checking `_index.md` files for current entry lists

## Next Review

**Recommended**: 2026-05-28 (quarterly) or after the next major feature addition.

**Triggers for ad-hoc review**:
- New major feature added (1000+ lines of code)
- Architectural refactoring affecting multiple entries
- New developer onboarding feedback
- Technology stack changes

## Related

- [[project/_index|Project Knowledge Index]]
- [[overview|System Architecture Overview]]
- [[testing|Testing Framework]]
- [[environment|Environment Configuration]]
- [[settings-and-connections|Settings and Connections]]

## Notes

The vault is a living document that should evolve with the codebase. The goal is not 100% coverage of every utility and configuration detail, but comprehensive coverage of:

1. **All user-facing features** (so users know what exists)
2. **All architectural patterns** (so developers know how to extend)
3. **All major decisions** (so context is preserved)
4. **All integration points** (so APIs are understood)

Utility functions, implementation details, and standard tooling can have lighter coverage.
