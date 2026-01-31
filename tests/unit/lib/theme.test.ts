/**
 * Tests for src/lib/theme.js
 *
 * Test IDs: UT-U-003, UT-U-004
 * - UT-U-003: initTheme() - Applies stored theme
 * - UT-U-004: setTheme() - Updates storage and DOM (via applyTheme)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock matchMedia before importing theme module
const mockMatchMedia = vi.fn();
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: mockMatchMedia,
});

// Import after mocking
import {
    applyTheme,
    getSystemTheme,
    getTheme,
    setTheme,
    initTheme,
} from '../../../src/lib/theme.js';

describe('theme', () => {
    let mediaQueryListeners;

    beforeEach(() => {
        // Reset document state
        document.documentElement.removeAttribute('data-theme');

        // Reset matchMedia mock
        mediaQueryListeners = [];
        mockMatchMedia.mockImplementation(query => ({
            matches: false, // Default to light mode
            media: query,
            addEventListener: vi.fn((_event, callback) => {
                mediaQueryListeners.push(callback);
            }),
            removeEventListener: vi.fn(),
        }));
    });

    describe('getSystemTheme', () => {
        it('returns "dark" when system prefers dark color scheme', () => {
            mockMatchMedia.mockImplementation(() => ({
                matches: true,
                media: '(prefers-color-scheme: dark)',
                addEventListener: vi.fn(),
            }));

            expect(getSystemTheme()).toBe('dark');
        });

        it('returns "light" when system prefers light color scheme', () => {
            mockMatchMedia.mockImplementation(() => ({
                matches: false,
                media: '(prefers-color-scheme: dark)',
                addEventListener: vi.fn(),
            }));

            expect(getSystemTheme()).toBe('light');
        });
    });

    describe('applyTheme', () => {
        it('S-U-001: applies light theme by removing data-theme attribute', () => {
            document.documentElement.setAttribute('data-theme', 'dark');

            applyTheme('light');

            expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
        });

        it('S-U-002: applies dark theme by setting data-theme to "dark"', () => {
            applyTheme('dark');

            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });

        it('applies system theme based on matchMedia when theme is "system"', () => {
            // System prefers dark
            mockMatchMedia.mockImplementation(() => ({
                matches: true,
                media: '(prefers-color-scheme: dark)',
                addEventListener: vi.fn(),
            }));

            applyTheme('system');

            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });

        it('applies light when system is "system" and OS prefers light', () => {
            // System prefers light
            mockMatchMedia.mockImplementation(() => ({
                matches: false,
                media: '(prefers-color-scheme: dark)',
                addEventListener: vi.fn(),
            }));

            applyTheme('system');

            expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
        });
    });

    describe('getTheme', () => {
        it('should return current theme after applyTheme', () => {
            applyTheme('dark');
            expect(getTheme()).toBe('dark');
        });

        it('should return system after applyTheme with system', () => {
            applyTheme('system');
            expect(getTheme()).toBe('system');
        });

        it('should return light after applyTheme with light', () => {
            applyTheme('light');
            expect(getTheme()).toBe('light');
        });
    });

    describe('setTheme', () => {
        it('should update storage and apply theme', async () => {
            chrome._setStorageData({});

            await setTheme('dark');

            const stored = chrome._getStorageData();
            expect(stored.theme).toBe('dark');
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });

        it('should update storage and apply light theme', async () => {
            chrome._setStorageData({});

            await setTheme('light');

            const stored = chrome._getStorageData();
            expect(stored.theme).toBe('light');
            expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
        });

        it('should update storage and apply system theme', async () => {
            chrome._setStorageData({});
            mockMatchMedia.mockImplementation(() => ({
                matches: true,
                media: '(prefers-color-scheme: dark)',
                addEventListener: vi.fn(),
            }));

            await setTheme('system');

            const stored = chrome._getStorageData();
            expect(stored.theme).toBe('system');
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });
    });

    describe('initTheme', () => {
        it('UT-U-003: applies stored theme from chrome.storage on init', async () => {
            chrome._setStorageData({ theme: 'dark' });

            await initTheme();

            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });

        it('UT-U-004: setTheme() updates storage and DOM (via applyTheme)', async () => {
            chrome._setStorageData({});

            // System prefers dark
            mockMatchMedia.mockImplementation(() => ({
                matches: true,
                media: '(prefers-color-scheme: dark)',
                addEventListener: vi.fn(),
            }));

            await initTheme();

            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });

        it('registers listener for system theme changes', async () => {
            chrome._setStorageData({});

            await initTheme();

            // Should have registered an event listener on matchMedia
            expect(mediaQueryListeners.length).toBeGreaterThan(0);
        });

        it('registers listener for storage changes', async () => {
            chrome._setStorageData({});

            await initTheme();

            // Simulate storage change from another tab
            document.documentElement.removeAttribute('data-theme');
            chrome._triggerStorageChange(
                {
                    theme: { oldValue: 'light', newValue: 'dark' },
                },
                'local'
            );

            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });

        it('updates theme when storage changes to light', async () => {
            chrome._setStorageData({ theme: 'dark' });
            await initTheme();
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

            // Simulate storage change to light
            chrome._triggerStorageChange(
                {
                    theme: { oldValue: 'dark', newValue: 'light' },
                },
                'local'
            );

            expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
        });

        it('defaults to system when storage change has no value', async () => {
            chrome._setStorageData({ theme: 'dark' });
            await initTheme();

            // System prefers light
            mockMatchMedia.mockImplementation(() => ({
                matches: false,
                media: '(prefers-color-scheme: dark)',
                addEventListener: vi.fn(),
            }));

            // Simulate storage change with undefined newValue
            chrome._triggerStorageChange(
                {
                    theme: { oldValue: 'dark', newValue: undefined },
                },
                'local'
            );

            expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
        });

        it('applies theme when system theme changes and storage theme is "system"', async () => {
            chrome._setStorageData({ theme: 'system' });

            // System initially prefers light
            mockMatchMedia.mockImplementation(() => ({
                matches: false,
                media: '(prefers-color-scheme: dark)',
                addEventListener: vi.fn((_event, callback) => {
                    mediaQueryListeners.push(callback);
                }),
            }));

            await initTheme();
            expect(document.documentElement.hasAttribute('data-theme')).toBe(false);

            // System changes to prefer dark
            mockMatchMedia.mockImplementation(() => ({
                matches: true,
                media: '(prefers-color-scheme: dark)',
                addEventListener: vi.fn(),
            }));

            // Trigger the media query listener (it's async)
            chrome._setStorageData({ theme: 'system' });
            await mediaQueryListeners[0]();

            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });

        it('does not apply theme when system theme changes but storage theme is not "system"', async () => {
            chrome._setStorageData({ theme: 'dark' });

            // System initially prefers light
            mockMatchMedia.mockImplementation(() => ({
                matches: false,
                media: '(prefers-color-scheme: dark)',
                addEventListener: vi.fn((_event, callback) => {
                    mediaQueryListeners.push(callback);
                }),
            }));

            await initTheme();
            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

            // System changes to prefer light
            mockMatchMedia.mockImplementation(() => ({
                matches: false,
                media: '(prefers-color-scheme: dark)',
                addEventListener: vi.fn(),
            }));

            // Trigger the media query listener - theme should stay dark (it's async)
            chrome._setStorageData({ theme: 'dark' });
            await mediaQueryListeners[0]();

            expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
        });

        it('ignores storage changes from non-local storage areas', async () => {
            chrome._setStorageData({ theme: 'light' });
            await initTheme();
            expect(document.documentElement.hasAttribute('data-theme')).toBe(false);

            // Simulate storage change from 'sync' area (should be ignored)
            chrome._triggerStorageChange(
                {
                    theme: { oldValue: 'light', newValue: 'dark' },
                },
                'sync'
            );

            // Theme should remain light
            expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
        });
    });
});
