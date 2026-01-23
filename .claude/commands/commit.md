---
description: Create a git commit with conventional format
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git add:*), Bash(git commit:*), Bash(git log:*), AskUserQuestion
model: sonnet
---

# Git Commit Workflow

Create a well-formatted git commit following project conventions.

## Step 1: Check Status

```bash
git status
git diff --staged
git diff
```

## Step 2: Stage Changes

If there are unstaged changes, ask the user:

**Question**: "What should be staged for this commit?"
**Options**:
1. "All changes" - Stage everything
2. "Staged only" - Keep current staging
3. "Let me specify" - User provides file patterns

If "All changes":
```bash
git add .
```

## Step 3: Analyze Changes

Review the staged changes to understand:
- What type of change (feature, fix, refactor, docs, test, etc.)
- What component/area is affected
- What the change accomplishes

## Step 4: Determine Commit Type

Based on the changes, select the appropriate type:

| Type | Use When |
|------|----------|
| `feat` | New feature or functionality |
| `fix` | Bug fix |
| `refactor` | Code restructuring without behavior change |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `style` | CSS/formatting changes |
| `chore` | Build, config, or tooling changes |

## Step 5: Draft Commit Message

Structure:
```
<type>: <short description>

[Optional longer description if needed]
```

Rules:
- First line under 72 characters
- Use imperative mood ("Add feature" not "Added feature")
- Focus on "why" not just "what"
- Reference issue numbers if applicable

## Step 6: Create Commit

```bash
git commit -m "$(cat <<'EOF'
<type>: <description>

<optional body>
EOF
)"
```

## Step 7: Verify

```bash
git log -1 --stat
```

## Examples

### Simple fix
```
fix: Correct query result count display

The total count was showing undefined when results were empty.
```

### Feature
```
feat: Add dark mode toggle to settings

- Store preference in chrome.storage
- Sync across all sftools windows
- Follow system preference by default
```

### Refactor
```
refactor: Extract query parsing to separate utility

Move SOQL parsing logic from query-tab.js to query-utils.js
for reuse and easier testing.
```

## Important Notes

- Never commit .env.test or other secrets
- Run tests before committing significant changes
- Keep commits focused on single logical change
