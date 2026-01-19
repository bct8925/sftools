import { chromium, BrowserContext, Page, Worker } from 'playwright';
import path from 'path';
import type { SalesforceClient } from './salesforce-client';

interface ExtensionLoadResult {
  context: BrowserContext;
  extensionId: string;
  serviceWorker: Worker;
}

/**
 * Load the Chrome extension in a Playwright browser context
 * Note: Chrome extensions require headed mode (headless: false)
 */
export async function loadExtension(): Promise<ExtensionLoadResult> {
  // Extension root is the project root (where manifest.json lives)
  // dist/ contains the built files but manifest.json is at root level
  const extensionPath = path.resolve(process.cwd());

  // Launch Chrome with extension loaded
  // Chrome extensions require headed mode - headless doesn't support extensions
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      '--disable-gpu',
    ],
  });

  // Wait for service worker to be ready and extract extension ID
  let [background] = context.serviceWorkers();
  if (!background) {
    background = await context.waitForEvent('serviceworker');
  }

  // Extension ID is in the service worker URL: chrome-extension://<id>/...
  const extensionId = background.url().split('/')[2];

  return { context, extensionId, serviceWorker: background };
}

/**
 * Inject a connection into chrome.storage.local via the service worker
 * This happens BEFORE any page loads, so no flashing
 */
export async function injectConnectionViaServiceWorker(
  serviceWorker: Worker,
  salesforce: SalesforceClient
): Promise<void> {
  const connection = {
    id: salesforce.getConnectionId(),
    label: 'Test Connection',
    instanceUrl: salesforce.getInstanceUrl(),
    loginDomain: 'https://login.salesforce.com',
    accessToken: salesforce.getAccessToken(),
    refreshToken: null,
    clientId: null,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
  };

  // Inject the connection via service worker (no page needed)
  await serviceWorker.evaluate(async (conn) => {
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ connections: [conn] }, () => resolve());
    });
  }, connection);
}

/**
 * Navigate to extension app and wait for connection to be active
 */
export async function navigateToApp(
  page: Page,
  extensionId: string
): Promise<void> {
  await page.goto(`chrome-extension://${extensionId}/dist/pages/app/app.html`);
  await page.waitForLoadState('networkidle');

  // Wait for the connection to be active in the UI
  await page.waitForFunction(() => {
    const display = document.querySelector('.current-connection-display');
    return display && display.textContent && display.textContent.trim().length > 0;
  }, { timeout: 10000 });
}
