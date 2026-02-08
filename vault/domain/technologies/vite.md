---
title: Vite
type: domain
category: technologies
tags:
  - vite
  - build
  - bundler
aliases:
  - Vite 7
created: 2026-02-08
updated: 2026-02-08
status: active
confidence: medium
---

# Vite

## What Is It?

Vite is a fast build tool and dev server. sftools uses Vite 7 with the `@vitejs/plugin-react` plugin to bundle the Chrome extension.

## How It Works

- Configured in `vite.config.ts`
- Builds multiple entry points (DevTools panel, background service worker, content scripts)
- `SFTOOLS_PRODUCTION` env var controls debug mode
- Production build used for Chrome Web Store packaging (`npm run package`)

## Key Principles

- ESM-first module system (`"type": "module"` in package.json)
- Fast HMR in development via `npm run watch`
- Tree-shaking and code splitting for production

## Related

- [[environment|Environment Configuration]]
- [[testing|Testing Framework]]

## Resources

- [Vite Documentation](https://vitejs.dev)
