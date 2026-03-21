// Content script injection and tab tracking for CORS bypass

import { debugInfo } from './debug';

const injectedTabs = new Set<number>();

const SALESFORCE_PATTERNS = [
    /\.salesforce\.com/,
    /\.force\.com/,
    /\.visualforce\.com/,
    /\.salesforce-sites\.com/,
];

export function isSalesforceUrl(url: string): boolean {
    return SALESFORCE_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Content script function injected into Salesforce tabs.
 * Must be self-contained — no closures over outer scope.
 */
function contentFetchScript() {
    // Guard against double-injection
    if ((window as unknown as Record<string, boolean>).__sftools_content_fetch) return;
    (window as unknown as Record<string, boolean>).__sftools_content_fetch = true;

    chrome.runtime.onMessage.addListener(
        (
            message: {
                type: string;
                url: string;
                method?: string;
                headers?: Record<string, string>;
                body?: string;
            },
            _sender: chrome.runtime.MessageSender,
            sendResponse: (response: unknown) => void
        ) => {
            if (message.type !== 'contentFetch') return false;

            fetch(message.url, {
                method: message.method || 'GET',
                headers: message.headers,
                body: message.body,
            })
                .then(async response => {
                    const headers: Record<string, string> = {};
                    response.headers.forEach((value, key) => {
                        headers[key.toLowerCase()] = value;
                    });
                    sendResponse({
                        success: response.ok,
                        status: response.status,
                        statusText: response.statusText,
                        data: await response.text(),
                        headers,
                    });
                })
                .catch(error => {
                    sendResponse({
                        success: false,
                        status: 0,
                        error: error instanceof Error ? error.message : 'Network error',
                    });
                });

            return true; // async response
        }
    );
}

export async function injectContentScript(tabId: number): Promise<boolean> {
    if (injectedTabs.has(tabId)) return true;

    if (!chrome.scripting) {
        debugInfo('[content-script] scripting API not available — permission not granted');
        return false;
    }

    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            func: contentFetchScript,
        });
        injectedTabs.add(tabId);
        debugInfo('[content-script] Injected into tab', tabId);
        return true;
    } catch (error) {
        debugInfo('[content-script] Injection failed:', (error as Error).message);
        return false;
    }
}

export async function sendFetchToContentScript(
    tabId: number,
    url: string,
    method?: string,
    headers?: Record<string, string>,
    body?: string
): Promise<{
    success: boolean;
    status: number;
    statusText?: string;
    data?: string;
    headers?: Record<string, string>;
    error?: string;
}> {
    // Ensure content script is injected
    const injected = await injectContentScript(tabId);
    if (!injected) {
        return { success: false, status: 0, error: 'Failed to inject content script' };
    }

    try {
        const response = await chrome.tabs.sendMessage(tabId, {
            type: 'contentFetch',
            url,
            method,
            headers,
            body,
        });
        return response;
    } catch (error) {
        // Content script may have been invalidated (tab navigated)
        injectedTabs.delete(tabId);
        return { success: false, status: 0, error: (error as Error).message };
    }
}

export async function getActiveSalesforceTabId(): Promise<number | null> {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        // Note: tab.url is only available with the "tabs" permission.
        // With just "activeTab", we can't read the URL — so skip the URL check
        // and rely on injection failing gracefully for non-Salesforce tabs.
        if (tab?.id) {
            return tab.id;
        }
    } catch {
        // tabs API not available
    }
    return null;
}

export function isTabInjected(tabId: number): boolean {
    return injectedTabs.has(tabId);
}

export function removeTab(tabId: number): void {
    injectedTabs.delete(tabId);
}

// Clean up tracking when tabs close or navigate away
chrome.tabs.onRemoved.addListener((tabId: number) => {
    removeTab(tabId);
});

chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo) => {
    // Re-injection needed after navigation
    if (changeInfo.status === 'loading') {
        removeTab(tabId);
    }
});
