// Theme management utility
// Applies theme on page load and listens for changes

const THEME_KEY = 'theme';

export function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme) {
    let effectiveTheme = theme;

    if (theme === 'system') {
        effectiveTheme = getSystemTheme();
    }

    if (effectiveTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
}

export async function initTheme() {
    // Apply theme immediately from storage
    const result = await chrome.storage.local.get([THEME_KEY]);
    const theme = result[THEME_KEY] || 'system';
    applyTheme(theme);

    // Listen for system theme changes when in system mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', async () => {
        const current = await chrome.storage.local.get([THEME_KEY]);
        if ((current[THEME_KEY] || 'system') === 'system') {
            applyTheme('system');
        }
    });

    // Listen for storage changes (theme changed in another tab/page)
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[THEME_KEY]) {
            applyTheme(changes[THEME_KEY].newValue || 'system');
        }
    });
}
