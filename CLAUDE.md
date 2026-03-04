# sftools

GitHub repo: `bct8925/sftools`

Chrome Extension (Manifest V3) for Salesforce developers. React 19, TypeScript 5.9, Vite 7, Monaco Editor. Vitest (unit) + Playwright (frontend) testing.

## Workflow

- **MUST** follow `/brain` coding standards before writing any code

## Commands

### Build

```bash
npm run build                  # Build for development (debug mode)
npm run package                # Build production + create zip archive
npm run typecheck              # TypeScript validation
```

### Test

```bash
npm run test:unit                        # Run all unit tests
npm run test:unit -- auth.test.ts        # Run specific test file
npm run test:unit:coverage               # With coverage report
npm run test:frontend                    # Run all frontend tests (headless)
npm run test:frontend -- query           # Run test files matching "query"
npm run test:frontend -- -t "pattern"    # Run tests with names matching pattern
npm run test:integration                 # Run all integration tests
```

### Code Quality

```bash
npm run validate               # Auto-fix lint + format, then run all checks
npm run check                  # Run typecheck + lint + format:check (no fix)
npm run fix                    # Auto-fix lint + format only
```

**Run `npm run validate` after changing code files (`.ts`, `.tsx`, `.js`, `.jsx`, `.css`). Skip for docs, config, or non-code changes.**

### Pre-PR

```bash
npm run validate && npm run test:unit && npm run test:frontend && npm run build
```

## Test-Only Exports

Exports that exist solely for test access live in companion `.testing.ts` files (e.g., `fetch.testing.ts` re-exports internals from `fetch.ts`). This keeps them out of `npm run dead-code` results while making the intent explicit.

- **Production code** imports from the main module (`./fetch`)
- **Test code** imports test-only symbols from the `.testing` companion (`./fetch.testing`)
- When adding a new test-only export, add it to the corresponding `.testing.ts` file (create one if needed)

## Git Workflow

- Branch from `main`: `feature/description` or `fix/description`
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`
- PRs require: passing tests, type checks, lint
- Squash commits on merge

## Security

- **NEVER** commit tokens, API keys, or credentials
- Use `.env.test` for integration tests and extension-mode frontend tests (gitignored)
- Use environment variables for CI/CD secrets

## References

Subdirectory CLAUDE.md files for domain-specific context and patterns:

| Directory | Focus |
|-----------|-------|
| [src/CLAUDE.md](src/CLAUDE.md) | Architecture, patterns, API docs, CSS variables |
| [src/components/CLAUDE.md](src/components/CLAUDE.md) | React component patterns |
| [src/contexts/CLAUDE.md](src/contexts/CLAUDE.md) | State management patterns |
| [src/api/CLAUDE.md](src/api/CLAUDE.md) | Salesforce API patterns |
| [src/auth/CLAUDE.md](src/auth/CLAUDE.md) | Authentication & OAuth |
| [src/lib/CLAUDE.md](src/lib/CLAUDE.md) | Shared utility patterns |
| [src/types/CLAUDE.md](src/types/CLAUDE.md) | TypeScript type definitions |
| [src/hooks/CLAUDE.md](src/hooks/CLAUDE.md) | React hooks exports |
| [src/react/CLAUDE.md](src/react/CLAUDE.md) | App shell and entry points |
| [src/background/CLAUDE.md](src/background/CLAUDE.md) | Service worker patterns |
| [src/pages/CLAUDE.md](src/pages/CLAUDE.md) | HTML entry points |
| [tests/CLAUDE.md](tests/CLAUDE.md) | Testing framework and patterns |
| [sftools-proxy/CLAUDE.md](sftools-proxy/CLAUDE.md) | Proxy architecture |
