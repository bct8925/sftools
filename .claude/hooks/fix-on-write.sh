#!/bin/bash
FILE_PATH=$(jq -r '.tool_input.file_path')

# ESLint fix for JS/TS files
if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
  npx eslint --fix "$FILE_PATH" 2>/dev/null || true
fi

# Prettier for all supported file types
if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx|css|html|json)$ ]]; then
  npx prettier --write "$FILE_PATH" 2>/dev/null || true
fi
