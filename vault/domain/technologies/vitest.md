---
title: Vitest
type: domain
category: technologies
tags:
  - vitest
  - testing
  - unit-tests
aliases: []
created: 2026-02-08
updated: 2026-02-08
status: active
confidence: medium
---

# Vitest

## What Is It?

Vitest is a Vite-native test runner used for unit testing in sftools. It shares the Vite config for fast, consistent test execution.

## How It Works

- Unit tests in `tests/unit/` — run with `npm run test:unit`
- Browser/frontend tests in `tests/frontend/` — run with `npm run test:frontend` (via `vitest.config.browser.ts`)
- Integration tests in `tests/integration/` — run with `npm run test:integration`
- Coverage via `@vitest/coverage-v8`

## Key Principles

- Tests co-located in `tests/` directory (not alongside source)
- JSDOM for unit test DOM simulation
- [[Playwright]] browser for frontend tests
- Separate config files for each test type

## Related

- [[testing|Testing Framework]]
- [[Playwright]]

## Resources

- [Vitest Documentation](https://vitest.dev)
