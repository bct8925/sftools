# Screenshot Skill

Capture UI screenshots of the current branch's changes for PR documentation.

## How It Works

When invoked, this skill launches a **subagent** that autonomously handles the entire screenshot pipeline:

1. Analyzes the branch diff to determine what UI areas changed
2. Reads the diff to decide which states/interactions to capture
3. Writes a Playwright screenshot script tailored to those changes
4. Executes the script, captures screenshots
5. Visually verifies each screenshot (reads the PNG files)
6. Retries if any screenshots are wrong (clipped, wrong state, blank)
7. Returns the final screenshot paths and descriptions

The main conversation just gets back verified results — no iteration needed.

## Invocation

Launch the subagent using the Task tool:

```
Task(
    description: "Capture UI screenshots",
    subagent_type: "senior-dev",
    prompt: <see below>
)
```

### Subagent Prompt Template

The prompt MUST include:
1. The full SKILL.md reference (the "Subagent Instructions" section below)
2. The git diff context (changed files list and relevant diffs)
3. The project root path

```
You are a screenshot capture agent for the sftools Chrome Extension project.

Project root: /Users/briantaylor/dev/sftools

## Your Task

Capture UI screenshots showcasing the visual changes on this branch.

## Changed Files

<paste output of: git diff --name-only main...HEAD (filtered to src/ files only)>

## Diff

<paste the relevant src/ diff, or tell the agent to read it>

## Instructions

<paste the entire "Subagent Instructions" section below>
```

---

## Subagent Instructions

You are capturing screenshots for a Chrome Extension (React 19, TypeScript, Vite). The app runs in a headless browser with mocked Chrome APIs and Salesforce API responses.

### Step 1: Analyze Changes

Map changed paths to UI areas:

| Path Pattern | UI Area | Page URL |
|---|---|---|
| `src/components/query/` | Query Tab | `/pages/app/app.html` (default tab) |
| `src/components/schema/` | Schema Browser | `/pages/schema/schema.html?connectionId=screenshot-conn-1` |
| `src/components/record/` | Record Viewer | `/pages/record/record.html?objectType=X&recordId=Y&connectionId=screenshot-conn-1` |
| `src/components/apex/` | Apex Tab | `/pages/app/app.html` → click `[data-tab="apex"]` |
| `src/components/rest-api/` | REST API Tab | `/pages/app/app.html` → click `[data-tab="rest-api"]` |
| `src/components/events/` | Events Tab | `/pages/app/app.html` → click `[data-tab="events"]` |
| `src/components/debug-logs/` | Debug Logs Tab | `/pages/app/app.html` → click `[data-tab="debug-logs"]` |
| `src/components/settings/` | Settings | `/pages/app/app.html` → click `[data-tab="settings"]` |
| `src/components/utils/` | Utils Tab | `/pages/app/app.html` → click `[data-tab="utils"]` |
| General/shared | Main app view | `/pages/app/app.html` |

### Step 2: Determine States

Read the actual diff to decide what states to capture. Consider:
- Default/empty state
- Loaded state with data
- Interaction states (expanded panels, active selections, etc.)
- Error states (if the change involves error handling)

**Always capture light + dark theme** for the primary state. Additional states can be light-only.

### Step 3: Write the Script

Write a TypeScript file to `<project_root>/capture-screenshots.ts`. It **MUST** be in the project root so Node resolves `playwright` from `node_modules/`.

Use the script template below. Customize three sections:
1. **`setupMockRoutes`** — Add route handlers for the Salesforce API endpoints the UI area needs
2. **Navigation** — Go to the right page(s), interact to reach the target state
3. **Screenshots** — Capture with descriptive filenames, both themes

#### Script Template

```typescript
import { chromium, type BrowserContext, type Page } from 'playwright';
import { spawn, type ChildProcess } from 'child_process';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = '<PROJECT_ROOT>';
const SCREENSHOT_DIR = resolve(PROJECT_ROOT, 'screenshots');
const VITE_PORT = 5175;

function startVite(): Promise<ChildProcess> {
    return new Promise((resolve, reject) => {
        const proc = spawn('npx', ['vite', 'dev', '--port', String(VITE_PORT)], {
            cwd: PROJECT_ROOT,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: true,
        });
        let ready = false;
        const onData = (data: Buffer) => {
            const output = data.toString();
            if (!ready && (output.includes('ready in') || output.includes('Local:'))) {
                ready = true;
                resolve(proc);
            }
        };
        proc.stdout?.on('data', onData);
        proc.stderr?.on('data', onData);
        proc.on('error', err => reject(new Error(`Vite start failed: ${err.message}`)));
        proc.on('exit', code => {
            if (!ready) reject(new Error(`Vite exited with code ${code}`));
        });
        setTimeout(() => {
            if (!ready) { proc.kill('SIGTERM'); reject(new Error('Vite startup timed out')); }
        }, 30000);
    });
}

function buildChromeMockScript(): string {
    const connection = {
        id: 'screenshot-conn-1',
        label: 'Demo Org',
        instanceUrl: 'https://test.salesforce.com',
        loginDomain: 'https://login.salesforce.com',
        accessToken: 'mock-access-token',
        refreshToken: null,
        clientId: null,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
    };
    const storageJson = JSON.stringify({ connections: [connection], theme: 'light' });

    return `
