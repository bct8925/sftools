---
title: SOQL
type: domain
category: concepts
tags:
  - vault/domain/concepts
  - soql
  - salesforce
  - query
aliases:
  - Salesforce Object Query Language
created: 2026-02-08
updated: 2026-02-08
status: active
confidence: high
---

# SOQL

## Definition

SOQL (Salesforce Object Query Language) is Salesforce's SQL-like query language for retrieving data from the Salesforce platform. It's the primary data access method used throughout sftools.

SOQL is a read-only query language for querying Salesforce object data. Similar to SQL SELECT but designed for Salesforce's relational object model. No INSERT/UPDATE/DELETE (those use DML in Apex or REST API calls).

## How It Works

### Basic Syntax

```sql
SELECT field1, field2 FROM ObjectName WHERE condition ORDER BY field LIMIT n
```

### Key Differences from SQL

- No `*` (SELECT all) - must explicitly specify fields
- No JOINs - uses relationship queries instead
- Object-oriented: queries against sObjects (Salesforce Objects)
- Governor limits apply (50,000 record default)

### Relationship Queries

**Parent-to-child (subquery):**
```sql
SELECT Name, (SELECT Name FROM Contacts) FROM Account
```

**Child-to-parent (dot notation):**
```sql
SELECT Name, Account.Name FROM Contact
```

**Multi-level (up to 5 levels):**
```sql
SELECT Account.Owner.Name FROM Contact
```

### Aggregate Functions

- `COUNT()`, `COUNT(field)`, `COUNT_DISTINCT(field)`
- `SUM(field)`, `AVG(field)`, `MIN(field)`, `MAX(field)`
- Used with `GROUP BY` clause

### Date Literals

Built-in date expressions:

**Relative dates:**
- `TODAY`, `YESTERDAY`, `TOMORROW`

**Ranges:**
- `LAST_WEEK`, `THIS_MONTH`, `NEXT_QUARTER`, `LAST_YEAR`

**Dynamic:**
- `LAST_N_DAYS:n`, `NEXT_N_MONTHS:n`

### Filtering Operators

**Standard operators:**
- `=`, `!=`, `<`, `>`, `<=`, `>=`

**Special operators:**
- `IN`, `NOT IN`
- `LIKE` (with `%` and `_` wildcards)
- `INCLUDES`, `EXCLUDES` (multi-select picklist)
- `= null`, `!= null` (null handling)

### Salesforce API Endpoints

SOQL queries are executed through various APIs:

- **REST API:** `/services/data/vXX.0/query?q=...`
- **Tooling API:** `/services/data/vXX.0/tooling/query?q=...`
- **Bulk API v2:** POST job with SOQL for large exports

## Example

```sql
SELECT Id, Name, Email, Account.Name, Account.Industry
FROM Contact
WHERE Account.Industry IN ('Technology', 'Finance')
  AND CreatedDate > LAST_N_MONTHS:6
ORDER BY Name ASC
LIMIT 100
```

This query retrieves contacts from accounts in Technology or Finance industries, created in the last 6 months, including parent account details.

## How It's Used in sftools

- [[query-editor|Query Editor]] tab uses SOQL as primary input
- [[soql-autocomplete|SOQL Autocomplete]] provides intelligent completion
- Bulk export uses Bulk API v2 with SOQL
- Record Viewer constructs SOQL to fetch records
- Schema Browser metadata helps inform SOQL field selection

## See Also

- [[salesforce-apis|Salesforce APIs]]
- [[query-editor|Query Editor]]
- [[soql-autocomplete|SOQL Autocomplete]]
- [[salesforce-api-client|Salesforce API Client]]
