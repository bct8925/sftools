/**
 * Debug logging utility.
 *
 * DEBUG is set at build time via Vite's define config:
 * - `npm run build` or `npm run watch` → DEBUG = true
 * - `npm run package` → DEBUG = false
 */

const DEBUG = __SFTOOLS_DEBUG__;

export function debugInfo(...args: unknown[]): void {
    if (DEBUG) {
        console.info('[sftools]', ...args);
    }
}

export function debugWarn(...args: unknown[]): void {
    if (DEBUG) {
        console.warn('[sftools]', ...args);
    }
}
