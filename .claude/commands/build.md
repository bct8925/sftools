---
description: Build the extension and verify output
allowed-tools: Bash(npm run build:*), Bash(npm run watch:*), Bash(ls:*), Glob, Read
model: haiku
---

# Build Workflow

Build the Chrome extension and verify the output.

## Step 1: Clean Build

```bash
npm run build
```

## Step 2: Verify Output

Check that all expected files are generated:

```bash
ls -la dist/
ls -la dist/pages/
ls -la dist/chunks/
```

### Expected Structure

```
dist/
├── pages/
│   ├── app/
│   │   ├── app.html
│   │   └── app.js
│   ├── callback/
│   │   ├── callback.html
│   │   └── callback.js
│   ├── record/
│   │   ├── record.html
│   │   └── record.js
│   └── schema/
│       ├── schema.html
│       └── schema.js
├── chunks/           # Shared code chunks
├── assets/           # Monaco workers, fonts
├── background.js     # Service worker
├── style.css         # Global styles
├── app.css           # Tab component styles
├── record.css        # Record page styles
├── schema.css        # Schema page styles
└── icon.png          # Extension icon
```

## Step 3: Check for Errors

The build should complete without errors. Watch for:

- Missing imports
- Syntax errors
- Circular dependencies
- Missing files

## Step 4: Report

```
## Build Results

### Status: SUCCESS / FAILED

### Output Files
- pages/: X files
- chunks/: X files
- assets/: X files
- CSS: X files
- Total size: X KB

### Issues (if any)
- [Issue description]

### Next Steps
- Load extension in Chrome to verify
- Run tests: npm run test:frontend
```

## Watch Mode

For development:
```bash
npm run watch
```

This rebuilds automatically on file changes.

## Production Package

For release:
```bash
npm run package
```

This creates a zip file with production build.
