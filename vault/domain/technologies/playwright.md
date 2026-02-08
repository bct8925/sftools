---
title: Playwright
type: domain
category: technologies
tags:
  - playwright
  - testing
  - e2e
  - frontend-tests
aliases: []
created: 2026-02-08
updated: 2026-02-08
status: active
confidence: medium
---

# Playwright

## What Is It?

Playwright is a browser automation framework used in sftools for frontend/browser testing. It provides real browser environments for testing UI components.

## How It Works

- Frontend tests in `tests/frontend/` use Playwright's browser provider via [[Vitest]]
- Configured in `vitest.config.browser.ts`
- Tests run headless by default
- Can filter by file name or test name pattern

## Key Principles

- Real browser rendering (not JSDOM) for accurate UI testing
- Headless execution for CI
- Integrated with Vitest test runner

## Resources

- [Playwright Documentation](https://playwright.dev)
