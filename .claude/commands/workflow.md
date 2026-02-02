---
description: Guided end-to-end workflow from issue to PR
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git checkout:*), Bash(git push:*), Bash(git add:*), Bash(git stash:*), Bash(gh issue view:*), Bash(gh issue list:*), Bash(openspec:*), Bash(npm run validate:*), Bash(npm run test*), Bash(npm run build:*), Bash(npm run check:*), Skill, Skill(commit), Skill(pr), Task, AskUserQuestion
model: sonnet
argument-hint: [issue-number or description]
---

# Guided Development Workflow

Walk through the full development process for a single task — from issue to PR.

Reference: [DEVELOPMENT_GUIDE.md](../../DEVELOPMENT_GUIDE.md) for detailed documentation of each step.

## Context

- Current branch: !`git branch --show-current`
- Git status: !`git status -sb`
- Active OpenSpec changes: !`openspec list --json 2>/dev/null || echo "none"`

## Step 1: Identify the Task

If `$ARGUMENTS` is provided, use it as the issue number or task description.

If no argument:
- Use **AskUserQuestion** to ask:
  - **"What are you working on?"**
  - Options: "GitHub issue", "New feature (no issue)", "Bug fix (no issue)", "Other"

If a GitHub issue number is identified:
```bash
gh issue view <number>
```

## Step 2: Branch Setup

**Always create the new branch from `main`** to avoid carrying forward unrelated commits.

- If on `main`: create the new branch directly
- If on a different branch: switch to `main` first, then create the new branch

```bash
git checkout main
git pull origin main
git checkout -b <branch-name>
```

Branch naming:
- For issues: `issue-<number>` (e.g., `issue-42`)
- For features: `feat/<short-description>`
- For fixes: `fix/<short-description>`

## Step 3: Determine Workflow Type

Use **AskUserQuestion**:

- **"What type of change is this?"**
  - "Feature (needs OpenSpec planning)" — Go to Step 4
  - "Small fix (skip planning)" — Go to Step 6
  - "Docs/config only" — Go to Step 6

## Step 4: Planning (OpenSpec)

Use **AskUserQuestion**:

- **"How should we plan this?"**
  - "Fast-forward (requirements are clear)" — Invoke `/opsx:ff`
  - "Step by step (explore first)" — Invoke `/opsx:new`
  - "Already planned (change exists)" — Skip to Step 5

Invoke the appropriate OpenSpec skill:

```
Skill(skill: "opsx:ff")      # or opsx:new
```

Wait for planning to complete before proceeding.

## Step 5: Implementation

Dispatch implementation to a subagent using the Task tool. Do NOT use the Skill tool here — skills load instructions into the current conversation instead of doing the work.

```
Task(
  subagent_type: "senior-dev",
  prompt: "Implement the OpenSpec change '<name>'. Run: Skill(skill: 'opsx:apply', args: '<name>') and work through all tasks.",
  description: "Implement <name> change"
)
```

For multiple independent tasks, use `dispatching-parallel-agents` to run them in parallel.

Wait for implementation to complete before proceeding.

## Step 6: Testing

Run the relevant tests based on what changed:

```bash
npm run test:unit
npm run test:frontend
```

If tests fail, fix the issues before proceeding. Use **AskUserQuestion** if a failure requires a decision.

## Step 7: Validation

```bash
npm run validate
```

If validation fails, fix the issues. If it auto-fixes files, re-run to confirm clean.

## Step 8: Verify & Archive (if OpenSpec was used)

If an OpenSpec change exists for this task:

```
Skill(skill: "opsx:verify")
Skill(skill: "opsx:archive")
```

Skip this step if no OpenSpec change was created (small fix / docs).

## Step 8.5: Stage OpenSpec Artifacts

If an OpenSpec change was used, stage the change directory so planning artifacts are included in the commit and PR:

```bash
git add openspec/changes/<change-name>/
```

## Step 9: Commit

Invoke the commit command:

```
Skill(skill: "commit")
```

## Step 10: Screenshots (if UI changes)

Check if `src/components/` files were modified:

```bash
git diff --name-only main...HEAD | grep -q 'src/components/' && echo "UI_CHANGED" || echo "NO_UI"
```

If UI changed, use **AskUserQuestion**:

- **"This branch has UI changes. Capture screenshots for the PR?"**
  - "Yes" — Invoke the screenshot skill
  - "No" — Skip

## Step 11: Pull Request

Invoke the PR command:

```
Skill(skill: "pr")
```

## Step 12: Done

Report the PR URL and summarize what was accomplished:

```
## Workflow Complete

**Task:** <description>
**Branch:** <branch-name>
**PR:** <url>

### Steps Completed
- [x] Branch created
- [x] Planning (if applicable)
- [x] Implementation
- [x] Tests passing
- [x] Validation passing
- [x] Committed
- [x] PR created
```

## Rules

- **Always ask before proceeding** to the next major phase (planning → implementation → testing → PR)
- **Never skip tests or validation** — run them even if the user doesn't ask
- **Pause on failures** — don't proceed past failing tests or validation errors
- **Use skills for each step** — don't reimplement what existing commands do
- **Keep the user informed** — announce each step before starting it
- If any step was already done (e.g., branch exists, tests already passed), acknowledge and skip
