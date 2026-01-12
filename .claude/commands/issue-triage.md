---
description: Triage all open GitHub issues
allowed-tools: Read, Write, Edit, Bash, AskUserQuestion, mcp__github__*
model: sonnet
---

# GitHub Issue Triage Workflow

Process all open GitHub issues in the repository one at a time, allowing the user to choose actions for each issue.

## Step 1: Get Repository Info

Extract owner and repo from git remote URL.

Use Bash tool:
```bash
git remote get-url origin
```

Parse the URL to extract owner and repo:
- SSH format: `git@github.com:owner/repo.git`
- HTTPS format: `https://github.com/owner/repo.git`

Store the owner and repo values for use in GitHub MCP tool calls.

## Step 2: Fetch All Open Issues

Use the `mcp__github__list_issues` tool to get all open issues:
- `owner`: extracted owner
- `repo`: extracted repo
- `state`: "OPEN"
- `perPage`: 30

If there are more than 30 issues, handle pagination by calling the tool multiple times with the `page` parameter (page 2, 3, etc.) until all issues are retrieved.

Store the complete list of issues.

If no open issues found, display a message: "No open issues found in this repository." and exit.

## Step 3: Process Each Issue

For each issue in the list, follow this sequence:

### 3.1 Fetch Full Issue Details

Use `mcp__github__issue_read` twice to get complete context:

1. Get issue details:
   - `method`: "get"
   - `owner`: repo owner
   - `repo`: repo name
   - `issue_number`: current issue number

2. Get issue comments:
   - `method`: "get_comments"
   - `owner`: repo owner
   - `repo`: repo name
   - `issue_number`: current issue number

### 3.2 Present Summary to User

Display a formatted summary:

```
═══════════════════════════════════════════════════════════
Issue #{number}: {title}
═══════════════════════════════════════════════════════════

Description:
{first 300 characters of body, or full body if shorter}

Comments: {comment_count}

Key Information:
{Scan comments for:
 - Branch names (look for patterns like "branch `name`" or "Pushed to `name`")
 - @claude mentions
 - Other important context
 Display bullet points of findings}
```

### 3.3 Ask User for Action

Use the `AskUserQuestion` tool with these options:

**Question**: "What action should be taken for this issue?"

**Options**:
1. **"Add @claude comment"**
   - Description: "Post a comment with @claude to trigger a background agent to work on this issue"

2. **"Create PR from branch"**
   - Description: "Create a pull request from the branch @claude built (branch name will be found in comments or you can specify it)"

3. **"Work interactively"**
   - Description: "Start working on this issue now in this session - ask questions, create branch, implement solution"

4. **"Skip"**
   - Description: "Move to the next issue without taking any action"

### 3.4 Execute the Chosen Action

Based on user's selection, execute the corresponding action:

---

#### ACTION 1: Add @claude Comment

1. Use `AskUserQuestion` to ask:
   - Question: "Do you want to include any clarifying information for the background agent?"
   - Provide a text input option for the user to enter additional context
   - Include an option: "No additional context needed"

2. Build the comment text:
   - If user provided context: `@claude {user's context}`
   - If no context: `@claude`

3. Use `mcp__github__add_issue_comment`:
   - `owner`: repo owner
   - `repo`: repo name
   - `issue_number`: current issue number
   - `body`: the comment text from step 2

4. Display confirmation:
   ```
   ✓ Comment posted successfully on issue #{number}
   View comment: https://github.com/{owner}/{repo}/issues/{number}
   ```

---

#### ACTION 2: Create PR from Branch

1. **Find Branch Name**:
   - Scan through the issue comments for branch name patterns:
     - `branch `name``
     - `Pushed to `name``
     - `Created branch `name``
     - Branch names starting with `claude/` or containing the issue number

   - If a branch name is found in comments, display it to the user
   - If no branch found or multiple possible branches, use `AskUserQuestion`:
     - Question: "What is the branch name for this issue?"
     - Allow user to enter the branch name

