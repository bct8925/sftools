const authorizeBtn = document.getElementById('authorizeBtn');
const connectBtn = document.getElementById('connectBtn');
const sidePanelBtn = document.getElementById('sidePanelBtn');
const reauthorizeBtn = document.getElementById('reauthorizeBtn');
const openAuraBtn = document.getElementById('openAuraBtn');
const unauthorizedGroup = document.getElementById('unauthorized-group');
const authorizedGroup = document.getElementById('authorized-group');
const statusDiv = document.getElementById('status');

const CLIENT_ID = chrome.runtime.getManifest().oauth2.client_id;

// --- Core Authorization Function ---
function startAuthorization() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const currentTab = tabs[0];
        let loginDomain = 'https://login.salesforce.com';

        // Auto-detect Salesforce domain from current tab
        if (currentTab && currentTab.url) {
            try {
                const urlObj = new URL(currentTab.url);
                if (urlObj.hostname.includes('.salesforce.com') || urlObj.hostname.includes('.force.com')) {
                    loginDomain = urlObj.origin;
                } else if (urlObj.hostname.includes('salesforce-setup.com')) {
                    loginDomain = urlObj.origin.replace('salesforce-setup.com', 'salesforce.com');
                }
            } catch (e) {
                console.error('Error parsing current tab URL:', e);
            }
        }

        const CALLBACK_URL = 'https://sftools.dev/sftools-callback';

        const AUTH_URL = `${loginDomain}/services/oauth2/authorize` +
            `?client_id=${CLIENT_ID}` +
            `&response_type=token` +
            `&redirect_uri=${encodeURIComponent(CALLBACK_URL)}`;

        chrome.tabs.create({ url: AUTH_URL });
        window.close();
    });
}

// --- Button Click Handlers ---
authorizeBtn.addEventListener('click', startAuthorization);

reauthorizeBtn.addEventListener('click', function() {
    chrome.storage.local.remove(['accessToken', 'instanceUrl'], function() {
        statusDiv.innerText = 'Old session cleared. Starting re-authorization...';
        startAuthorization();
    });
});

connectBtn.addEventListener('click', function() {
    chrome.tabs.create({ url: 'dist/app.html' });
    window.close();
});

sidePanelBtn.addEventListener('click', function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        chrome.sidePanel.open({ tabId: tabs[0].id });
        window.close();
    });
});

openAuraBtn.addEventListener('click', function() {
    chrome.tabs.create({ url: 'dist/aura/aura.html' });
    window.close();
});

// --- Initialization: Check for existing session ---
function checkSession() {
    chrome.storage.local.get(['accessToken', 'instanceUrl'], function(data) {
        if (data.accessToken && data.instanceUrl) {
            unauthorizedGroup.classList.add('hidden');
            authorizedGroup.classList.remove('hidden');

            const instanceHostname = new URL(data.instanceUrl).hostname;
            statusDiv.innerHTML = `Connected to:<br><strong>${instanceHostname}</strong>`;
        } else {
            authorizedGroup.classList.add('hidden');
            unauthorizedGroup.classList.remove('hidden');
            statusDiv.innerText = 'No active session. Click "Authorize Session" to begin.';
        }
    });
}

checkSession();
