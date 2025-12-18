// sftools - Main Application Entry Point
import { loadAuthTokens } from './lib/utils.js';
import * as restApi from './rest-api/rest-api.js';
import * as apex from './apex/apex.js';
import * as query from './query/query.js';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    await loadAuthTokens();

    // Initialize tool modules
    restApi.init();
    apex.init();
    query.init();
});

// --- Tab Navigation ---
function initTabs() {
    const tabs = document.querySelectorAll('.tab-link');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-tab');

            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}