2. **Verify Branch Exists**:
   - Use `mcp__github__list_branches` to get all branches
   - Check if the specified branch exists in the list
   - If branch doesn't exist:
     ```
     ✗ Branch "{branch}" not found in repository
     Skipping PR creation for issue #{number}
     ```
     Continue to next issue

3. **Check if Branch is Up-to-Date with Main**:
   - Use `mcp__github__list_commits` with `sha: "main"` and `perPage: 1` to get latest main commit
   - Use `mcp__github__list_commits` with `sha: "{branch}"` and `perPage: 10` to get branch commits
   - Check if the latest main commit is in the branch's commit list
   - If main commit is NOT in branch commits, the branch is behind main

4. **Merge Main into Branch if Behind**:

   If branch is behind main:

   a. Use Bash tool to fetch and merge:
   ```bash
   git fetch origin && git checkout {branch} && git merge origin/main
   ```

   b. Check the output for merge conflicts:
      - If output contains "CONFLICT" or "Automatic merge failed":

        i. Use Bash tool to list conflicted files:
        ```bash
        git status --short | grep '^UU\|^AA\|^DD\|^AU\|^UA\|^DU\|^UD'
        ```

        ii. For each conflicted file:
           - Use Read tool to read the file and show conflict markers to user
           - Use `AskUserQuestion`:
             - Question: "How should the conflict in {filename} be resolved?"
             - Options:
               1. "Use local version (current branch)" - Description: "Keep changes from the feature branch"
               2. "Use remote version (main)" - Description: "Keep changes from main branch"
               3. "Manual resolution" - Description: "I'll specify exactly what the resolved version should be"

           - If "Use local version":
             ```bash
             git checkout --ours {filename} && git add {filename}
             ```

           - If "Use remote version":
             ```bash
             git checkout --theirs {filename} && git add {filename}
             ```

           - If "Manual resolution":
             - Show the conflict markers to the user
             - Use `AskUserQuestion` to get the resolved content
             - Use Edit tool to replace the entire file content with user's resolution
             - Use Bash: `git add {filename}`

        iii. After all conflicts resolved:
        ```bash
        git commit -m "Merge main into {branch}"
        ```

        iv. Push the merged branch:
        ```bash
        git push origin {branch}
        ```

      - If no conflicts (merge successful):
        ```bash
        git push origin {branch}
        ```

5. **Check if PR Already Exists**:
   - Use `mcp__github__search_pull_requests`:
     - `owner`: repo owner
     - `repo`: repo name
     - `query`: `head:{branch} base:main`

   - If PR already exists:
     ```
     ℹ A pull request already exists for branch "{branch}"
     PR: {pr_url}
     Skipping PR creation for issue #{number}
     ```
     Continue to next issue

6. **Create Pull Request**:
   - Use `mcp__github__create_pull_request`:
     - `owner`: repo owner
     - `repo`: repo name
     - `title`: `Closes #{issue_number}: {issue_title}`
     - `body`: Generate body with:
       ```
       Closes #{issue_number}

       {First 500 characters of issue description}

       ---

       This PR was created by the /issue-triage command.
       ```
     - `base`: "main"
     - `head`: "{branch}"

7. **Display Confirmation**:
   ```
   ✓ Pull request created successfully for issue #{number}
   PR: {pr_url}
   ```

---

#### ACTION 3: Work Interactively

**CORE PRINCIPLE: This is an iterative, user-guided process. After each implementation step, you MUST get user confirmation that changes work before proceeding to commit/push. NEVER assume changes are correct without explicit user testing and approval.**

1. **Ask Clarifying Questions**:
   - Use `AskUserQuestion`:
     - Question: "What clarifying information is needed before implementing this issue?"
     - Provide a text input for user to enter any questions or context
     - Include option: "No clarification needed - proceed with implementation"

2. **Create Feature Branch**:
   - Generate branch name: `claude/issue-{number}-{YYYYMMDD}`
     - Use current date in YYYYMMDD format
     - Example: `claude/issue-42-20260112`

   - Use Bash tool:
     ```bash
     git checkout main && git pull origin main && git checkout -b {branch_name}
     ```

