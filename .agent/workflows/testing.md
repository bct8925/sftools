---
description: How to test changes using the browser subagent
---

# sftools Development Workflow

This document outlines the standard workflow for developing and testing the `sftools` extension using the **Real Extension** environment.

## Standard Workflow

### 1. Make Changes & Build
After modifying the code, rebuild the project:
```bash
npm run build
```

### 2. Reload Extension
You do **not** need to visit `chrome://extensions`.

1.  Open the extension app:
    [chrome-extension://mckblnkfhlgocgmehmnihmagmhbnjioj/dist/pages/app/app.html](chrome-extension://mckblnkfhlgocgmehmnihmagmhbnjioj/dist/pages/app/app.html)
2.  Navigate to **Settings** -> **Developer**.
3.  Click **Reload Extension**.

> [!NOTE]
> Clicking "Reload Extension" will restart the extension process. **The tab will close.** You must verify your changes by opening the URL again.

### 3. Verify Changes
Re-open the app link above to verify your changes.


