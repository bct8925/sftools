#!/bin/bash
COMMAND=$(jq -r '.tool_input.command')
if [[ "$COMMAND" == *"rm -rf"* ]] || [[ "$COMMAND" == *"--force"* && "$COMMAND" == *"push"* ]]; then
  echo "BLOCKED: Dangerous command requires confirmation" >&2
  exit 2
fi