3. **Implement the Solution**:
   - Analyze the issue requirements
   - Use Read tool to examine relevant files in the repository
   - Use Edit or Write tools to implement the changes
   - Follow the repository's coding patterns and conventions
   - Make focused changes that address the issue requirements
   - **Note**: This step may repeat multiple times based on user testing feedback in step 4

4. **Test the Changes**:

   **CRITICAL: NEVER commit or push changes without explicit user confirmation that testing is complete.**

   - Check if tests exist in the repository (look for test files, package.json scripts, etc.)
   - If automated tests exist:
     - Use Bash tool to run the test command (e.g., `npm test`, `pytest`, `make test`)
     - Display test results to user
     - If tests fail, fix issues and re-run

   - **MANDATORY**: Use `AskUserQuestion` to get explicit testing confirmation:
     - Question: "Please test the changes. Do the changes work correctly?"
     - Options:
       1. "Yes, works perfectly" - Description: "I've tested and everything works correctly"
       2. "Needs adjustment" - Description: "I found issues that need to be fixed"

   - **IMPORTANT**:
     - If "Yes, works perfectly": Proceed to step 5 (Commit Changes)
     - If "Needs adjustment": Ask what needs to be fixed, make adjustments, and return to beginning of step 4 (test again)
     - DO NOT proceed to commit/push until user explicitly confirms "Yes, works perfectly"

5. **Commit Changes**:
   - Use Bash tool:
     ```bash
     git add . && git commit -m "Closes #{number}: {brief description of changes}"
     ```

6. **Push Branch**:
   - Use Bash tool:
     ```bash
     git push -u origin {branch_name}
     ```

   - Display confirmation:
     ```
     ✓ Branch "{branch_name}" created and pushed
     ```

7. **Ask About PR Creation**:
   - Use `AskUserQuestion`:
     - Question: "Do you want to create a pull request now?"
     - Options:
       1. "Yes, create PR" - Description: "Create a pull request for this branch now"
       2. "No, not yet" - Description: "Skip PR creation and move to next issue"

   - If "Yes, create PR":
     - Execute ACTION 2 logic (Create PR from Branch) using the branch just created

   - If "No, not yet":
     - Continue to next issue

---

#### ACTION 4: Skip

Display:
```
⊘ Skipped issue #{number}
```

Immediately continue to the next issue.

---

### 3.5 Continue to Next Issue

After completing the action (1, 2, 3, or 4), move to the next issue in the list and repeat steps 3.1-3.4.

## Step 4: Final Summary

After all issues have been processed (or user stops the command), display a comprehensive summary:

```
═══════════════════════════════════════════════════════════
ISSUE TRIAGE SUMMARY
═══════════════════════════════════════════════════════════

Total Issues Reviewed: {count}

Actions Taken:
  • @claude Comments Posted: {count}
  • PRs Created: {count}
  • Interactive Work Completed: {count}
  • Skipped: {count}

Pull Requests Created:
{For each PR created, show:}
  • PR #{pr_number}: {pr_title}
    → {pr_url}

Branches Created:
{For each branch created during interactive work:}
  • {branch_name} (for issue #{number})

═══════════════════════════════════════════════════════════
```

## Important Notes

- **Error Handling**: If any GitHub MCP tool call fails, display the error message and ask user if they want to retry, skip, or abort the entire triage process.

- **Git Operations**: All git operations should handle potential errors (permission issues, network failures, etc.) and ask user how to proceed.

- **Pagination**: When fetching issues, ensure all pages are retrieved if there are more than 30 issues.

- **Issue State**: Only fetch OPEN issues. Closed issues are not included in triage.

- **PR Linking**: Use "Closes #{number}" syntax in PR title and body to automatically link and close the issue when PR is merged.

- **Branch Verification**: Always verify branch exists before attempting PR creation to avoid errors.

- **Context Preservation**: Keep track of summary statistics throughout the process for the final summary.

- **User Control**: The user can stop the process at any time. Make sure to show the summary with statistics up to that point.
