---
description: Generate release notes and create a GitHub release for the current version
allowed-tools: Bash(jq:*), Bash(gh release view:*), Bash(gh release list:*), Bash(gh release create:*), Bash(git log:*), Read
---

# Generate Release Notes

Generate customer-facing release notes for the current version and create a GitHub release.

## Step 1: Get current version

Read the version from `manifest.json` using `jq -r '.version' manifest.json`.

## Step 2: Check if release already exists

Use `gh release view "v<version>"` to check if a release for this version already exists. If it does, stop and report that the release already exists.

## Step 3: Find the previous release

Use `gh release list --limit 1 --json tagName -q '.[0].tagName'` to get the most recent release tag.

## Step 4: Get changes since previous release

If a previous tag exists, use `git log <prev_tag>..HEAD --pretty=format:"%s"` to get commit messages. If no previous release exists, get all commits.
You can also read the files changed in the commits to get more context.

## Step 5: Write release notes

Based on the commits, write release notes for a **customer audience**. Rules:

- Only include product-facing changes customers would want to know about: new features, improvements, bug fixes
- **Exclude** internal changes: CI/CD, refactoring, test updates, repo maintenance, build config
- Format as markdown with bullet points grouped by category (e.g. **Features**, **Improvements**, **Bug Fixes**)
- Keep descriptions concise and user-friendly — no commit hashes, no developer jargon
- If there are no customer-facing changes, write: "Maintenance release with internal improvements."

## Step 6: Create the GitHub release

Use `gh release create` to create the release:
- Tag: `<version>`
- Title: `<version>`
- Body: the release notes from Step 5
- Attach `dist/sftools.zip` as a release asset (if it exists)

Report the release URL when done.
