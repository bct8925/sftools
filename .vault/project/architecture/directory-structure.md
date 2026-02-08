---
title: Directory Structure
type: project
category: architecture
tags:
  - architecture
  - directory-layout
aliases: []
created: 2026-02-08
updated: 2026-02-08
status: active
related-code:
  - src/
confidence: medium
---

# Directory Structure

## Overview

Top-level layout of the sftools repository.

## How It Works

```
sftools/
├── src/                    # Extension source code
│   ├── api/                # Salesforce API client layer
│   │   ├── salesforce.ts   # Core API client
│   │   ├── fetch.ts        # Authenticated fetch wrapper
│   │   ├── bulk-query.ts   # Bulk API v2
│   │   ├── streaming.ts    # Event streaming
│   │   ├── cors-detection.ts
│   │   ├── debug-logs.ts
│   │   └── soql-autocomplete.ts
│   ├── auth/               # OAuth 2.0 authentication
│   ├── background/         # Service worker (MV3)
│   ├── components/         # React UI components
│   │   ├── apex/           # Anonymous Apex editor
│   │   ├── query/          # SOQL query editor
│   │   ├── rest-api/       # REST API explorer
│   │   ├── events/         # Event streaming UI
│   │   ├── schema/         # Schema browser
│   │   ├── record/         # Record viewer/editor
│   │   ├── debug-logs/     # Debug log management
│   │   ├── settings/       # Settings panel
│   │   ├── monaco-editor/  # Monaco editor wrapper
│   │   ├── modal/          # Modal dialogs
│   │   └── utils-tools/    # Utility tools
│   ├── contexts/           # React context providers
│   │   ├── ConnectionContext.tsx  # Salesforce org connection state
│   │   ├── ProxyContext.tsx       # Native proxy connection state
│   │   └── ThemeContext.tsx       # Dark/light theme state
│   ├── hooks/              # Shared React hooks
│   ├── lib/                # Utility libraries
│   ├── types/              # TypeScript type definitions
│   ├── react/              # App shell and entry points
│   ├── pages/              # HTML entry pages
│   └── public/             # Static assets
├── sftools-proxy/          # Native messaging proxy (Node.js + gRPC)
├── tests/                  # Test suites
│   ├── unit/               # Vitest unit tests
│   ├── frontend/           # Playwright browser tests
│   └── integration/        # Integration tests
├── scripts/                # Build and utility scripts
├── openspec/               # OpenSpec change management
└── test-metadata/          # Test fixtures
```

## Key Files

- `manifest.json` — Chrome extension manifest
- `vite.config.ts` — Vite build config
- `package.json` — Dependencies and scripts
- `tsconfig.json` — TypeScript config

## Related

- [[System Architecture Overview]]

## Notes

Each `src/` subdirectory has its own `CLAUDE.md` with domain-specific context and patterns.
