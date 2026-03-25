# Chrome Extension: CSV-Driven File Upload Plan

## Overview

This document describes the architecture for a Chrome Extension (Manifest V3) that reads a CSV file containing a list of filenames, locates those files within a user-selected directory, and uploads each file individually via a multipart POST request. The design prioritizes low memory usage, sequential processing, and compatibility with MV3 constraints.

---

## Architecture Summary

```
User clicks "Select CSV" → showOpenFilePicker() → parse CSV → extract filenames
User clicks "Select Folder" → showDirectoryPicker() → get directory handle
For each filename in CSV:
    dirHandle.getFileHandle(filename) → file.getFile() → FormData → fetch POST
    Update progress UI
```

All logic runs in an **extension page** (side panel or dedicated tab). The service worker is not involved in the upload flow.

---

## UI Surface: Side Panel vs. Dedicated Tab

The upload UI must live in a long-lived extension page context. There are two good options and one non-starter.

### Dedicated Tab (Recommended)

Open via `chrome.tabs.create({ url: "upload.html" })`. This is the safest choice for a long-running sequential upload because users are unlikely to accidentally close it. It behaves like a normal tab — it survives navigation in other tabs and is visually prominent.

### Side Panel

Registered via `"side_panel"` in the manifest. Stays open alongside the user's browsing. The risk is that the user may close it mid-upload (intentionally or not), which kills the entire process. Suitable if uploads are fast or if the extension already uses the side panel for other features.

### Popup (Non-Starter)

The popup closes the moment the user clicks outside of it — including when the OS file picker dialog opens. This makes it fundamentally incompatible with `showOpenFilePicker()`, `showDirectoryPicker()`, or even `<input type="file">`. Do not use the popup for this workflow.

---

## Core Implementation

### Step 1: Select and Parse the CSV

```js
const [csvHandle] = await window.showOpenFilePicker({
  types: [{ description: "CSV files", accept: { "text/csv": [".csv"] } }],
});
const csvFile = await csvHandle.getFile();
const csvText = await csvFile.text();
const filenames = parseCSV(csvText); // extract the relevant column
```

The `parseCSV` function should handle your specific CSV structure — identify which column contains the filename, handle quoting, and trim whitespace. If filenames include relative subdirectory paths (e.g., `subdir/file.pdf`), preserve those for directory traversal later.

### Step 2: Select the Source Directory

```js
const dirHandle = await window.showDirectoryPicker({ mode: "read" });
```

The user sees a native OS directory picker. Once confirmed, the extension receives a `FileSystemDirectoryHandle` with read access to the entire directory tree. No special Chrome extension permissions are required for this — it's a standard web API gated by user gesture.

### Step 3: Sequential Upload Loop

```js
const results = { success: 0, failed: 0, errors: [] };

for (let i = 0; i < filenames.length; i++) {
  const filename = filenames[i];
  updateProgress(i, filenames.length, filename);

  try {
    const fileHandle = await getFileHandle(dirHandle, filename);
    const file = await fileHandle.getFile();

    const formData = new FormData();
    formData.append("file", file, filename);
    // Append any additional fields your API requires

    const response = await fetch("https://your-api.com/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    results.success++;
  } catch (err) {
    results.failed++;
    results.errors.push({ filename, error: err.message });
  }
}

showSummary(results);
```

This processes one file at a time. Only one `File` blob exists in memory at any given moment. The garbage collector can reclaim each file after its `fetch` completes.

### Helper: Resolve Nested Paths

If your CSV contains paths like `reports/q1/summary.pdf` rather than flat filenames, you need to walk subdirectories:

```js
async function getFileHandle(dirHandle, relativePath) {
  const parts = relativePath.split("/");
  const fileName = parts.pop();
  let current = dirHandle;
  for (const dir of parts) {
    current = await current.getDirectoryHandle(dir);
  }
  return current.getFileHandle(fileName);
}
```

If all filenames are flat (no subdirectories), you can simplify to `dirHandle.getFileHandle(filename)` directly.

