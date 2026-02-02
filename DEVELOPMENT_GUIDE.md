# Development Guide

End-to-end workflow for building features and fixes in sftools, from issue to merged PR.

## Process Overview

```
GitHub Issue ──► Branch ──► OpenSpec Planning ──► Implementation ──► Testing ──► Verify & Archive ──► Commit ──► Screenshots ──► PR ──► CI ──► Review ──► Merge ──► Release
                              proposal.md          /brain:brain       test-writer   /opsx:verify       /commit    /screenshot       /pr    build-and-test   claude-code-review
                              specs/               /opsx:apply        /test         /opsx:archive      hooks      (UI changes only)  gh     claude.yml
                              design.md            dora + hooks                                        validate
                              tasks.md
```

---

## 1. Starting Work

### From a GitHub Issue

```bash
# Review open issues
/issue-triage

# Create a branch (use issue number for automatic PR linking)
git checkout -b issue-42
# or use prefix convention:
git checkout -b feature/schema-search
git checkout -b fix/auth-token-refresh
```

### From Scratch

Create a GitHub issue first for traceability, or start directly with OpenSpec.

---

## 2. Planning (OpenSpec)

All new features and non-trivial changes go through OpenSpec. This produces four artifacts before any code is written.

### Start a change

```bash
/opsx:new         # Create change workspace, then step through artifacts
/opsx:ff          # Or fast-forward: generate all artifacts at once
```

Use `/opsx:ff` when requirements are clear. Use `/opsx:continue` to build artifacts one at a time. Use `/opsx:explore` when you need to investigate before committing to a direction.

### Artifact structure

```
openspec/changes/<change-name>/
├── proposal.md    # Why, what, capabilities, impact (<500 words)
├── specs/         # Gherkin-style requirements (WHEN/THEN/AND)
├── design.md      # Context, goals/non-goals, decisions, risks
└── tasks.md       # Numbered checklist with file paths
```

### Config rules enforced

| Artifact | Rules |
|----------|-------|
| proposal | Under 500 words, includes Non-goals section |
| specs    | Gherkin scenarios for all new/modified behavior |
| design   | References existing patterns from `src/CLAUDE.md`, prefers extending existing abstractions |
| tasks    | Each task independently testable, includes file paths, includes a **Test** group (using test-writer agent) before the Verify group |

---

## 3. Implementation

### Before writing code

- `/brain:brain` — loads coding standards (naming, patterns, architecture)
- `dora` — use for all code exploration (`dora file`, `dora symbol`, `dora deps`, etc.)

### Writing code

```bash
/opsx:apply       # Implement tasks from the change, checkboxes update as you go
```

### Automatic hooks

These run without any action from you:

| Hook | Trigger | What it does |
|------|---------|-------------|
| **fix-on-write** | Every `Edit`/`Write` | Runs ESLint --fix + Prettier on the saved file |
| **block-dangerous** | Every `Bash` call | Blocks `rm -rf` and `git push --force` |
| **validate-on-commit** | Every `git commit` | Runs full validation; blocks commit on failure or auto-fixes |

---

## 4. Testing

Three test tiers, all using Vitest:

| Tier | Environment | Command | Purpose |
|------|-------------|---------|---------|
| Unit | jsdom | `npm run test:unit` | Business logic tests for `src/api/`, `src/auth/`, `src/background/`, `src/hooks/`, `src/lib/`, and `sftools-proxy/` |
| Frontend | Playwright + Chromium | `npm run test:frontend` | Browser tests with real UI interaction |
| Integration | Node | `npm run test:integration` | Real Salesforce API calls (requires `.env.test`) |

### Writing tests

Tests for new/modified behavior **must** be written using the **test-writer agent** (`Task` tool with `subagent_type=test-writer`). This is enforced in the OpenSpec task structure — every change includes a "Test" task group before "Verify".

### Running tests

```bash
/test                                    # Interactive: choose which tests to run
npm run test:unit                        # All unit tests
npm run test:unit -- auth.test.ts        # Specific file
npm run test:unit:coverage               # With coverage report
npm run test:frontend                    # All frontend tests (headless)
npm run test:frontend -- --filter=query  # Frontend tests matching "query"
npm run test:integration                 # Integration tests (needs .env.test)
```

---

## 5. Verify & Archive

Once implementation and testing are complete, verify against your specs and archive the change. This happens **before** committing so that the archived specs are included in the commit.

### Verify against specs

