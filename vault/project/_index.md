---
title: Project Knowledge
type: index
category: project
tags:
  - vault/index
  - vault/project
created: 2026-02-08
updated: 2026-02-08
---

# Project Knowledge

Implementation-specific knowledge about this codebase.

## Categories

- [[project/architecture/_index|Architecture]] - System design, tech stack, directory layout
- [[project/features/_index|Features]] - Feature-by-feature documentation
- [[project/apis/_index|APIs]] - API contracts and endpoints
- [[project/data-models/_index|Data Models]] - Schemas, entities, relationships
- [[project/config/_index|Configuration]] - Environment, build, CI/CD
- [[project/decisions/_index|Decisions]] - Architecture Decision Records
- [[project/meta/_index|Meta]] - Vault maintenance and documentation

## Entries

### Architecture (8)
- [[overview|System Architecture Overview]] - High-level architecture, communication flow, page/tab structure
- [[directory-structure|Directory Structure]] - Repository layout and directory purposes
- [[component-architecture|Component Architecture]] - React component patterns, CSS Modules, Monaco editor wrapper
- [[state-management|State Management]] - React Context providers (Connection, Theme, Proxy)
- [[background-service-worker|Background Service Worker]] - Message routing, OAuth tokens, native messaging
- [[authentication-oauth|Authentication and OAuth]] - Multi-org OAuth, CSRF protection, token refresh
- [[native-proxy|Native Proxy]] - Node.js proxy for gRPC streaming, CometD, CORS bypass
- [[utility-libraries|Utility Libraries]] - Shared TypeScript utilities in src/lib/

### Features (8)
- [[query-editor|Query Editor]] - SOQL editor with Monaco, tabbed results, bulk export
- [[apex-executor|Apex Executor]] - Anonymous Apex execution with debug log retrieval
- [[rest-api-explorer|REST API Explorer]] - Raw REST API calls with Monaco JSON editor
- [[event-streaming|Event Streaming]] - Platform Events, CDC, PushTopics (requires proxy)
- [[schema-browser|Schema Browser]] - Standalone object metadata browser
- [[record-viewer|Record Viewer]] - Standalone record viewer/editor
- [[utility-tools|Utility Tools]] - Debug log management, flow cleanup
- [[settings-and-connections|Settings and Connections]] - Multi-org management, theme, proxy config

### APIs (1)
- [[salesforce-api-client|Salesforce API Client]] - Layered API client (salesforceRequest → smartFetch → Salesforce)

### Data Models (1)
- [[typescript-types|TypeScript Type Definitions]] - Salesforce API types, custom events, connection interfaces

### Configuration (3)
- [[ci-cd-pipeline|CI/CD Pipeline]] - GitHub Actions workflows for testing, building, packaging, and code review
- [[environment|Environment Configuration]] - Build system, code quality commands, environment variables
- [[testing|Testing Framework]] - Vitest unit/frontend/integration test architecture

### Decisions (5)
- [[adr-001-monaco-editor|ADR-001: Monaco Editor for Code Editing]] - Using Monaco Editor for SOQL, Apex, JSON editing
- [[adr-002-native-proxy|ADR-002: Native Proxy for Advanced Features]] - Node.js proxy for gRPC, CometD, CORS bypass
- [[adr-003-oauth-flow|ADR-003: Dual OAuth Flow Strategy]] - Implicit flow (no proxy) vs authorization code flow (with proxy)
- [[adr-004-css-modules|ADR-004: CSS Modules for Component Styling]] - CSS Modules with CSS variables over styled-components or Tailwind
- [[adr-005-vitest|ADR-005: Vitest for Testing]] - Unified Vitest framework for unit, browser, and integration tests

### Meta (1)
- [[vault-gap-analysis|Vault Gap Analysis - 2026-02-08]] - Documentation coverage review and improvement roadmap
