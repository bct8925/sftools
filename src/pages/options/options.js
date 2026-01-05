// Options page for sftools

const statusIndicator = document.getElementById('proxy-status-indicator');
const statusLabel = document.getElementById('proxy-status-label');
const statusDetail = document.getElementById('proxy-status-detail');
const connectBtn = document.getElementById('connect-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const versionInfo = document.getElementById('version-info');

/**
 * Update the UI to reflect proxy connection status
 */
function updateUI(status) {
    const { connected, httpPort, version, error } = status;

    statusIndicator.className = 'status-indicator ' + (connected ? 'connected' : 'disconnected');

    if (connected) {
        statusLabel.textContent = 'Connected';
        statusDetail.textContent = `HTTP server on port ${httpPort}`;
        connectBtn.style.display = 'none';
        disconnectBtn.style.display = 'inline-flex';

        if (version) {
            versionInfo.textContent = `Proxy version: ${version}`;
            versionInfo.style.display = 'block';
        }
    } else {
        statusLabel.textContent = 'Not Connected';
        statusDetail.textContent = error || 'Click Connect to establish connection';
        connectBtn.style.display = 'inline-flex';
        disconnectBtn.style.display = 'none';
        versionInfo.style.display = 'none';
    }
}

/**
 * Set connecting state
 */
function setConnecting() {
    statusIndicator.className = 'status-indicator connecting';
    statusLabel.textContent = 'Connecting...';
    statusDetail.textContent = 'Establishing connection to local proxy';
    connectBtn.disabled = true;
}

/**
 * Check current proxy connection status
 */
async function checkStatus() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'checkProxyConnection' });
        updateUI(response);
    } catch (err) {
        updateUI({ connected: false, error: err.message });
    }
}

/**
 * Connect to the proxy
 */
async function connect() {
    setConnecting();

    try {
        const response = await chrome.runtime.sendMessage({ type: 'connectProxy' });

        if (response.success) {
            updateUI({
                connected: true,
                httpPort: response.httpPort,
                version: response.version
            });
        } else {
            updateUI({
                connected: false,
                error: response.error || 'Connection failed'
            });
        }
    } catch (err) {
        updateUI({ connected: false, error: err.message });
    } finally {
        connectBtn.disabled = false;
    }
}

/**
 * Disconnect from the proxy
 */
async function disconnect() {
    try {
        await chrome.runtime.sendMessage({ type: 'disconnectProxy' });
        updateUI({ connected: false });
    } catch (err) {
        console.error('Disconnect error:', err);
    }
}

// Event listeners
connectBtn.addEventListener('click', connect);
disconnectBtn.addEventListener('click', disconnect);

// Check status on load
checkStatus();
