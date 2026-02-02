#!/bin/bash
COMMAND=$(jq -r '.tool_input.command')
if echo "$COMMAND" | grep -q 'git commit'; then
  cd "$(git rev-parse --show-toplevel)" || exit 2
  OUTPUT=$(npm run validate 2>&1)
  if [ $? -ne 0 ]; then
    echo "BLOCKED: npm run validate failed. Fix errors before committing." >&2
    echo "$OUTPUT" | tail -20 >&2
    exit 2
  fi
  if ! git diff --quiet; then
    echo "validate auto-fixed files, auto-staging:" >&2
    git diff --name-only >&2
    git add -u
  fi
fi
