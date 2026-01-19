/**
 * Debug logging utility for background service worker.
 *
 * DEBUG is set at build time via Vite's define config:
 * - `npm run build` or `npm run watch` → DEBUG = true
 * - `npm run package` → DEBUG = false
 */

const DEBUG = __SFTOOLS_DEBUG__;

export function debugInfo(...args) {
    if (DEBUG) {
        console.info('[sftools:bg]', ...args);
    }
}

export function debugWarn(...args) {
    if (DEBUG) {
        console.warn('[sftools:bg]', ...args);
    }
}