(function() {
    const storage = ${storageJson};
    const storageListeners = [];
    const messageListeners = [];

    window.chrome = {
        storage: {
            local: {
                get(keys, callback) {
                    const result = {};
                    let keyList;
                    if (keys === null || keys === undefined) keyList = Object.keys(storage);
                    else if (typeof keys === 'string') keyList = [keys];
                    else if (Array.isArray(keys)) keyList = keys;
                    else if (typeof keys === 'object') {
                        keyList = Object.keys(keys);
                        for (const key of keyList) result[key] = keys[key];
                    } else keyList = [];
                    for (const key of keyList) {
                        if (storage[key] !== undefined) result[key] = storage[key];
                    }
                    if (callback) { callback(result); return; }
                    return Promise.resolve(result);
                },
                set(items, callback) {
                    const changes = {};
                    for (const [key, value] of Object.entries(items)) {
                        const oldValue = storage[key];
                        storage[key] = value;
                        changes[key] = { oldValue, newValue: value };
                    }
                    for (const listener of storageListeners) {
                        try { listener(changes, 'local'); } catch(e) {}
                    }
                    if (callback) { callback(); return; }
                    return Promise.resolve();
                },
                remove(keys, callback) {
                    const keyList = Array.isArray(keys) ? keys : [keys];
                    for (const key of keyList) delete storage[key];
                    if (callback) { callback(); return; }
                    return Promise.resolve();
                },
                clear(callback) {
                    for (const key of Object.keys(storage)) delete storage[key];
                    if (callback) { callback(); return; }
                    return Promise.resolve();
                }
            },
            onChanged: {
                addListener(cb) { storageListeners.push(cb); },
                removeListener(cb) { const i = storageListeners.indexOf(cb); if (i !== -1) storageListeners.splice(i, 1); },
                hasListener(cb) { return storageListeners.includes(cb); }
            }
        },
        runtime: {
            id: 'test-extension-id',
            sendMessage(message) {
                const handlers = {
                    'fetch': () => ({ success: false, error: '__USE_DIRECT_FETCH__' }),
                    'proxyFetch': () => ({ success: false, error: '__USE_DIRECT_FETCH__' }),
                    'checkProxyConnection': () => ({ connected: true }),
                    'getProxyInfo': () => ({ success: true, connected: true, httpPort: 7443, version: '1.0.0-test' }),
                    'connectProxy': () => ({ success: false, error: 'Not available' }),
                    'disconnectProxy': () => ({}),
                    'tokenExchange': () => ({ success: false, error: 'Not available' })
                };
                const handler = handlers[message.type];
                return Promise.resolve(handler ? handler() : {});
            },
            onMessage: {
                addListener(cb) { messageListeners.push(cb); },
                removeListener(cb) { const i = messageListeners.indexOf(cb); if (i !== -1) messageListeners.splice(i, 1); },
                hasListener(cb) { return messageListeners.includes(cb); }
            },
            getManifest() {
                return { manifest_version: 3, name: 'sftools Test Mode', version: '1.0.0', oauth2: { client_id: 'test-client-id', scopes: [] } };
            },
            getURL(path) { return path.startsWith('/') ? path : '/' + path; }
        }
    };

    window.__chromeMock = {
        storage,
        setStorage(data) { Object.assign(storage, data); },
        getStorage() { return { ...storage }; },
        clearStorage() { for (const key of Object.keys(storage)) delete storage[key]; },
        triggerStorageChange(changes) {
            for (const listener of storageListeners) { try { listener(changes, 'local'); } catch(e) {} }
        }
    };
})();
`;
}

// ---------------------------------------------------------------------------
// CUSTOMIZE: Mock Routes
// ---------------------------------------------------------------------------
async function setupMockRoutes(context: BrowserContext) {
    await context.route(/.*salesforce\.com\/.*/, async route => {
        const url = route.request().url();
        const method = route.request().method();

        // Add if/else handlers for the API endpoints your UI area needs.
        //
        // Common patterns:
        //
        // Global describe (schema browser object list):
        //   if (method === 'GET' && /\/sobjects\/?$/.test(url)) { ... }
        //
        // Object describe (schema browser field list):
        //   if (method === 'GET' && /\/sobjects\/Account\/describe/.test(url)) { ... }
        //
        // SOQL query (query tab):
        //   if (method === 'GET' && /\/query/.test(url)) { ... }
        //
        // Apex execution:
        //   if (method === 'GET' && /\/tooling\/executeAnonymous/.test(url)) { ... }
        //
        // Record retrieval:
        //   if (method === 'GET' && /\/sobjects\/Account\/001/.test(url)) { ... }

        // Default fallback — prevents real API calls
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ records: [], totalSize: 0 }),
        });
    });
}

// ---------------------------------------------------------------------------
// Screenshot Helpers
// ---------------------------------------------------------------------------
async function screenshot(page: Page, name: string) {
    await page.screenshot({
        path: resolve(SCREENSHOT_DIR, `${name}.png`),
        fullPage: false,
    });
    console.log(`  ✓ ${name}.png`);
}

async function setTheme(page: Page, theme: 'light' | 'dark') {
    await page.evaluate(t => {
        document.documentElement.setAttribute('data-theme', t);
        if ((window as any).__chromeMock) {
            (window as any).__chromeMock.setStorage({ theme: t });
        }
    }, theme);
    await page.waitForTimeout(300);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    let viteProc: ChildProcess | null = null;
    let context: BrowserContext | null = null;

    try {
        console.log('Starting Vite dev server...');
        viteProc = await startVite();
        console.log('Vite ready');

        const browser = await chromium.launch({ headless: true });
        context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
        context.setDefaultTimeout(15000);
        await context.addInitScript(buildChromeMockScript());
        await setupMockRoutes(context);

        const baseUrl = `http://localhost:${VITE_PORT}`;
        const page = await context.newPage();

        // CUSTOMIZE: Navigation and screenshots here

        console.log(`\nScreenshots saved to: ${SCREENSHOT_DIR}`);
        await context.close();
        await browser.close();
    } finally {
        if (viteProc) viteProc.kill('SIGTERM');
    }
}

