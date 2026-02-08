---
title: React
type: domain
category: technologies
tags:
  - react
  - frontend
  - ui
aliases:
  - React 19
created: 2026-02-08
updated: 2026-02-08
status: active
confidence: medium
---

# React

## What Is It?

React is a JavaScript library for building user interfaces. sftools uses React 19 for all UI rendering within the Chrome DevTools panel.

## How It Works

- Components in `src/components/` organized by feature (query, apex, schema, etc.)
- State management via React Context providers in `src/contexts/`:
  - `ConnectionContext` — Salesforce org connection state
  - `ProxyContext` — Native proxy connection state
  - `ThemeContext` — Dark/light theme
- Custom hooks in `src/hooks/` for shared logic
- Monaco Editor integration via `@monaco-editor/react`

## Key Principles

- Functional components with hooks
- Context-based state management (no external state library)
- Component-per-feature directory structure

## Resources

- [React Documentation](https://react.dev)
