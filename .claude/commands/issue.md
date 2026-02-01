---
description: Create a GitHub issue (bug report or feature request)
allowed-tools: Bash(gh issue create:*), Bash(gh issue list:*), Bash(gh label list:*), AskUserQuestion
model: sonnet
---

# Create GitHub Issue

Create a well-structured GitHub issue — either a bug report or a feature request. Focus on the problem statement or desired capability only — do not prescribe solutions or implementation details.

## Input

The user's description: `$ARGUMENTS`

If `$ARGUMENTS` is empty, use `AskUserQuestion` to ask: "What bug or feature request would you like to file?" with a text input.

## Step 1: Classify and Understand

First, determine the issue type from the description:
- **Bug**: Something is broken, behaving incorrectly, or producing errors
- **Feature request**: A new capability, enhancement, or improvement is desired

Then ask clarifying questions using `AskUserQuestion`. Ask only what's needed — skip if the description is already clear and complete.

**For bugs** (ask only if unclear):
- What is the expected behavior vs actual behavior?
- What are the steps to reproduce?
- Which part of the app or feature is affected?
- How severe is the impact? (blocks usage, cosmetic, edge case, etc.)
- Are there any error messages?

**For feature requests** (ask only if unclear):
- What problem or need does this address?
- Who is affected or would benefit?
- What does the desired behavior look like from a user perspective?

Limit to 1-2 rounds of questions max. Consolidate related questions into a single `AskUserQuestion` call.

## Step 2: Fetch Available Labels

```bash
gh label list --json name,description --limit 50
```

Select appropriate labels based on the issue content. If no labels fit, use none.

## Step 3: Draft the Issue

Compose a title and body following this structure:

**Title**: Short, specific summary. Use descriptive language:
- Bugs: "X fails when Y", "Error when doing Z"
- Features: "Support for X", "Add ability to Y"

**Body** — use the appropriate template:

### Bug template
```markdown
## Problem

<Clear description of what's broken>

## Expected Behavior

<What should happen>

## Current Behavior

<What actually happens>

## Steps to Reproduce

<Numbered steps>

## Additional Context

<Browser, environment, frequency, error messages>
```

### Feature request template
```markdown
## Problem / Motivation

<What need or gap does this address? Why does it matter?>

## Desired Behavior

<What the user experience should look like>

## Additional Context

<Who benefits, frequency of need, related features, examples from other tools>
```

Omit sections that don't apply. Include `enhancement` label for feature requests, `bug` label for bugs (if those labels exist in the repo).

**Important**: Do NOT include a "Proposed Solution", "Implementation", or "Technical Approach" section. Issues should only describe the problem or desired capability, not how to build it.

## Step 4: Confirm with User

Present the drafted title, labels, and body to the user. Use `AskUserQuestion`:
- "Does this issue look correct?"
- Options: "Create issue", "Edit title", "Edit body", "Cancel"

If the user wants edits, make the requested changes and confirm again.

## Step 5: Create the Issue

```bash
gh issue create --title "<title>" --body "$(cat <<'EOF'
<body>
EOF
)" [--label "<label1>" --label "<label2>"]
```

## Step 6: Report

Output the issue URL so the user can view it.
