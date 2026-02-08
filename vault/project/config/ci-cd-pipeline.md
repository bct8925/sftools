---
title: CI/CD Pipeline
type: project
category: config
tags:
  - config
  - ci-cd
  - github-actions
  - automation
aliases:
  - GitHub Actions
  - CI Pipeline
created: 2026-02-08
updated: 2026-02-08
status: active
related-code:
  - .github/workflows/build-and-test.yml
  - .github/workflows/build-package.yml
  - .github/workflows/claude-code-review.yml
  - .github/workflows/claude.yml
confidence: high
---

# CI/CD Pipeline

## Overview

GitHub Actions workflows for automated testing, building, packaging, code review, and release management. All workflows run on a self-hosted runner.

## How It Works

### Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `build-and-test.yml` | PR (opened/sync/ready/reopen) | Run tests + build + upload artifact |
| `build-package.yml` | Push to main / manual | Production build + create GitHub release |
| `claude-code-review.yml` | PR (opened/sync/ready/reopen) | AI-powered code review |
| `claude.yml` | Manual | Claude Code for ad-hoc tasks |

### Build & Test (PR Pipeline)

Runs on non-draft PRs. Steps:
1. Checkout + clean build caches
2. `npm ci` - install dependencies
3. **Unit tests** (`npm run test:unit`) - with github-actions + JSON reporter
4. **Post unit test results** as PR comment (uses `~/.claude-ci/scripts/post-test-results.mjs`)
5. **Frontend tests** (`npm run test:frontend`) - only if unit tests pass
6. **Post frontend test results** as PR comment
7. **Build & package** (`npm run package`) - only if all tests pass
8. **Upload artifact** (dist, manifest.json, rules.json, sftools-proxy) - 7 day retention
9. Fail job if any step failed

**Key behavior**: Tests run sequentially (unit → frontend → build). Each step gates the next. Test results are posted as PR comments via custom script.

### Build Package (Release Pipeline)

Runs on push to `main` or manual trigger. Steps:
1. Checkout with full history + tags (`fetch-depth: 0`)
2. Clean caches + install dependencies
3. Production build (`npm run package`)
4. Create release with notes using Claude Code (`claude /release-notes`)

**Key behavior**: Uses Claude Code CLI to generate release notes from git history. Requires `CLAUDE_CODE_OAUTH_TOKEN` secret.

### Claude Code Review (PR Review)

AI-powered code review on non-draft PRs:
- Runs Claude Code with limited tools (Read, Grep, Glob, Bash, Task)
- Uses custom MCP server for GitHub inline comments
- Max 30 turns per review
- Invokes `/code-review` skill

### Permissions Model

| Workflow | Permissions |
|----------|-------------|
| Build & Test | `contents: read`, `pull-requests: write`, `actions: read` |
| Build Package | `contents: write` |
| Claude Review | `contents: read`, `pull-requests: write`, `issues: read` |

### Secrets

- `GITHUB_TOKEN` - Standard GitHub token (auto-provided)
- `CLAUDE_CODE_OAUTH_TOKEN` - Claude Code authentication for AI review and release notes

## Key Files

- `.github/workflows/build-and-test.yml` — PR testing pipeline
- `.github/workflows/build-package.yml` — Release pipeline
- `.github/workflows/claude-code-review.yml` — AI code review
- `.github/workflows/claude.yml` — Ad-hoc Claude Code

## Related

- [[environment|Environment Configuration]]
- [[testing|Testing Framework]]
- [[overview|System Architecture Overview]]
