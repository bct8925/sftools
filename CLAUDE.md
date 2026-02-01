# sftools

GitHub repo: `bct8925/sftools`

Chrome Extension (Manifest V3) for Salesforce developers. React 19, TypeScript 5.9, Vite 7, Monaco Editor. Vitest (unit) + Playwright (frontend) testing.

## Tool Use

- **MUST** use `dora` for all code exploration — file search, symbol lookup, dependency tracing, architecture analysis
- Only fall back to Grep for non-code files or when dora fails
- Use Read for file contents, Edit/Write for changes

## Workflow

- **MUST** follow `/brain` coding standards before writing any code
- **MUST** use [OpenSpec](https://github.com/Fission-AI/OpenSpec) for new features and non-trivial changes

### OpenSpec

Spec-driven development — align on requirements before implementation.

```
openspec/
├── config.yaml           # Configuration
├── specs/                # Master specs (persisted from completed changes)
└── changes/              # Active and archived changes
    ├── <change-name>/    # proposal.md, specs/, design.md, tasks.md
    └── archive/          # Completed changes
```

**Workflow:** `/opsx:new` → `/opsx:ff` → `/opsx:apply` → `/opsx:verify` → `/opsx:archive`

| Command | Purpose |
|---------|---------|
| `/opsx:new` | Create a new change workspace |
| `/opsx:ff` | Fast-forward: generate all planning artifacts at once |
| `/opsx:continue` | Create the next artifact in sequence |
| `/opsx:explore` | Think through ideas or investigate problems |
| `/opsx:apply` | Implement tasks from a change |
| `/opsx:verify` | Verify implementation matches change artifacts |
| `/opsx:sync` | Sync delta specs to master specs |
| `/opsx:archive` | Archive a completed change |
| `/opsx:bulk-archive` | Archive multiple changes at once |

## Commands

### Build

```bash
npm run build                  # Build for development (debug mode)
npm run watch                  # Build with watch mode
npm run package                # Build production + create zip archive
npm run typecheck              # TypeScript validation
```

### Test

```bash
npm run test:unit                        # Run all unit tests
npm run test:unit -- auth.test.ts        # Run specific test file
npm run test:unit:coverage               # With coverage report
npm run test:frontend                    # Run all frontend tests (headless)
npm run test:frontend -- --filter=query  # Run tests matching "query"
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
