// Parse OAuth tokens from URL hash
const hash = window.location.hash.substring(1);
const params = new URLSearchParams(hash);

const accessToken = params.get('access_token');
const instanceUrl = params.get('instance_url');

const statusEl = document.getElementById('status');
statusEl.innerText = 'Processing tokens...';

setTimeout(() => {
    if (accessToken && instanceUrl) {
        chrome.storage.local.set({
            accessToken: accessToken,
            instanceUrl: instanceUrl
        }, function() {
            statusEl.innerText = 'Session acquired. Redirecting to sftools...';

            setTimeout(() => {
                window.location.href = '../../dist/app.html';
            }, 500);
        });
    } else {
        statusEl.innerHTML = '<span class="error">Failed to acquire access token.</span><br>Please ensure your Connected App settings are correct and try again.';
    }
}, 500);
