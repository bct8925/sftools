// Service Worker for sftools Chrome Extension

// Open app.html when extension icon is clicked
chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: 'dist/app.html' });
});

// Fetch proxy to bypass CORS restrictions
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'fetch') {
        fetch(request.url, request.options)
            .then(response => {
                const status = response.status;
                const statusText = response.statusText;
                // Extract headers to a plain object
                const headers = {};
                response.headers.forEach((value, key) => {
                    headers[key.toLowerCase()] = value;
                });
                return response.text().then(data => ({
                    success: response.ok,
                    status,
                    statusText,
                    headers,
                    data
                }));
            })
            .then(data => sendResponse(data))
            .catch(error => sendResponse({
                success: false,
                error: error.message
            }));
        return true; // Keep message channel open for async response
    }
});