---

## Manifest Configuration

```json
{
  "manifest_version": 3,
  "name": "File Uploader",
  "version": "1.0",
  "permissions": [],
  "host_permissions": [
    "https://your-api.com/*"
  ],
  "action": {
    "default_popup": "popup.html"
  },
  "side_panel": {
    "default_path": "sidepanel.html"
  }
}
```

If using a dedicated tab instead of a side panel, remove the `side_panel` entry and have the popup (or action click) call `chrome.tabs.create({ url: "upload.html" })`.

---

## Gotchas and Considerations

### 1. CORS and Host Permissions

Fetch requests from extension pages have a `chrome-extension://<id>` origin. Most API servers will reject this with a CORS error. The fix is `host_permissions` in the manifest:

```json
"host_permissions": ["https://your-api.com/*"]
```

With this declared, Chrome bypasses CORS preflight entirely for requests made from extension pages and the service worker. Without it, uploads will silently fail with opaque network errors.

**Important:** This only works for requests made from extension contexts (popup, side panel, extension pages, service worker). Content scripts still go through normal CORS.

### 2. Content Security Policy (CSP)

MV3 extension pages cannot run inline `<script>` tags. All JavaScript must be in separate `.js` files:

```html
<!-- ✅ Correct -->
<script src="uploader.js"></script>

<!-- ❌ Will be blocked by CSP -->
<script>
  console.log("this won't run");
</script>
```

Also blocked: `eval()`, `new Function()`, inline event handlers like `onclick="..."` in HTML attributes. Use `addEventListener` in your JS files instead.

### 3. User Gesture Requirement

Both `showOpenFilePicker()` and `showDirectoryPicker()` require a user gesture (click, keypress, etc.). You cannot call them programmatically on page load, from a timer, or from the service worker. Wire them to explicit button clicks:

```js
document.getElementById("select-csv").addEventListener("click", async () => {
  const [csvHandle] = await window.showOpenFilePicker(/* ... */);
  // ...
});
```

If the user gesture chain is broken (e.g., calling the picker after an `await` that takes too long), the browser may reject the call. Keep the path from click to picker call as short as possible.

### 4. Service Worker Limitations

The MV3 service worker is fundamentally unsuitable for this workflow for three reasons:

- **No File System Access API.** `showDirectoryPicker()` and `showOpenFilePicker()` are not available in service workers.
- **Termination.** The service worker is killed after ~30 seconds of inactivity. A sequential upload of hundreds of files will be interrupted.
- **Message passing overhead.** Even if you tried to relay file data from the extension page through `chrome.runtime.sendMessage`, message serialization has size limits and significant overhead for large blobs.

Keep the entire flow — CSV parsing, directory access, file reading, and HTTP uploads — in the extension page.

### 5. Popup Dismissal

Clicking either file picker from the popup will cause the popup to lose focus and close, destroying the entire JavaScript context. This is not a timing issue or a race condition — it is by design. The popup is a transient UI surface.

If you want the popup to serve as the entry point, have it open a dedicated tab or activate the side panel, then close:

```js
// In popup.js
chrome.tabs.create({ url: chrome.runtime.getURL("upload.html") });
window.close();
```

### 6. Handle Persistence and Reuse

`FileSystemDirectoryHandle` and `FileSystemFileHandle` objects can be stored in IndexedDB (they are structured-cloneable). This is useful if users will repeatedly upload from the same directory:

```js
// Store after first pick
const db = await openDB();
await db.put("handles", dirHandle, "upload-dir");

// Retrieve on next session
const stored = await db.get("handles", "upload-dir");
if (stored) {
  const permission = await stored.requestPermission({ mode: "read" });
  if (permission === "granted") {
    // Reuse the handle without re-picking
  }
}
```

The permission grant does not persist across extension restarts — the user will see a re-prompt, but they won't have to re-navigate the directory picker.

### 7. File Not Found Handling

