chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: 'app.html' });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'fetch') {
    fetch(request.url, request.options)
      .then(response => {
        // Capture status and statusText before reading body
        const status = response.status;
        const statusText = response.statusText;
        return response.text().then(data => ({ success: response.ok, status, statusText, data }));
      })
      .then(data => sendResponse(data))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});