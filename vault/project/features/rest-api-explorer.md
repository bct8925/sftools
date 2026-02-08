---
title: REST API Explorer
type: project
category: features
tags:
  - feature
  - rest-api
  - explorer
  - http-methods
  - json
aliases:
  - REST Tab
created: 2026-02-08
updated: 2026-02-08
status: active
related-code:
  - src/components/rest-api/RestApiTab.tsx
  - src/api/salesforce.ts
  - src/lib/rest-api-utils.ts
confidence: high
---

# REST API Explorer

## Overview

The REST API tab provides a raw REST explorer for making arbitrary Salesforce API calls. Uses [[monaco-editor|Monaco Editor]] (`json` mode) for request body editing and response display.

## How It Works

- URL input with method selector (GET, POST, PATCH, PUT, DELETE)
- Monaco editor for JSON request body
- `executeRestRequest(path, method, body)` returns raw response with status
- Response displayed in Monaco editor (read-only, JSON formatted)
- Shows HTTP status, success/error indication

## Key Files

- `src/components/rest-api/RestApiTab.tsx` — Main component
- `src/api/salesforce.ts` — `executeRestRequest`
- `src/lib/rest-api-utils.ts` — `buildRequestUrl`, `parseResponse`

## Related

- [[overview|System Architecture Overview]]
- [[salesforce-api-client|Salesforce API Client]]
- [[monaco-editor|Monaco Editor]]
- [[salesforce-apis|Salesforce APIs]]
- [[utility-libraries|Utility Libraries]]
- [[typescript-types|TypeScript Type Definitions]]
