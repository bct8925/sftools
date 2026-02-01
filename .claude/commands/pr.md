---
description: Create a pull request using gh CLI
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch --show-current), Bash(gh pr create:*), Bash(gh issue view:*), AskUserQuestion
model: sonnet
---

# Pull Request Workflow

Create a pull request for the current branch using `gh` CLI.

## Context

- Current branch: !`git branch --show-current`
- Remote tracking: !`git status -sb`
- Recent commits on this branch vs main: !`git log --oneline main..HEAD 2>/dev/null || git log --oneline -5`
- Diff summary vs main: !`git diff --stat main...HEAD 2>/dev/null`

## Step 1: Validate Branch

If on `main`, stop and tell the user to create a branch first.

## Step 2: Determine if Related to a GitHub Issue

Check the branch name for issue references (e.g., `issue-91`, `fix-123`, `feat/42-description`).

If the argument `$ARGUMENTS` is provided, treat it as an issue number or context for the PR.

If an issue number is identified:
```bash
gh issue view <number>
```

Use the issue title and description to inform the PR title and body.

## Step 3: Analyze Changes

Review all commits on the branch vs main:
```bash
git log --oneline main..HEAD
git diff main...HEAD --stat
```

Understand:
- What changed and why
- Which components/areas are affected
- Whether this is a feature, fix, refactor, etc.

## Step 4: Create Pull Request

Draft a concise PR title (under 70 characters) and body.

If related to a GitHub issue, include `Fixes #<number>` in the PR body.

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
<1-3 bullet points describing what changed and why>

[Fixes #<issue-number> if applicable]

## Test plan
- [ ] <verification steps>
EOF
)"
```

## Step 5: Report

Output the PR URL so the user can view it.

## Rules

- Keep PR title short and descriptive, using imperative mood
- Body should explain "why" not just "what"
- Always include a test plan section
- Include `Fixes #N` when the PR resolves a GitHub issue
