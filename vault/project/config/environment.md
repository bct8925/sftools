---
title: Environment Configuration
type: project
category: config
tags:
  - config
  - build
  - vite
aliases:
  - Build Config
created: 2026-02-08
updated: 2026-02-08
status: active
related-code:
  - vite.config.ts
  - package.json
  - tsconfig.json
confidence: medium
---

# Environment Configuration

## Overview

Build and environment configuration for the sftools Chrome extension.

## How It Works

### Build System

Uses [[Vite]] 7 with React plugin for bundling.

| Command | Purpose |
|---------|---------|
| `npm run build` | Dev build (debug mode, `SFTOOLS_PRODUCTION=false`) |
| `npm run watch` | Dev build with file watching |
| `npm run package` | Production build + zip archive |
| `npm run typecheck` | TypeScript validation only |

### Code Quality

| Command | Purpose |
|---------|---------|
| `npm run validate` | Auto-fix + full check (lint, format, typecheck) |
| `npm run check` | Check only (no fix) |
| `npm run fix` | Auto-fix lint + format only |

### Testing

| Command | Purpose |
|---------|---------|
| `npm run test:unit` | [[Vitest]] unit tests |
| `npm run test:frontend` | [[Playwright]] browser tests |
| `npm run test:integration` | Integration tests |
| `npm run test:unit:coverage` | Unit tests with coverage |

### Environment Variables

- `SFTOOLS_PRODUCTION` — Controls debug mode in builds (`true`/`false`)
- `.env.test` — Integration test credentials (gitignored, never committed)

### CI/CD Pipeline

See [[ci-cd-pipeline|CI/CD Pipeline]] for full documentation.

**Summary of workflows:**

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| Build & Test | PR events | Unit tests → Frontend tests → Build → Upload artifact |
| Build Package | Push to main | Production build + Claude-generated release notes |
| Claude Code Review | PR events | AI-powered code review with inline comments |

All workflows run on a self-hosted runner. Test results are posted as PR comments. The Build Package workflow uses Claude Code CLI to generate release notes.

**Secrets required:**
- `GITHUB_TOKEN` — Auto-provided by GitHub Actions
- `CLAUDE_CODE_OAUTH_TOKEN` — Claude Code authentication

## Key Files

- `vite.config.ts` — Main build configuration
- `vitest.config.browser.ts` — Browser test configuration
- `vitest.config.integration.ts` — Integration test configuration
- `tsconfig.json` — TypeScript compiler options
- `eslint.config.js` — ESLint configuration
- `.prettierrc` — Prettier formatting rules

## Related

- [[overview|System Architecture Overview]]
- [[Vite]]
- [[Vitest]]
- [[testing|Testing Framework]]
- [[chrome-extension-mv3|Chrome Extension MV3]]
- [[ci-cd-pipeline|CI/CD Pipeline]]

## Notes

- Pre-PR check: `npm run validate && npm run test:unit && npm run test:frontend && npm run build`
- Never commit tokens, API keys, or credentials
