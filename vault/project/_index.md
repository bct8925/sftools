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

## Entries

### Architecture (8)
- [[System Architecture Overview]] - High-level architecture, communication flow, page/tab structure
- [[Directory Structure]] - Repository layout and directory purposes
- [[Component Architecture]] - React component patterns, CSS Modules, Monaco editor wrapper
- [[State Management]] - React Context providers (Connection, Theme, Proxy)
- [[Background Service Worker]] - Message routing, OAuth tokens, native messaging
- [[Authentication and OAuth]] - Multi-org OAuth, CSRF protection, token refresh
- [[Native Proxy]] - Node.js proxy for gRPC streaming, CometD, CORS bypass
- [[Utility Libraries]] - Shared TypeScript utilities in src/lib/

### Features (8)
- [[Query Editor]] - SOQL editor with Monaco, tabbed results, bulk export
- [[Apex Executor]] - Anonymous Apex execution with debug log retrieval
- [[REST API Explorer]] - Raw REST API calls with Monaco JSON editor
- [[Event Streaming]] - Platform Events, CDC, PushTopics (requires proxy)
- [[Schema Browser]] - Standalone object metadata browser
- [[Record Viewer]] - Standalone record viewer/editor
- [[Utility Tools]] - Debug log management, flow cleanup
- [[Settings and Connections]] - Multi-org management, theme, proxy config

### APIs (1)
- [[Salesforce API Client]] - Layered API client (salesforceRequest → smartFetch → Salesforce)

### Data Models (1)
- [[TypeScript Type Definitions]] - Salesforce API types, custom events, connection interfaces

### Configuration (2)
- [[Environment Configuration]] - Build system, code quality commands, environment variables
- [[Testing Framework]] - Vitest unit/frontend/integration test architecture
