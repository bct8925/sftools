---
description: Generate release notes and create a GitHub release for the current version
allowed-tools: Bash(jq:*), Bash(gh release view:*), Bash(gh release list:*), Bash(gh release create:*), Bash(git log:*), Bash(git diff:*), Read
---

# Generate Release Notes

Generate customer-facing release notes for the current version and create a GitHub release.

## Step 1: Get current version

Read the version from `manifest.json` using `jq -r '.version' manifest.json`. Use this exact version string everywhere (tags, titles, etc.) — do not add a `v` prefix or modify it in any way.

## Step 2: Check if release already exists

Use `gh release view "<version>"` to check if a release for this version already exists. If it does, stop and report that the release already exists.

## Step 3: Find the previous release

Use `gh release list --limit 1 --json tagName -q '.[0].tagName'` to get the most recent release tag.

## Step 4: Get changes since previous release

First, get the list of commit subjects:
`git log <prev_tag>..HEAD --oneline`
If no previous release exists, get all commits.

Then, to understand what each commit actually changed, iterate through the commits in batches of ~10 using:
`git log <prev_tag>..HEAD --stat --skip=N --max-count=10`

Walk through all batches (skip=0, skip=10, skip=20, etc.) until you've covered every commit. Use the file change stats to determine which commits are customer-facing vs internal.

If a commit message is ambiguous, use `git log <hash> -1 -p` or read the changed source files to understand what the change actually does.

## Step 5: Write release notes

Based on the commits, write release notes for a **customer audience**. Rules:

- Describe only what **changed** since the last release — do NOT describe existing features or the product as a whole
- Only include product-facing changes: new features, improvements, bug fixes
- **Exclude** internal changes: CI/CD, refactoring, test updates, repo maintenance, build config
- Format as markdown with bullet points grouped by category (e.g. **Features**, **Improvements**, **Bug Fixes**)
- Each bullet should describe the change, not the feature (e.g. "Added dark mode support" not "Dark mode lets you switch between light and dark themes")
- Keep descriptions concise — no commit hashes, no developer jargon
- If there are no customer-facing changes, write: "Maintenance release with internal improvements."

## Step 6: Create the GitHub release

Use `gh release create` to create the release:
- Tag: `<version>`
- Title: `<version>`
- Body: the release notes from Step 5
- Attach `dist/sftools.zip` as a release asset (if it exists)

Report the release URL when done.
