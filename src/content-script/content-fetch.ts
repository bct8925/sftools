// Content script fetch relay — injected into Salesforce tabs to make same-origin API calls.
// Self-contained: no imports, no dependencies. Runs in page origin to bypass CORS.

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
