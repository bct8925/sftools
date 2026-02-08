---
title: Monaco Editor
type: domain
category: technologies
tags:
  - monaco
  - editor
  - code-editor
aliases:
  - Monaco
created: 2026-02-08
updated: 2026-02-08
status: active
confidence: medium
---

# Monaco Editor

## What Is It?

Monaco Editor is the code editor that powers VS Code, used in sftools for SOQL query editing, Apex code editing, and REST API request bodies. Integrated via `@monaco-editor/react` (v4.7) and `monaco-editor` (v0.55).

## How It Works

- Wrapper component in `src/components/monaco-editor/`
- Custom language support for SOQL via `src/lib/monaco-custom.js`
- SOQL autocomplete via `src/api/soql-autocomplete.ts`
- Used in Query Editor, Apex Editor, and REST API Explorer

## Key Principles

- Custom themes matching sftools dark/light modes
- Language-specific autocomplete and syntax highlighting
- Lazy-loaded for performance

## Resources

- [Monaco Editor GitHub](https://github.com/microsoft/monaco-editor)
- [@monaco-editor/react](https://github.com/suren-atoyan/monaco-react)
