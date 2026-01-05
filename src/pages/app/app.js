// sftools - Main Application Entry Point
import { loadAuthTokens, getAccessToken, getInstanceUrl, isAuthenticated, checkProxyStatus, isProxyConnected, onAuthExpired } from '../../lib/utils.js';
// Self-registering custom element tabs
import '../../components/query/query-tab.js';
import '../../components/apex/apex-tab.js';
import '../../components/rest-api/rest-api-tab.js';
import '../../components/events/events-tab.js';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    initOpenOrgButton();
    initSidePanelButton();
    initAuthExpirationHandler();
    await loadAuthTokens();
    await checkProxyStatus();

    // Apply feature gating based on proxy status
    updateFeatureGating();
    // All tab modules are self-initializing via connectedCallback
});

// --- Auth Expiration Handler ---
function initAuthExpirationHandler() {
    onAuthExpired(() => {
        // Show re-auth overlay
        const overlay = document.createElement('div');
        overlay.className = 'auth-expired-overlay';
        overlay.innerHTML = `
            <div class="auth-expired-modal">
                <h2>Session Expired</h2>
                <p>Your Salesforce session has expired and could not be refreshed.</p>
                <p>Please re-authorize to continue.</p>
                <button id="reauth-btn" class="button-brand">Close and Re-authorize</button>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('reauth-btn').addEventListener('click', () => {
            window.close();
        });
    });
}

// --- Feature Gating ---
function updateFeatureGating() {
    const eventsTab = document.querySelector('.tab-link[data-tab="events"]');
    const eventsContent = document.getElementById('events');

    if (!isProxyConnected()) {
        // Disable the events tab
        eventsTab.classList.add('tab-disabled');
        eventsContent.classList.add('feature-disabled');

        // Add overlay with message
        const overlay = document.createElement('div');
        overlay.className = 'feature-gate-overlay';
        overlay.innerHTML = `
            <div class="feature-gate-message">
                <h3>Local Proxy Required</h3>
                <p>Platform Events streaming requires the local proxy to be installed and connected.</p>
                <button id="feature-gate-settings-btn">Open Settings</button>
            </div>
        `;
        eventsContent.appendChild(overlay);

        // Settings button handler
        overlay.querySelector('#feature-gate-settings-btn').addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });

        // Prevent tab switching to disabled tab
        eventsTab.addEventListener('click', (e) => {
            if (eventsTab.classList.contains('tab-disabled')) {
                e.stopPropagation();
                e.preventDefault();
            }
        }, true);
    }
}

// --- Open Org Button ---
function initOpenOrgButton() {
    const btn = document.getElementById('open-org-btn');
    btn.addEventListener('click', () => {
        if (!isAuthenticated()) {
            alert('Not authenticated. Please authorize via the extension popup.');
            return;
        }
        const instanceUrl = getInstanceUrl();
        const accessToken = getAccessToken();
        const frontdoorUrl = `${instanceUrl}/secur/frontdoor.jsp?sid=${encodeURIComponent(accessToken)}`;
        window.open(frontdoorUrl, '_blank');
    });
}

// --- Side Panel Button ---
function initSidePanelButton() {
    const btn = document.getElementById('side-panel-btn');
    btn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.sidePanel.open({ tabId: tabs[0].id });
        });
    });
}

// --- Tab Navigation ---
function initTabs() {
    const container = document.querySelector('.tab-scroll-container');
    const tabs = container.querySelectorAll('.tab-link[data-tab]');
    const contents = document.querySelectorAll('.tab-content');
    const dropdown = container.querySelector('.nav-overflow-dropdown');
    const trigger = dropdown.querySelector('.nav-overflow-trigger');
    const menu = dropdown.querySelector('.nav-overflow-menu');

    // Tab click handler (works for both nav and dropdown items)
    function handleTabClick(tab) {
        const targetId = tab.getAttribute('data-tab');

        // Update all tabs (nav + dropdown clones)
        container.querySelectorAll('.tab-link[data-tab]').forEach(t => t.classList.remove('active'));
        menu.querySelectorAll('.tab-link[data-tab]').forEach(t => t.classList.remove('active'));

        // Activate clicked tab and its clone if exists
        container.querySelectorAll(`.tab-link[data-tab="${targetId}"]`).forEach(t => t.classList.add('active'));

        contents.forEach(c => c.classList.remove('active'));
        const targetContent = document.getElementById(targetId);
        if (targetContent) {
            targetContent.classList.add('active');
        }

        // Close dropdown
        dropdown.classList.remove('open');
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => handleTabClick(tab));
    });

    // Dropdown toggle
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');

        // Position menu below trigger
        if (dropdown.classList.contains('open')) {
            const rect = trigger.getBoundingClientRect();
            menu.style.left = rect.left + 'px';
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        dropdown.classList.remove('open');
    });

    // Overflow detection
    function updateOverflow() {
        // Reset all tabs to visible first to measure true widths
        tabs.forEach(tab => tab.classList.remove('nav-hidden'));
        dropdown.classList.add('hidden');
        menu.innerHTML = '';

        // Use container's actual width
        const containerWidth = container.offsetWidth;
        const dropdownWidth = 85; // Width of "More" button

        // Measure tab widths
        let totalWidth = 0;
        const tabWidths = [];
        tabs.forEach(tab => {
            const width = tab.offsetWidth + 5; // include margin
            tabWidths.push(width);
            totalWidth += width;
        });

        // Check if all tabs fit
        if (totalWidth <= containerWidth) {
            return; // All tabs fit, no overflow needed
        }

        // Find how many tabs fit (leaving room for dropdown)
        let usedWidth = 0;
        let fitCount = 0;
        for (let i = 0; i < tabs.length; i++) {
            if (usedWidth + tabWidths[i] + dropdownWidth <= containerWidth) {
                usedWidth += tabWidths[i];
                fitCount++;
            } else {
                break;
            }
        }

        // At least show the dropdown if nothing fits
        if (fitCount === tabs.length) {
            return; // All fit after all
        }

        // Hide overflowing tabs and show dropdown
        dropdown.classList.remove('hidden');

        for (let i = fitCount; i < tabs.length; i++) {
            const tab = tabs[i];
            tab.classList.add('nav-hidden');

            // Create dropdown item
            const clone = document.createElement('button');
            clone.className = 'tab-link';
            clone.setAttribute('data-tab', tab.getAttribute('data-tab'));
            clone.textContent = tab.textContent;
            if (tab.classList.contains('active')) {
                clone.classList.add('active');
            }
            clone.addEventListener('click', () => handleTabClick(clone));
            menu.appendChild(clone);
        }
    }

    // Run on load and resize (with debounce for resize)
    let resizeTimeout;
    function handleResize() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(updateOverflow, 50);
    }

    // Initial run after layout settles
    requestAnimationFrame(() => {
        requestAnimationFrame(updateOverflow);
    });
    window.addEventListener('resize', handleResize);
}