main().catch(err => {
    console.error('Screenshot capture failed:', err);
    process.exit(1);
});
```

### Step 4: Execute

```bash
npx tsx <project_root>/capture-screenshots.ts
```

If the script fails, read the error, fix the script, and re-run. Common failures:
- Selector not found → check `data-testid` values by reading the component source
- Timeout → increase `waitForTimeout` or add `waitForSelector` before interaction
- Vite port conflict → kill stale Vite processes: `lsof -ti:5175 | xargs kill`

### Step 5: Verify Screenshots

**This step is mandatory.** Use the Read tool to view each `.png` file and check:

- [ ] The correct UI area is shown
- [ ] Expanded panels / detail rows are fully visible (not clipped at viewport edge)
- [ ] Both light and dark themes rendered correctly (dark should have dark backgrounds)
- [ ] Mock data looks realistic (real Salesforce field names, not "test123")
- [ ] No blank/empty areas where content should be

If ANY screenshot fails verification:
1. Identify the issue (scrolling, timing, wrong selector, missing mock data)
2. Edit the script to fix it
3. Re-run the script
4. Re-verify

### Step 6: Clean Up and Report

Delete the script file:

```bash
rm <project_root>/capture-screenshots.ts
```

Return a response in this format:

```
Screenshots captured in screenshots/:

- screenshots/01-name-light.png — Description of what it shows
- screenshots/02-name-dark.png — Same, dark theme
- ...

All screenshots verified ✓
```

### Critical Rules

1. **Script location:** MUST be in the project root. Node resolves `playwright` relative to the script file. `/tmp` and scratchpad paths will fail with "Cannot find module 'playwright'".

2. **Scrolling:** Always `scrollIntoViewIfNeeded()` BEFORE clicking an element, and BEFORE taking a screenshot. Expanded panels push content below the 720px viewport. For detail panels, scroll to the **last row of interest**, not just the parent.

3. **Timing:**
   - `400ms` after clicking to expand/collapse
   - `300ms` after `setTheme()` for CSS transitions
   - `200ms` after scroll for settle
   - `networkidle` after page navigation

4. **Connection ID:** The mock connection `id` (`screenshot-conn-1`) must match the `connectionId` URL parameter for schema browser and record viewer pages.

5. **Default timeout:** Use `context.setDefaultTimeout(15000)`. First Vite compile can be slow.

6. **Mock data quality:** Use realistic Salesforce object/field names and types. Screenshots go into PRs.

7. **Vite port:** Use `5175` to avoid conflict with the test server on `5174`.

### Schema Browser Selectors

- Object list item: `[data-testid="schema-object-item"][data-object-name="Account"]`
- Field list item: `[data-testid="schema-field-item"][data-field-name="Name"]`
- Field detail panel: `[data-testid="schema-field-detail"][data-field-name="Name"]`
- Detail row by label: `[data-detail-label="Size"]`, `[data-detail-label="Properties"]`, `[data-detail-label="Relationship"]`
- Property tags: `[data-testid="schema-field-property-tag"]`
- Picklist tags: `[data-testid="schema-field-picklist-tag"]`

### Query Tab Selectors

- Execute button: `[data-testid="query-execute"]`
- Results table: `[data-testid="query-results-table"]`
- Status badge: `[data-testid="query-status"]`

### Main App Tab Switching

```typescript
await page.click('[data-tab="apex"]');     // or query, rest-api, events, debug-logs, settings, utils
await page.waitForLoadState('networkidle');
```
