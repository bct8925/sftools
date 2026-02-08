---
title: "ADR-001: Monaco Editor for Code Editing"
type: decision
category: decisions
tags:
  - vault/project/decisions
  - adr
  - monaco
  - editor
aliases:
  - Monaco Decision
created: 2026-02-08
updated: 2026-02-08
status: accepted
confidence: high
---

# ADR-001: Monaco Editor for Code Editing

## Status

Accepted

## Context

sftools needs an in-browser code editor for SOQL queries, Apex code, JSON payloads, and debug log viewing. The editor must support:
- Syntax highlighting for multiple languages (SQL, Apex, JSON)
- Custom autocomplete provider (for SOQL field completion)
- Error markers (compilation errors from Apex)
- Read-only mode (for debug log viewing)
- Dark/light theme support
- Performance with large content (debug logs can be megabytes)

## Decision

Use Monaco Editor (the editor that powers VS Code) via `@monaco-editor/react`.

### Rationale

1. **Custom completion providers** — Monaco's `registerCompletionItemProvider` API enables the sophisticated SOQL autocomplete system with trigger characters, async resolution, and rich suggestion types
2. **Language support** — Built-in support for SQL (SOQL), JSON, and extensible for Apex highlighting
3. **Error markers** — Native `setModelMarkers` API for showing Apex compilation errors inline
4. **Performance** — Web worker-based architecture handles large debug logs efficiently
5. **Theme system** — `defineTheme` API integrates with the extension's dark/light mode
6. **Imperative control** — Ref-based API (`getValue`, `setValue`, `appendValue`) for programmatic editor control
7. **VS Code familiarity** — Users (Salesforce developers) likely already know VS Code keybindings

## Consequences

### Positive
- Rich editing experience comparable to VS Code
- SOQL autocomplete with field types, relationships, aggregate functions
- Error highlighting for Apex compilation issues
- Consistent theme integration via custom Monaco themes

### Negative
- Large bundle size (~2MB for Monaco)
- Complexity of React wrapper component (`MonacoEditor.tsx`)
- Must manage editor lifecycle (mount/unmount) carefully in Chrome extension context
- Monaco's SQL language mode used as base for SOQL (not a perfect match)

## Alternatives Considered

### CodeMirror 6
- Lighter weight (~200KB)
- Good plugin ecosystem
- Weaker completion provider API — would require more custom code for SOQL autocomplete
- Less familiar to VS Code users
- Rejected due to weaker completion API for the SOQL use case

### Ace Editor
- Mature and stable
- Smaller than Monaco
- Lacks the rich completion provider API needed for SOQL autocomplete
- Less active development compared to Monaco/CodeMirror
- Rejected due to limited completion capabilities

### Textarea + syntax highlighting library
- Minimal bundle size
- No editor features (autocomplete, markers, keybindings)
- Rejected as insufficient for the developer-tool use case
