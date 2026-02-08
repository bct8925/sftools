---
title: Vault Gap Analysis - 2026-02-08
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
updated: 2026-02-08
status: active
related-code:
  - src/api/soql-autocomplete.ts
  - src/components/script-list/ScriptList.tsx
  - src/components/debug-logs/DebugLogsTab.tsx
  - .github/workflows/
  - vitest.config.browser.ts
confidence: high
---

# Vault Gap Analysis

Comprehensive review of vault documentation coverage compared to actual codebase, identifying missing entries, incomplete documentation, and priorities for future documentation work.

## Review Summary

- **Review Date**: 2026-02-08
- **Codebase Files**: 101 indexed files, 20,097 symbols (via dora)
- **Vault Entries**: 34 entries (25 project, 9 domain)
- **Overall Coverage**: ~75% of major features documented
- **Method**: Manual comparison of vault entries against dora file index and symbol catalog

## Critical Gaps

These represent major features or architectural components that are completely missing from the vault and should be documented immediately.

### 1. SOQL Autocomplete

**Status**: Missing
**Priority**: HIGH
**Reason**: Core feature of Query Editor with sophisticated implementation

**Details**:
- File: `src/api/soql-autocomplete.ts` (577 lines, 195 symbols)
- Sophisticated autocomplete system with context-aware suggestions
- Features:
  - Keyword suggestions (SELECT, FROM, WHERE, ORDER BY, GROUP BY, etc.)
  - Field completion with type-specific icons
  - Relationship traversal (e.g., Account.Owner.Name)
  - Aggregate functions (COUNT, SUM, AVG, MIN, MAX)
  - Date literals (YESTERDAY, THIS_MONTH, LAST_90_DAYS, etc.)
  - Context-aware filtering based on current SOQL clause
  - Monaco editor integration with completion provider
- Currently referenced in [[query-editor]] but deserves dedicated documentation
- Should be documented as both:
  - **Feature entry**: `vault/project/features/soql-autocomplete.md`
  - **API entry**: `vault/project/apis/soql-autocomplete-api.md`

**Impact**: This is arguably the most sophisticated feature in the Query Editor and is completely undocumented. New developers would have no way to understand how it works.

### 2. Script List Component

**Status**: Missing
**Priority**: HIGH
**Reason**: Reusable shared component pattern used across multiple features

**Details**:
- Files: `src/components/script-list/ScriptList.tsx`, `FavoriteModal.tsx`
- Generic reusable component for managing history and favorites
- Used by Query Editor, Apex Executor, and REST API Explorer tabs
- Features:
  - History tracking (most recent executions)
  - Favorites management (star/unstar scripts)
  - Quick load from history or favorites
  - Rename favorites with modal dialog
  - Delete history items
- Represents important reusable component pattern
- Should be documented in: `vault/project/architecture/script-list-component.md`

**Impact**: This is a key shared component that demonstrates code reuse across features. Missing documentation means developers won't know this pattern exists.

### 3. Debug Logs Tab

**Status**: Partially documented (only mentioned in [[utility-tools]])
**Priority**: HIGH
**Reason**: Standalone feature with significant functionality

**Details**:
- Files: `src/components/debug-logs/DebugLogsTab.tsx`, `DebugLogsSettingsModal.tsx`
- Full debug log viewer with:
  - Log list with timestamps, users, operations, status
  - Log body viewer (raw text display)
  - Auto-refresh capability
  - Filtering by user and date range
  - Settings persistence
- Currently buried in [[utility-tools]] which undersells its complexity
- Should be elevated to: `vault/project/features/debug-logs-viewer.md`

**Impact**: This is a full-featured tool that deserves its own documentation entry, not a bullet point in "utility tools".

### 4. CI/CD Pipeline

**Status**: Missing
**Priority**: HIGH
**Reason**: Critical for understanding deployment and release process

**Details**:
- Files:
  - `.github/workflows/build-and-test.yml` - PR checks (test, lint, typecheck)
  - `.github/workflows/build-package.yml` - Production build and release
  - `.github/workflows/claude-code-review.yml` - Automated code review
  - `.github/workflows/claude.yml` - Claude integration
- Automated testing on every PR
- Production packaging with ZIP artifact creation
- Release automation
- Claude Code integration for AI-assisted review
- No documentation in [[environment]] or [[testing]]
- Should be documented in: `vault/project/config/ci-cd-pipeline.md`

