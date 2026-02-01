#!/bin/bash
FILE_PATH=$(jq -r '.tool_input.file_path')
if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx|css|html|json)$ ]]; then
  npx prettier --write "$FILE_PATH" 2>/dev/null || true
fi
