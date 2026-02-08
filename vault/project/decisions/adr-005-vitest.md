---
title: "ADR-005: Vitest for Testing"
type: decision
category: decisions
tags:
  - vault/project/decisions
  - adr
  - vitest
  - testing
  - vite
aliases:
  - Vitest Decision
  - Testing Framework Decision
created: 2026-02-08
updated: 2026-02-08
status: accepted
confidence: high
---

# ADR-005: Vitest for Testing

## Status

Accepted

## Context

sftools uses Vite 7 as the build tool. The testing system must:
- Support unit tests (logic, utilities, hooks)
- Support browser tests (UI components, Chrome extension APIs)
- Support integration tests (end-to-end flows with mocked Salesforce)
- Work with TypeScript, React JSX, and CSS Modules
- Handle Chrome extension API mocks (`chrome.runtime`, `chrome.storage`, `chrome.tabs`)
- Provide fast test execution for developer workflow
- Scale to 82+ test files across three test layers

Test layers needed:
1. **Unit tests** — Fast, isolated tests for utilities, hooks, state management
2. **Browser tests** — Real browser environment for UI validation, DOM interaction
3. **Integration tests** — End-to-end flows with network mocking

## Decision

Use **Vitest** as the unified test framework across all three test layers.

### Configuration

Three Vitest configurations for different test environments:

1. **`vitest.config.ts`** — Unit tests (jsdom environment)
   - Tests in `tests/unit/**/*.test.ts`
   - Mock Chrome extension APIs
   - Fast execution with jsdom

2. **`vitest.config.browser.ts`** — Browser tests (Playwright provider)
   - Tests in `tests/frontend/**/*.test.tsx`
   - Real browser environment via Playwright
   - Tests UI components, user interactions, extension UI

3. **`vitest.config.integration.ts`** — Integration tests (Node.js environment)
   - Tests in `tests/integration/**/*.test.ts`
   - Mock Salesforce API endpoints
   - Test full request/response flows

### Key Features Used
- **Vitest browser mode** — Real browser testing with Playwright provider
- **Jest-compatible API** — `describe`, `it`, `expect`, `vi.fn()`, `vi.mock()`
- **Native ESM** — No CommonJS/ESM interop issues
- **Coverage** — `@vitest/coverage-v8` for code coverage reports
- **Shared config** — Uses Vite's transform pipeline for TypeScript, JSX, CSS Modules

## Consequences

### Positive
- **Vite integration** — Shares Vite's transform pipeline, same TypeScript/JSX/CSS Module handling as production build
- **No config duplication** — Don't need separate babel/ts-jest config for tests
- **Native ESM** — No CommonJS/ESM interop issues or transform complexity
- **Browser mode with Playwright** — Real browser testing with same test API as unit tests
- **Fast execution** — Leverages Vite dev server and module caching
- **Unified API** — Single framework for all test types, consistent patterns and utilities
- **Jest-compatible** — Familiar API for developers coming from Jest projects (`describe`, `expect`, `vi.mock`)
- **Built-in coverage** — `@vitest/coverage-v8` integrated, no extra setup

### Negative
- **Browser mode maturity** — Vitest browser mode is newer and less battle-tested than Playwright Test
- **Ecosystem gaps** — Some Jest plugins/ecosystem tools don't work with Vitest
- **Three configs** — Must maintain three separate Vitest config files for different environments
- **Playwright dependency** — Browser tests require Playwright browsers installed

## Alternatives Considered

### 1. Jest
**Pros**: Industry standard, huge ecosystem, mature and stable, battle-tested
**Cons**:
- Requires separate transform config for TypeScript/ESM/CSS Modules (babel or ts-jest)
- Doesn't share Vite config — leads to build/test environment mismatches
- No built-in browser test mode — would need Puppeteer/Playwright separately
- CommonJS by default, ESM support requires extra configuration

**Rejected**: Vite integration overhead and separate config for transforms not worth it

### 2. Playwright Test for browser + Vitest for unit
**Pros**: Playwright Test has more mature browser testing, built-in parallelization, trace viewer
**Cons**:
- Two test frameworks — two APIs, two configs, two sets of utilities
- Fragmented test commands and patterns
- Duplication in test setup/helpers

**Rejected**: Framework fragmentation outweighs Playwright Test maturity benefits

### 3. Jest + Puppeteer/Playwright
**Pros**: Traditional combo, well-documented patterns
**Cons**:
- Same Vite integration issues as Jest alone
- Two frameworks to manage
- More setup complexity

**Rejected**: Combines downsides of Jest alternative and split framework alternative

### 4. Web Test Runner
**Pros**: Designed for web components, good browser testing, modern ESM support
**Cons**:
- Less mature ecosystem than Jest/Vitest
- Doesn't share Vite pipeline
- Less familiar API for developers

**Rejected**: Less mature, doesn't leverage Vite integration

## Related

- [[Vitest]] - Domain concept covering Vitest fundamentals
- [[testing]] - Testing framework overview and architecture
- [[Playwright]] - Browser automation used for Vitest browser mode
- [[Vite]] - Build tool that Vitest integrates with
- [[environment]] - Environment configuration including test setup