**Impact**: New contributors have no visibility into how code gets from PR to production.

## Moderate Gaps

These represent important but less critical missing documentation.

### 5. Browser Test Configuration

**Status**: Partially documented
**Priority**: MEDIUM
**Reason**: [[testing]] mentions Playwright but not the Vitest browser mode setup

**Details**:
- File: `vitest.config.browser.ts`
- Separate Vitest config for browser-based tests
- Uses Playwright provider
- Different from frontend integration tests
- Extension environment simulation
- Currently [[testing]] only covers high-level framework
- Should expand [[testing]] to include browser test setup section

**Impact**: Developers won't understand the difference between unit, browser, and frontend tests.

### 6. Testing Patterns and Mocks

**Status**: Partially documented
**Priority**: MEDIUM
**Reason**: 82 test files with established patterns not captured in [[testing]]

**Details**:
- Mock strategies:
  - Chrome API mocking (chrome.storage, chrome.runtime, chrome.tabs)
  - Salesforce API mocking (fetch interception)
  - Monaco editor mocking
- Test fixtures and helpers in `tests/` directory
- Setup and teardown patterns
- Async testing patterns
- Should expand [[testing]] to include testing patterns section

**Impact**: Developers have to learn patterns from reading existing tests rather than documentation.

### 7. Build System Details

**Status**: Partially documented
**Priority**: MEDIUM
**Reason**: [[environment]] covers commands but not build internals

**Details**:
- Vite configuration with multi-entry rollup
- Production vs development builds (`SFTOOLS_PRODUCTION` env var)
- Extension packaging (ZIP creation with proxy inclusion)
- Source map handling
- Asset optimization
- Tree shaking and code splitting
- Should expand [[environment]] to include build system section

**Impact**: Developers modifying build config have no reference documentation.

### 8. Chrome Native Messaging Protocol

**Status**: Referenced but not explained
**Priority**: MEDIUM
**Reason**: Core concept for proxy communication not documented as domain knowledge

**Details**:
- Used for extension-to-proxy communication
- Part of Chrome Extension MV3 architecture
- Message format and protocol
- Host manifest configuration
- Security model
- Currently mentioned in [[background-service-worker]] and [[native-proxy]]
- Should be documented in: `vault/domain/concepts/chrome-native-messaging.md`

**Impact**: Developers won't understand the proxy communication layer without reading code.

## Minor Gaps

These are less critical but would improve vault completeness.

### 9. SOQL Domain Concept

**Status**: Missing
**Priority**: LOW
**Reason**: Core Salesforce concept assumed as knowledge

**Details**:
- Salesforce Object Query Language fundamentals
- SOQL syntax overview
- Relationship queries (dot notation)
- Aggregate functions
- Date literals and functions
- SOQL vs SQL differences
- Referenced throughout codebase
- Should be documented in: `vault/domain/concepts/soql.md`

**Impact**: Low - most developers working on this project already know SOQL. However, completeness would benefit from this entry.

### 10. Code Quality Tools

**Status**: Mentioned but not documented
**Priority**: LOW
**Reason**: ESLint and Prettier are standard tools

**Details**:
- ESLint configuration and rules
- Prettier formatting standards
- Integration with VS Code
- Pre-commit hooks potential
- Currently referenced in [[environment]] but no deep dive
- Could be documented in: `vault/domain/technologies/eslint.md` and `vault/domain/technologies/prettier.md`

**Impact**: Low priority - tooling is standard and self-documenting through config files.

### 11. Utility Library Completeness

**Status**: Incomplete
**Priority**: LOW
**Reason**: [[utility-libraries]] missing several lib/ files

**Details**:
Missing from current documentation:
- `src/lib/events-utils.ts` - Platform Event and CDC utilities
- `src/lib/rest-api-utils.ts` - REST API helper functions
- `src/lib/text-utils.ts` - String manipulation utilities
- `src/lib/value-utils.ts` - Value formatting and parsing
- `src/lib/ui-helpers.ts` - UI helper functions

**Impact**: Low - these are smaller utility files. Current coverage of major utilities is adequate.

### 12. Vault Meta-Documentation

**Status**: Missing
**Priority**: LOW
**Reason**: Self-referential but useful for onboarding