```bash
/opsx:verify        # Checks completeness, correctness, coherence against OpenSpec artifacts
```

### Archive the change

```bash
/opsx:archive       # Moves change to archive/, syncs delta specs to master specs
```

This syncs your delta specs into `openspec/specs/` (the living documentation of all capabilities) and moves your change directory to `openspec/changes/archive/`.

---

## 6. Validation & Commit

### Validation

```bash
npm run validate    # Auto-fix lint + format, then typecheck + lint check + format check
npm run check       # Read-only: typecheck + lint + format check (no auto-fix)
```

The **validate-on-commit** hook runs `npm run validate` automatically on every `git commit`. If validation fails or auto-fixes files, the commit is blocked — you must re-stage and retry.

### Committing

```bash
/commit             # Interactive: stages files, analyzes changes, creates conventional commit
```

Conventional commit types: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `style:`, `chore:`

---

## 7. Pull Request

### Pre-PR checklist

```bash
npm run validate && npm run test:unit && npm run test:frontend && npm run build
```

### Screenshots (for UI changes)

If the branch includes visual changes, capture screenshots before creating the PR:

```bash
/screenshot         # Captures screenshots, commits to .github/screenshots/, pushes
```

The screenshot skill analyzes the branch diff, launches a Playwright script to capture light + dark theme screenshots, verifies them visually, then commits them to `.github/screenshots/` so PR image URLs resolve. The `/pr` command detects committed screenshots and includes them in the PR body automatically.

### Create PR

```bash
/pr                 # Analyzes commits, detects issue references from branch name, creates PR
```

The `/pr` command automatically links to GitHub issues when branch names contain issue numbers (e.g., `issue-42`).

---

## 8. CI & Review

Two workflows run on every PR:

| Workflow | What it does |
|----------|-------------|
| **build-and-test** | Unit tests → Frontend tests → Build → Upload artifact |
| **claude-code-review** | Automated code review with inline PR comments |

Fix any CI failures, push, and the workflows re-run automatically.

You can also run a manual review:

```bash
/review             # Static analysis: patterns, security, performance, test coverage
```

---

## 9. Post-Merge

After your PR is merged to `main`, the **build-package** workflow triggers automatically — runs `npm run package` and generates release notes.

---

## Quick Reference

### Commands

| Command | Purpose |
|---------|---------|
| `/opsx:new` | Start a new OpenSpec change |
| `/opsx:ff` | Fast-forward: generate all planning artifacts |
| `/opsx:continue` | Create next artifact in sequence |
| `/opsx:explore` | Investigate problems or ideas |
| `/opsx:apply` | Implement tasks from a change |
| `/opsx:verify` | Verify implementation matches specs |
| `/opsx:archive` | Archive completed change |
| `/brain:brain` | Load coding standards before writing code |
| `/commit` | Create conventional commit |
| `/pr` | Create pull request |
| `/test` | Run tests interactively |
| `/review` | Code review |
| `/build` | Build and verify output |
| `/issue-triage` | Process open GitHub issues |
| `/release-notes` | Generate release notes |

### Common Workflows

**Feature (from issue):**
```
git checkout -b issue-42
/opsx:new → /opsx:ff → /opsx:apply → /opsx:verify → /opsx:archive
/commit → /screenshot (if UI changes) → /pr
# (CI runs, review, merge)
```

**Bug fix (small):**
```
git checkout -b fix/description
# (implement fix + tests)
/commit → /pr
```

**Exploratory feature:**
```
/opsx:new → /opsx:explore → /opsx:continue (repeat) → /opsx:apply → /opsx:verify → /opsx:archive
/commit → /pr
```

---

## Known Gaps & Future Improvements

| Gap | Status | Notes |
|-----|--------|-------|
| No coverage threshold enforcement | Deferred | Coverage reports generated but no minimum threshold. Could add `thresholds` to vitest config. |
| Pre-PR checklist is manual | Accepted | CI catches failures. Could add a hook on `gh pr create` for local enforcement. |
| OpenSpec not enforced for non-trivial changes | Advisory | CLAUDE.md documents it as MUST but no automated enforcement. |
| `/review` doesn't run tests | Accepted | CI covers test execution. Review is static analysis only. |
| Integration tests not in CI | Deferred | Requires Salesforce credentials as GitHub secrets. Could gate behind a label or manual trigger. |
| Branch naming not enforced | Advisory | Convention is `feature/` or `fix/` prefix. `/pr` benefits from `issue-N` naming for auto-linking. |
