---
description: Review code changes for quality and patterns
allowed-tools: Read, Glob, Grep, Bash(git diff:*), Bash(git status:*), Bash(git log:*)
model: sonnet
---

# Code Review Workflow

Perform a comprehensive code review of recent changes.

## Step 1: Identify Changes

Use git to see what has changed:

```bash
git status
git diff --name-only
git diff
```

## Step 2: Review Each Changed File

For each changed file, check:

### Code Quality

1. **Component Pattern Compliance**
   - React functional components with TypeScript
   - Uses hooks (useState, useEffect, useContext) correctly
   - Follows project Context provider patterns (Connection, Theme, Proxy)
   - Uses CSS Modules for component-scoped styles

2. **CSS Variable Usage**
   - No hard-coded colors (must use `var(--variable-name)`)
   - No hard-coded shadows, z-indexes, or border-radii
   - Uses semantic variable names

3. **API Usage**
   - Uses `salesforceRequest()` for Salesforce calls
   - Uses `smartFetch()` or `extensionFetch()` for HTTP
   - Proper error handling with try/catch

### Security

1. No secrets or tokens in code
2. No SQL injection vulnerabilities in SOQL
3. No XSS vulnerabilities in DOM manipulation
4. Input validation on user-provided data

### Testing

1. New lib/ functions have unit tests
2. New UI features have frontend tests
3. Tests cover error cases

### Performance

1. No unnecessary re-renders or API calls
2. Event listeners properly cleaned up
3. Large data sets handled efficiently

## Step 3: Report Findings

Provide a structured report:

```
## Code Review Summary

### Files Reviewed
- file1.js
- file2.css

### Issues Found

#### Critical
- [Description with file:line reference]

#### Warnings
- [Description with file:line reference]

#### Suggestions
- [Description with file:line reference]

### Positive Observations
- [Good patterns observed]

### Recommended Actions
1. [First action]
2. [Second action]
```

## Guidelines

> **Tip:** For best results, run `/review` in a fresh session (`/clear` first or new terminal).
> A clean context avoids bias toward code written in the current session.

- Reference specific file:line locations
- Explain why something is an issue
- Suggest concrete fixes
- Note positive patterns to reinforce good practices
