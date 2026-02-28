---
description: Generate release notes and create a GitHub release for the current version
allowed-tools: Bash(jq:*), Bash(gh release view:*), Bash(gh release list:*), Bash(gh release create:*), Bash(git log:*), Bash(git diff:*), Bash(git tag:*), Read
---

# Generate Release Notes

Generate customer-facing release notes for the current version and create a GitHub release.

## Step 1: Get current version

Read the version from `manifest.json` using `jq -r '.version' manifest.json`. Use this exact version string everywhere (tags, titles, etc.) — do not add a `v` prefix or modify it in any way.

## Step 2: Check if release already exists

Use `gh release view "<version>"` to check if a release for this version already exists. If it does, stop and report that the release already exists.

## Step 3: Find the previous release

Do NOT use `gh release list` — it sorts by creation date, not version, and can return the wrong tag.

Instead, use version-sorted git tags:
1. Run `git tag --sort=-version:refname` to list all tags sorted by semver, highest first
2. Find the first tag in that list that (a) is not the current version and (b) is an ancestor of HEAD: `git merge-base --is-ancestor <tag> HEAD`
3. Confirm the tag has a corresponding GitHub release: `gh release view <tag> --json tagName -q '.tagName'`

This guarantees you select the true version predecessor, not just the most recently created release.

## Step 4: Get changes since previous release

First, get the list of commit subjects:
`git log <prev_tag>..HEAD --oneline`
If no previous release exists, get all commits.

**Sanity check before proceeding:** Count the commits and inspect the date range:
- `git log <prev_tag>..HEAD --oneline | wc -l` — total commit count
- `git log <prev_tag>..HEAD --format="%ci" | tail -1` — date of earliest commit in range
- `git log <prev_tag>..HEAD --format="%ci" | head -1` — date of most recent commit in range

If the range spans **more than ~50 commits** or **more than 60 days**, stop and flag this as a potentially wrong tag selection. Re-examine Step 3 and verify the previous tag before continuing.

Then, to understand what each commit actually changed, iterate through the commits in batches of ~10 using:
`git log <prev_tag>..HEAD --stat --skip=N --max-count=10`

Walk through all batches (skip=0, skip=10, skip=20, etc.) until you've covered every commit. Use the file change stats to determine which commits are customer-facing vs internal.

If a commit message is ambiguous, use `git log <hash> -1 -p` or read the changed source files to understand what the change actually does.

## Step 4.5: Cross-reference previous release notes

Fetch the body of the previous release:
`gh release view <prev_tag> --json body -q '.body'`

Read the previous release notes carefully. **Any item already described in the previous release notes MUST NOT appear in the new notes**, even if a related commit shows up in the log range. This prevents duplicate items from bleeding across releases.

## Step 5: Write release notes

Based on the commits, write release notes for a **customer audience**. Rules:

- Describe only what **changed** since the last release — do NOT describe existing features or the product as a whole
- Only include product-facing changes: new features, improvements, bug fixes
- **Exclude** internal changes: CI/CD, refactoring, test updates, repo maintenance, build config
- Format as markdown with bullet points grouped by category (e.g. **Features**, **Improvements**, **Bug Fixes**)
- Each bullet should describe the change, not the feature (e.g. "Added dark mode support" not "Dark mode lets you switch between light and dark themes")
- Keep descriptions concise — no commit hashes, no developer jargon
- If a commit message references a GitHub issue or PR (e.g. `#72`, `(#72)`), link it in the release note using the `#72` shorthand syntax (GitHub auto-links these in release bodies)
- If there are no customer-facing changes, write: "Maintenance release with internal improvements."

## Step 6: Create the GitHub release

Use `gh release create` to create the release:
- Tag: `<version>`
- Title: `<version>`
- Body: the release notes from Step 5
- Attach `sftools.zip` as a release asset (if it exists)

Report the release URL when done.
