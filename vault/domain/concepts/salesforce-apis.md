---
title: Salesforce APIs
type: domain
category: concepts
tags:
  - salesforce
  - rest-api
  - tooling-api
  - bulk-api
  - soql
  - apex
  - cometd
  - pub-sub
aliases:
  - Salesforce REST API
  - SOQL
  - Tooling API
created: 2026-02-08
updated: 2026-02-08
status: active
confidence: high
---

# Salesforce APIs

## What Is It?

Salesforce provides multiple APIs for interacting with org data and metadata. sftools uses several of these to power its developer tools.

## How It Works

### REST API (v62.0)

Primary data access API. Used for queries, record CRUD, and describe operations.

- **Query**: `GET /services/data/v62.0/query?q=SELECT+Id+FROM+Account`
- **Describe Global**: `GET /services/data/v62.0/sobjects/`
- **Describe Object**: `GET /services/data/v62.0/sobjects/Account/describe`
- **Record CRUD**: `GET/POST/PATCH/DELETE /services/data/v62.0/sobjects/Account/{id}`
- **Query More**: `GET /services/data/v62.0/query/{locator}` (pagination)

### Tooling API

Metadata and developer operations. Same endpoint pattern with `/tooling/`:

- **Anonymous Apex**: `GET /services/data/v62.0/tooling/executeAnonymous?anonymousBody=...`
- **Trace Flags**: CRUD on `TraceFlag` via Tooling API
- **Debug Logs**: Query/delete `ApexLog` records
- **Composite**: `POST /services/data/v62.0/tooling/composite` (batch operations)
- **Formula Fields**: Read/update `CustomField` metadata

### Bulk API v2

Large-scale data export:
1. `POST /services/data/v62.0/jobs/query` — Create query job
2. `GET /services/data/v62.0/jobs/query/{id}` — Poll status
3. `GET /services/data/v62.0/jobs/query/{id}/results` — Download CSV

### Pub/Sub API (gRPC)

Platform Event streaming via gRPC:
- Server: `api.pubsub.salesforce.com:443`
- Bidirectional streaming with Avro-encoded events
- Requires org ID from access token

### CometD/Bayeux

Legacy streaming for PushTopics, Change Data Capture, System Topics:
- Long-polling HTTP protocol
- Channel patterns: `/topic/*`, `/data/*`, `/systemTopic/*`
- Replay IDs for message replay

### SOQL (Salesforce Object Query Language)

SQL-like query language for Salesforce data:
- Relationship queries: `SELECT Account.Name FROM Contact`
- Subqueries: `SELECT (SELECT Id FROM Contacts) FROM Account`
- Aggregate: `SELECT COUNT(Id) FROM Account`
- sftools parses via `@jetstreamapp/soql-parser-js`

## Key Principles

- Always use OAuth access token in `Authorization: Bearer {token}` header
- API version is pinned to `v62.0` across the codebase
- Describe results should be cached (per-connection) to reduce API calls
- Bulk API for exports >2000 records
- Error responses follow standard Salesforce error format: `[{ errorCode, message }]`

## Related

- [[query-editor|Query Editor]]
- [[apex-executor|Apex Executor]]
- [[event-streaming|Event Streaming]]
- [[rest-api-explorer|REST API Explorer]]
- [[salesforce-api-client|Salesforce API Client]]
- [[native-proxy|Native Proxy]]
- [[schema-browser|Schema Browser]]
- [[utility-tools|Utility Tools]]

## Resources

- [Salesforce REST API Guide](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/)
- [Salesforce Tooling API](https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/)
- [Pub/Sub API](https://developer.salesforce.com/docs/platform/pub-sub-api/overview)