`getFileHandle(filename)` throws a `NotFoundError` if the file doesn't exist in the directory. Your CSV may reference files that are missing, renamed, or have case-sensitivity mismatches (especially across OS platforms). Handle this gracefully:

```js
try {
  const fileHandle = await dirHandle.getFileHandle(filename);
} catch (err) {
  if (err.name === "NotFoundError") {
    // Log it, skip it, add to error report
  } else {
    throw err;
  }
}
```

Consider doing a pre-validation pass: iterate the directory to build a Set of actual filenames, then diff against the CSV list before starting uploads. This gives the user a chance to fix issues before committing to a long upload.

### 8. Rate Limiting and Retry Logic

Sequential requests to the same endpoint may trigger server-side rate limits. Consider adding:

- **A small delay between requests** if the server requires it: `await new Promise(r => setTimeout(r, 200));`
- **Retry with exponential backoff** for transient failures (429, 503, network errors):

```js
async function uploadWithRetry(formData, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch("https://your-api.com/upload", {
        method: "POST",
        body: formData,
      });
      if (res.status === 429 || res.status >= 500) {
        await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
}
```

### 9. Progress and Resumability

For large file lists, the user needs to see progress. Track state so that if the page is closed and reopened, the user can resume:

- Maintain an index counter. After each successful upload, persist the index to `chrome.storage.local`.
- On page load, check for a saved index and offer to resume from where it left off.
- Display: current file name, progress count (e.g., "47 / 312"), success/fail tallies, and a scrollable error log.

### 10. Authentication Headers

If your API requires authentication (Bearer token, API key, cookies), note that `FormData`-based `fetch` does not set a `Content-Type` header manually — the browser sets it with the multipart boundary. Do not override it:

```js
// ✅ Correct — let the browser set Content-Type
const response = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    // Do NOT set Content-Type here
  },
  body: formData,
});

// ❌ Wrong — this breaks the multipart boundary
headers: {
  "Content-Type": "multipart/form-data", // missing boundary string
}
```

### 11. Large File Considerations

If individual files can be very large (100MB+), consider:

- **Streaming uploads** using `ReadableStream` (limited browser support with `fetch`).
- **Chunked uploads** if your API supports it — split the file into parts and upload sequentially.
- **Memory monitoring** — even though you process one file at a time, a 500MB file will still consume 500MB of memory while the upload is in flight.

### 12. Filename Encoding and Special Characters

Filenames in the CSV may contain spaces, unicode characters, or characters that need special handling. `FormData.append(name, file, filename)` handles encoding correctly, but ensure your CSV parser preserves these characters faithfully. Watch for BOM (byte order mark) at the start of CSV files — strip `\uFEFF` if present.

---

## Recommended Project Structure

```
extension/
├── manifest.json
├── popup.html          # Minimal — just a button to open the upload page
├── popup.js
├── upload.html         # Dedicated upload page (or sidepanel.html)
├── upload.js           # All upload logic
├── upload.css          # Styling
├── csv-parser.js       # CSV parsing utility
└── service-worker.js   # Minimal — not involved in uploads
```

---

## Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| File access method | File System Access API | Direct filename lookup via `getFileHandle()` |
| Upload strategy | Sequential, one file at a time | Minimal memory footprint |
| Upload location | Extension page (tab or side panel) | Long-lived context, no service worker termination risk |
| CORS handling | `host_permissions` in manifest | Bypasses CORS entirely for extension pages |
| Error handling | Skip and log per file | Don't block the entire batch on one failure |
| Progress persistence | `chrome.storage.local` | Enables resume after page close |
| Directory reuse | `IndexedDB` handle storage | Avoids re-picking on repeat sessions |

https://developer.mozilla.org/en-US/docs/Web/API/FileSystemDirectoryHandle
https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/dome_sobject_insert_update_blob.htm
https://medium.com/deno-the-complete-reference/sending-form-data-using-fetch-in-node-js-8cedd0b2af85
https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/webkitdirectory