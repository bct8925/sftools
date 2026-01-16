# Roadmap: sftools SLDS Icons

## Overview

Replace all icons in the sftools Chrome Extension with SLDS icons for visual consistency with Salesforce Lightning. This involves installing the SLDS npm package, creating a reusable icon utility, systematically replacing all existing icons, and verifying bundle size meets constraints.

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Foundation** - Install SLDS package, create icon component/utility
- [ ] **Phase 2: Icon Replacement** - Replace all icons across extension
- [ ] **Phase 3: Verification** - Test bundle size, clean up

## Phase Details

### Phase 1: Foundation
**Goal**: Set up SLDS icons infrastructure with reusable icon utility
**Depends on**: Nothing (first phase)
**Research**: Likely (new npm package)
**Research topics**: SLDS npm package API, import patterns, Vite tree-shaking compatibility
**Plans**: TBD

Plans:
- [x] 01-01: Install SLDS package and configure Vite
- [ ] 01-02: Create reusable icon component/utility

### Phase 2: Icon Replacement
**Goal**: Replace all existing icons with SLDS equivalents
**Depends on**: Phase 1
**Research**: Unlikely (internal pattern matching)
**Plans**: TBD

Plans:
- [ ] 02-01: Audit all existing icons and map to SLDS equivalents
- [ ] 02-02: Replace icons in header and navigation
- [ ] 02-03: Replace icons in tool tabs and standalone pages

### Phase 3: Verification
**Goal**: Verify bundle size and clean up any old icon assets
**Depends on**: Phase 2
**Research**: Unlikely (testing and cleanup)
**Plans**: TBD

Plans:
- [ ] 03-01: Verify bundle size and tree-shaking, remove old assets

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/2 | In progress | - |
| 2. Icon Replacement | 0/3 | Not started | - |
| 3. Verification | 0/1 | Not started | - |
