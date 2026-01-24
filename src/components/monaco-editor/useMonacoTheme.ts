import { useEffect, useCallback } from 'react';
import { monaco } from '../../lib/monaco-custom.js';

/**
 * Define custom Monaco themes that read from CSS variables.
 * Must be called after DOM is ready and when theme changes.
 */
function defineCustomThemes(): void {
    const styles = getComputedStyle(document.documentElement);
    const navBg = styles.getPropertyValue('--nav-bg').trim();

    monaco.editor.defineTheme('sftools-light', {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': navBg,
            'editorGutter.background': navBg,
        },
    });

    monaco.editor.defineTheme('sftools-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': navBg,
            'editorGutter.background': navBg,
        },
    });
}

/**
 * Get the appropriate Monaco theme name based on current document theme.
 */
export function getMonacoTheme(): string {
    return document.documentElement.getAttribute('data-theme') === 'dark'
        ? 'sftools-dark'
        : 'sftools-light';
}

/**
 * Hook to synchronize Monaco editor theme with document theme.
 * Watches for data-theme attribute changes and updates Monaco accordingly.
 */
export function useMonacoTheme(): string {
    const updateTheme = useCallback(() => {
        defineCustomThemes();
        monaco.editor.setTheme(getMonacoTheme());
    }, []);

    useEffect(() => {
        // Define themes on mount
        defineCustomThemes();

        // Watch for theme changes via MutationObserver
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (mutation.attributeName === 'data-theme') {
                    updateTheme();
                }
            }
        });

        observer.observe(document.documentElement, { attributes: true });

        return () => observer.disconnect();
    }, [updateTheme]);

    return getMonacoTheme();
}

// Initialize themes immediately when module loads
if (typeof document !== 'undefined') {
    defineCustomThemes();
}
