---
description: Create a pull request using gh CLI
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch --show-current), Bash(gh pr create:*), Bash(gh issue view:*), Bash(ls:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(cp:*), Bash(mkdir:*), AskUserQuestion
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

## Step 4: Screenshots

Check if the `screenshots/` directory exists with `.png` files:

```bash
ls screenshots/*.png 2>/dev/null
```

If screenshots exist:

1. Copy them to `.github/screenshots/` on the current branch:
   ```bash
   mkdir -p .github/screenshots
   cp screenshots/*.png .github/screenshots/
   ```

2. Commit and push:
   ```bash
   git add .github/screenshots/
   git commit -m "docs: add PR screenshots"
   git push
   ```

3. Build image markdown using raw GitHub URLs. For each screenshot file:
   ```
   ![<description>](https://raw.githubusercontent.com/bct8925/sftools/<branch>/.github/screenshots/<filename>)
   ```

4. Include a `## Screenshots` section in the PR body (Step 5).

If no screenshots exist, skip this step.

## Step 5: Create Pull Request

Draft a concise PR title (under 70 characters) and body.

If related to a GitHub issue, include `Fixes #<number>` in the PR body.

If screenshots were committed in Step 4, add a `## Screenshots` section with the image markdown.

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
<1-3 bullet points describing what changed and why>

[Fixes #<issue-number> if applicable]

[## Screenshots
<image markdown from Step 4, if applicable>]

## Test plan
- [ ] <verification steps>
EOF
)"
```

## Step 6: Report

Output the PR URL so the user can view it.

## Rules

- Keep PR title short and descriptive, using imperative mood
- Body should explain "why" not just "what"
- Always include a test plan section
- Include `Fixes #N` when the PR resolves a GitHub issue
