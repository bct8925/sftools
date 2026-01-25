---
description: Run tests and analyze results
allowed-tools: Bash(npm run test:*), Bash(npm test:*), Read, Glob, Grep, AskUserQuestion
model: sonnet
---

# Test Workflow

Run appropriate tests and analyze results.

## Step 1: Determine Test Scope

Ask the user what to test:

**Question**: "What tests should I run?"
**Options**:
1. "Unit tests" - Fast, mocked tests for lib/ functions
2. "Frontend tests" - Playwright browser tests
3. "Integration tests" - Real Salesforce API tests
4. "All tests" - Run everything
5. "Specific file" - Run tests matching a pattern

## Step 2: Run Tests

### Unit Tests
```bash
npm run test:unit
```

Or specific file:
```bash
npm run test:unit -- <pattern>
```

### Frontend Tests
```bash
npm run test:frontend
```

Or specific:
```bash
npm run test:frontend -- --filter=<pattern>
```

For debugging:
```bash
npm run test:frontend:slow -- --filter=<pattern>
```

### Integration Tests
Note: Requires `.env.test` with valid credentials.

```bash
npm run test:integration
```

Or specific:
```bash
npm run test:integration -- <pattern>
```

### All Tests
```bash
npm run test:unit && npm run test:frontend
```

## Step 3: Analyze Results

### For Failures

1. Read the error message carefully
2. Identify the failing test file and line
3. Check if it's a test issue or code issue
4. Look at the test expectations vs actual values

### Common Issues

| Error | Likely Cause |
|-------|-------------|
| `chromeMock is undefined` | Missing `chromeMock._reset()` in beforeEach |
| `timeout` | Async operation not completing, use --slow |
| `element not found` | Selector changed or element not rendered |
| `mock not matching` | MockRouter pattern doesn't match request |

### Failure Artifacts (Frontend Tests)

When a frontend test fails, artifacts are automatically saved:

- **Screenshot**: `/tmp/test-failure-{TestName}.png`
- **HTML dump**: `/tmp/test-failure-{TestName}.html`

Check these files to see the UI state and DOM structure at the time of failure.

## Step 4: Report Results

Provide a summary:

```
## Test Results

### Summary
- Total: X tests
- Passed: Y
- Failed: Z

### Failures (if any)

#### test-name.test.js
- **Test**: "should do something"
- **Error**: Expected X but got Y
- **Location**: line 45
- **Likely cause**: [analysis]
- **Suggested fix**: [recommendation]

### Next Steps
1. [First action]
2. [Second action]
```

## Step 5: Fix and Re-run

If tests fail:

1. Analyze the failure
2. Fix the issue (test or code)
3. Re-run the specific failing test
4. Once passing, run full suite again

## Test Coverage

For unit test coverage:
```bash
npm run test:unit:coverage
```

Review coverage report in `coverage/` directory.

## Tips

- Run unit tests frequently (they're fast)
- Run frontend tests before PRs
- Use `--filter` to focus on specific areas
- Use `--slow` mode to debug frontend tests visually
- Integration tests need fresh tokens periodically