**Details**:
- Explanation of vault structure
- Wikilink syntax and conventions
- Frontmatter fields and meaning
- Tag taxonomy
- Index file purpose
- How to contribute to vault
- Should be documented in: `vault/domain/patterns/obsidian-vault-knowledge-management.md`

**Impact**: Low - Claude Code already knows these conventions. Would help human readers using Obsidian.

## Incomplete Existing Entries

These entries exist but need expansion or correction.

### [[query-editor]]

**Issues**:
- No mention of SOQL autocomplete feature
- Incomplete coverage of the most complex feature
- Missing wikilink to (future) [[soql-autocomplete]]

**Recommended Updates**:
- Add "SOQL Autocomplete" section
- Link to [[soql-autocomplete]] (once created)
- Add to related-code: `src/api/soql-autocomplete.ts`

### [[testing]]

**Issues**:
- Missing browser test configuration details
- No documentation of mock strategies
- No test patterns or best practices
- Only covers high-level framework setup

**Recommended Updates**:
- Add "Browser Test Configuration" section
- Add "Testing Patterns" section with mocking examples
- Add "Test Organization" section explaining fixtures and helpers
- Expand related-code to include test setup files

### [[utility-libraries]]

**Issues**:
- Missing several lib/ utility files (see gap #11)
- Incomplete catalog of available utilities

**Recommended Updates**:
- Add missing utility files to documentation
- Consider splitting into subsections by utility type
- Add usage examples for each major utility

### [[utility-tools]]

**Issues**:
- Debug Logs feature deserves elevation to dedicated entry
- Undersells complexity of debug log viewer

**Recommended Updates**:
- Extract Debug Logs to separate feature entry
- Keep Flow Cleanup Tool in utility-tools
- Update to reference [[debug-logs-viewer]]

### [[environment]]

**Issues**:
- Missing CI/CD pipeline documentation
- Missing detailed build system explanation
- Only covers CLI commands, not system architecture

**Recommended Updates**:
- Add "CI/CD Pipeline" section or create separate entry
- Add "Build System Architecture" section
- Expand on production vs development builds

## Missing Decision Records

The `vault/project/decisions/` category is empty, but the codebase shows several architectural decisions that should be documented as Architecture Decision Records (ADRs).

### Recommended Decision Records

1. **ADR-001: Monaco Editor Selection**
   - Decision: Use Monaco Editor over CodeMirror
   - Rationale: TypeScript/IntelliSense support, VS Code compatibility, SOQL autocomplete needs
   - File: `vault/project/decisions/adr-001-monaco-editor.md`

2. **ADR-002: Native Proxy Architecture**
   - Decision: Use separate Node.js proxy for streaming vs in-extension
   - Rationale: gRPC/CometD support, CORS bypass, WebSocket limitations in MV3
   - File: `vault/project/decisions/adr-002-native-proxy.md`

3. **ADR-003: OAuth Flow Selection**
   - Decision: Use OAuth 2.0 implicit flow vs authorization code
   - Rationale: Chrome extension constraints, security model, token handling
   - File: `vault/project/decisions/adr-003-oauth-implicit-flow.md`

4. **ADR-004: CSS Modules Over Styled Components**
   - Decision: Use CSS Modules vs styled-components/CSS-in-JS
   - Rationale: Performance, simplicity, CSS variable integration
   - File: `vault/project/decisions/adr-004-css-modules.md`

5. **ADR-005: Vitest Over Jest**
   - Decision: Use Vitest as test framework vs Jest
   - Rationale: Vite integration, ESM support, speed, browser test mode
   - File: `vault/project/decisions/adr-005-vitest-testing.md`

**Impact**: Decision records provide historical context and prevent relitigating past decisions. Essential for long-term project health.

## Recommendations

### Immediate (Next Session)

Priority order for addressing critical gaps:

1. **Create [[soql-autocomplete]] feature entry**
   - Template: feature-entry.md
   - Links: [[query-editor]], [[monaco-editor]], [[salesforce-api-client]]
   - Document: completion provider, keyword/field/function suggestions, context awareness

2. **Create [[soql]] domain concept entry**
   - Template: domain-concept.md
   - Links: [[salesforce-apis]], [[query-editor]]
   - Document: SOQL fundamentals, syntax, relationship queries

3. **Expand [[query-editor]] to reference autocomplete**
   - Add "SOQL Autocomplete" section
   - Add wikilink to [[soql-autocomplete]]
   - Update related-code list

4. **Create [[soql-autocomplete-api]] API entry**
   - Template: api-entry.md
   - Document: exports, Monaco provider integration, API surface
   - Links: [[soql-autocomplete]], [[monaco-editor]]

### Short-term (This Week)

5. **Create [[script-list-component]] architecture entry**
   - Document reusable history/favorites pattern
   - Links: [[query-editor]], [[apex-executor]], [[rest-api-explorer]]

6. **Elevate [[debug-logs-viewer]] to feature entry**
   - Extract from [[utility-tools]]
   - Document as standalone feature
   - Update [[utility-tools]] to reference it

7. **Create [[ci-cd-pipeline]] config entry**
   - Document GitHub Actions workflows
   - Build, test, package, release automation
   - Claude integration

8. **Create ADR-001 through ADR-005**
   - Document architectural decisions
   - Use decision-record.md template
   - Populate decisions/ category

### Medium-term (This Month)

9. **Expand [[testing]] entry**
   - Add browser test configuration section
   - Add testing patterns and mocking strategies
   - Add test organization explanation

10. **Expand [[environment]] entry**
    - Add build system architecture section
    - Detail production vs development builds
    - Document packaging process

11. **Create [[chrome-native-messaging]] domain concept**
    - Document native messaging protocol
    - Explain extension-to-proxy communication
    - Security and configuration

12. **Complete [[utility-libraries]] entry**
    - Add missing utility files
    - Organize by utility type
    - Add usage examples

### Long-term (Ongoing)

13. **Maintain vault-code alignment**
    - Review vault after each major feature addition
    - Update entries when code changes significantly
    - Keep related-code lists current

14. **Add domain technology entries**
    - ESLint configuration (low priority)
    - Prettier formatting (low priority)

15. **Create vault meta-documentation**
    - Document vault structure and conventions
    - Help human readers using Obsidian
    - Onboarding guide for vault contributors

16. **Quarterly vault reviews**
    - Run dora symbol count vs documented features
    - Check for orphaned entries (code removed but docs remain)
    - Update gap analysis document

## Coverage Metrics

Based on this analysis:

| Category | Documented | Identified | Coverage | Status |
|----------|-----------|------------|----------|--------|
| **Features** | 8 | 11 | 73% | Good |
| **Architecture** | 8 | 11 | 73% | Good |
| **APIs** | 1 | 2 | 50% | Needs Work |
| **Domain Concepts** | 2 | 5 | 40% | Needs Work |
| **Domain Technologies** | 6 | 8 | 75% | Good |
| **Domain Patterns** | 1 | 2 | 50% | Acceptable |
| **Decision Records** | 0 | 5 | 0% | Critical Gap |
| **Configuration** | 2 | 3 | 67% | Acceptable |

**Overall Assessment**: The vault provides solid coverage of major features and architecture (70-75%), but has critical gaps in decision records (0%), APIs (50%), and domain concepts (40%). The immediate focus should be on SOQL autocomplete documentation and creating foundational ADRs.

## Methodology Notes

This analysis was conducted using:

1. **dora file index** - List of all source files (101 files)
2. **dora symbol catalog** - Symbol count (20,097 symbols)
3. **Manual vault review** - Reading all 34 existing entries
4. **Cross-referencing** - Comparing vault entries to actual codebase features
5. **Priority assessment** - Based on feature complexity, usage, and maintainability impact

## Next Review

**Recommended**: After next major feature implementation or monthly review (whichever comes first).

**Triggers for ad-hoc review**:
- New major feature added (1000+ lines of code)
- Architectural refactoring
- New developer onboarding feedback
- Technology stack changes

**Suggested format**: Update this document with new findings and reset "Immediate" recommendations based on what was completed.

## Related

- [[project/_index|Project Knowledge Index]]
- [[overview|System Architecture Overview]]
- [[testing|Testing Framework]]
- [[environment|Environment Configuration]]

## Notes

This gap analysis represents a point-in-time snapshot. The vault is a living document that should evolve with the codebase. The goal is not 100% coverage (which would be maintenance-heavy) but rather comprehensive coverage of:

1. **All user-facing features** (so users know what exists)
2. **All architectural patterns** (so developers know how to extend)
3. **All major decisions** (so context is preserved)
4. **All integration points** (so APIs are understood)

Utility functions, implementation details, and standard tooling can have lighter coverage.
