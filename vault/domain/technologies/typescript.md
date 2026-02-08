---
title: TypeScript
type: domain
category: technologies
tags:
  - typescript
  - type-safety
aliases:
  - TypeScript 5.9
  - TS
created: 2026-02-08
updated: 2026-02-08
status: active
confidence: medium
---

# TypeScript

## What Is It?

TypeScript is a typed superset of JavaScript. sftools uses TypeScript 5.9 for type safety across the entire codebase.

## How It Works

- Configured in `tsconfig.json`
- Type definitions in `src/types/`
- Chrome extension types via `@types/chrome`
- React types via `@types/react` and `@types/react-dom`
- Strict mode enabled for maximum type safety

## Key Principles

- All source code is TypeScript (`.ts` / `.tsx`)
- Type validation via `npm run typecheck` (uses `tsc --noEmit`)
- Types shared between components, API layer, and background worker

## Related

- [[typescript-types|TypeScript Type Definitions]]
- [[component-architecture|Component Architecture]]

## Resources

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
