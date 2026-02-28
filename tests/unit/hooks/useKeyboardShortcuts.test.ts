/**
 * Tests for src/hooks/useKeyboardShortcuts.ts
 *
 * Test IDs: UKS-U-001 through UKS-U-012
 * - UKS-U-001: Navigates to feature on Alt+Digit1 when authenticated
 * - UKS-U-002: Navigates to home on Alt+Digit0
 * - UKS-U-003: Opens org in new tab on Alt+KeyO when authenticated with connection
 * - UKS-U-004: Silently no-ops for auth-required shortcut when unauthenticated
 * - UKS-U-005: Silently no-ops for proxy-required shortcut when proxy is disconnected
 * - UKS-U-006: Suppresses shortcut when input is focused
 * - UKS-U-007: Suppresses shortcut when textarea is focused
 * - UKS-U-008: Suppresses shortcut when contenteditable element is focused
 * - UKS-U-009: Does not open org when instanceUrl is not available
 * - UKS-U-010: Removes event listener on unmount
 * - UKS-U-011: Navigates to settings tab on Alt+Digit8
 * - UKS-U-012: Does not fire when Ctrl modifier is present
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock contexts before importing the hook
let mockIsAuthenticated = true;
let mockActiveConnection: { instanceUrl: string } | null = {
    instanceUrl: 'https://test.my.salesforce.com',
};
let mockIsProxyConnected = false;

vi.mock('../../../src/contexts/ConnectionContext', () => ({
    useConnection: () => ({
        isAuthenticated: mockIsAuthenticated,
        activeConnection: mockActiveConnection,
    }),
}));

vi.mock('../../../src/contexts/ProxyContext', () => ({
    useProxy: () => ({
        isConnected: mockIsProxyConnected,
    }),
}));

import { useKeyboardShortcuts } from '../../../src/hooks/useKeyboardShortcuts';

function fireKeyDown(code: string, modifiers: Partial<KeyboardEventInit> = {}): void {
    document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, ...modifiers }));
}

describe('useKeyboardShortcuts', () => {
    let navigateToFeature: ReturnType<typeof vi.fn>;
    let navigateHome: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        navigateToFeature = vi.fn();
        navigateHome = vi.fn();
        mockIsAuthenticated = true;
        mockActiveConnection = { instanceUrl: 'https://test.my.salesforce.com' };
        mockIsProxyConnected = false;
        chrome._reset();
    });

    function renderShortcuts() {
        return renderHook(() => useKeyboardShortcuts({ navigateToFeature, navigateHome }));
    }

    describe('feature navigation', () => {
        it('UKS-U-001: navigates to query on Alt+Digit1 when authenticated', () => {
            renderShortcuts();

            act(() => {
                fireKeyDown('Digit1', { altKey: true });
            });

            expect(navigateToFeature).toHaveBeenCalledWith('query');
        });

        it('UKS-U-011: navigates to settings on Alt+Digit8', () => {
            renderShortcuts();

            act(() => {
                fireKeyDown('Digit8', { altKey: true });
            });

            expect(navigateToFeature).toHaveBeenCalledWith('settings');
        });
    });

    describe('home navigation', () => {
        it('UKS-U-002: navigates to home on Alt+Digit0', () => {
            renderShortcuts();

            act(() => {
                fireKeyDown('Digit0', { altKey: true });
            });

            expect(navigateHome).toHaveBeenCalled();
        });
    });

    describe('open org', () => {
        it('UKS-U-003: opens org in new tab on Alt+KeyO when authenticated with connection', () => {
            renderShortcuts();

            act(() => {
                fireKeyDown('KeyO', { altKey: true });
            });

            expect(chrome.tabs.create).toHaveBeenCalledWith({
                url: 'https://test.my.salesforce.com',
            });
        });

        it('UKS-U-009: does not open org when activeConnection is null', () => {
            mockActiveConnection = null;
            renderShortcuts();

            act(() => {
                fireKeyDown('KeyO', { altKey: true });
            });

            expect(chrome.tabs.create).not.toHaveBeenCalled();
        });
    });

    describe('auth gating', () => {
        it('UKS-U-004: silently no-ops for auth-required shortcut when unauthenticated', () => {
            mockIsAuthenticated = false;
            renderShortcuts();

            act(() => {
                fireKeyDown('Digit1', { altKey: true });
            });

            expect(navigateToFeature).not.toHaveBeenCalled();
        });

        it('home shortcut works even when unauthenticated', () => {
            mockIsAuthenticated = false;
            renderShortcuts();

            act(() => {
                fireKeyDown('Digit0', { altKey: true });
            });

            expect(navigateHome).toHaveBeenCalled();
        });
    });

    describe('proxy gating', () => {
        it('UKS-U-005: silently no-ops for proxy-required shortcut when proxy is disconnected', () => {
            mockIsProxyConnected = false;
            renderShortcuts();

            // Events (Digit6) requires proxy
            act(() => {
                fireKeyDown('Digit6', { altKey: true });
            });

            expect(navigateToFeature).not.toHaveBeenCalled();
        });

        it('navigates to events when proxy is connected', () => {
            mockIsProxyConnected = true;
            renderShortcuts();

            act(() => {
                fireKeyDown('Digit6', { altKey: true });
            });

            expect(navigateToFeature).toHaveBeenCalledWith('events');
        });
    });

    describe('editable target suppression', () => {
        it('UKS-U-006: suppresses shortcut when input is focused', () => {
            renderShortcuts();

            const input = document.createElement('input');
            document.body.appendChild(input);

            act(() => {
                input.dispatchEvent(
                    new KeyboardEvent('keydown', { code: 'Digit1', altKey: true, bubbles: true })
                );
            });

            expect(navigateToFeature).not.toHaveBeenCalled();
            document.body.removeChild(input);
        });

        it('UKS-U-007: suppresses shortcut when textarea is focused', () => {
            renderShortcuts();

            const textarea = document.createElement('textarea');
            document.body.appendChild(textarea);

            act(() => {
                textarea.dispatchEvent(
                    new KeyboardEvent('keydown', { code: 'Digit1', altKey: true, bubbles: true })
                );
            });

            expect(navigateToFeature).not.toHaveBeenCalled();
            document.body.removeChild(textarea);
        });

        it('UKS-U-008: suppresses shortcut when contenteditable element is focused', () => {
            renderShortcuts();

            const div = document.createElement('div');
            div.setAttribute('contenteditable', 'true');
            document.body.appendChild(div);

            act(() => {
                div.dispatchEvent(
                    new KeyboardEvent('keydown', { code: 'Digit1', altKey: true, bubbles: true })
                );
            });

            expect(navigateToFeature).not.toHaveBeenCalled();
            document.body.removeChild(div);
        });
    });

    describe('modifier key handling', () => {
        it('UKS-U-012: does not fire when Ctrl modifier is also pressed', () => {
            renderShortcuts();

            act(() => {
                fireKeyDown('Digit1', { altKey: true, ctrlKey: true });
            });

            expect(navigateToFeature).not.toHaveBeenCalled();
        });

        it('does not fire when no alt key', () => {
            renderShortcuts();

            act(() => {
                fireKeyDown('Digit1');
            });

            expect(navigateToFeature).not.toHaveBeenCalled();
        });
    });

    describe('cleanup', () => {
        it('UKS-U-010: removes event listener on unmount', () => {
            const { unmount } = renderShortcuts();

            unmount();

            act(() => {
                fireKeyDown('Digit1', { altKey: true });
            });

            expect(navigateToFeature).not.toHaveBeenCalled();
        });
    });
});
