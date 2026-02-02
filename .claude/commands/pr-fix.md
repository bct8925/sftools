---
description: Address PR review comments from GitHub
allowed-tools: Bash(gh pr list:*), Bash(gh pr view:*), Bash(gh repo view:*), Bash(gh api:*), Bash(git branch --show-current), Bash(npm run validate*), Bash(npm run test*), Bash(npm run build*)
---

# PR Fix Workflow

Address GitHub PR review comments for the current branch.

## Step 1: Find the PR

```bash
gh repo view --json nameWithOwner --jq '.nameWithOwner'
gh pr list --head "$(git branch --show-current)" --json number --jq '.[0].number'
```

If no PR found, ask the user for a PR number.

## Step 2: Fetch review comments

Fetch inline review comments:

```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments \
  --jq '.[] | "---\nid: \(.id)\npath: \(.path)\nline: \(.line)\nbody: \(.body)\n"'
```

Also fetch review-level comments (non-inline):

```bash
gh api repos/{owner}/{repo}/pulls/{number}/reviews \
  --jq '.[] | select(.body != "") | "---\nstate: \(.state)\nbody: \(.body)\n"'
```

## Step 3: Triage comments

**Detect already-addressed comments:**
This command may be run multiple times on the same PR. Before triaging, check recent commits since the PR was opened:
```bash
gh api repos/{owner}/{repo}/pulls/{number} --jq '.created_at'
git log --oneline --since=<created_at> -- <paths from comments>
```
For each comment, if the referenced file was modified in a recent commit, read the current code at that location to verify whether the issue is already resolved. Mark these as "already addressed" and skip them.

**Deduplicate comments:**
Multiple reviewers (or the same reviewer) may flag the same issue. Group comments that:
- Reference the same file and function/method
- Describe the same underlying problem (e.g., two comments about missing useCallback on the same component)
- Suggest the same or equivalent fix
Treat each group as a single fix item.

**For each remaining comment:**
- Read the referenced file and surrounding context
- Determine if it contains a code suggestion (` ```suggestion ` blocks) or describes an issue
- Group related comments (multiple comments on same file/topic)

## Step 4: Apply fixes

Work through comments systematically:
- **Code suggestions**: Apply the suggested change. If line numbers have shifted since the comment was created, use the code context from the comment body (function names, variable names, surrounding lines) to locate the correct position — don't rely solely on the line number.
- **Issue descriptions**: Read relevant code, understand the problem, implement a fix
- **Questions/clarifications**: Note these separately for the user

## Step 5: Validate

After all changes:
- Run `npm run validate`
- Run tests if changes are behavioral (not just style/formatting)
- Report any validation failures

## Step 6: Summary

Present a summary:
- Which comments were addressed and how
- Any comments needing manual attention or clarification
- Validation results
