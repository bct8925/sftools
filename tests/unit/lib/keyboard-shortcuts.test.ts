/**
 * Tests for src/lib/keyboard-shortcuts.ts
 *
 * Test IDs: KS-U-001 through KS-U-019
 * - KS-U-001: matchShortcut returns null when altKey is not pressed
 * - KS-U-002: matchShortcut returns null when ctrlKey is also pressed
 * - KS-U-003: matchShortcut returns null when metaKey is also pressed
 * - KS-U-004: matchShortcut returns null when shiftKey is also pressed
 * - KS-U-005: matchShortcut returns null for unmapped key codes
 * - KS-U-006: matchShortcut returns binding for Alt+Digit1 (query)
 * - KS-U-007: matchShortcut returns binding for Alt+Digit0 (home)
 * - KS-U-008: matchShortcut returns binding for Alt+KeyO (open-org)
 * - KS-U-009: matchShortcut returns binding for Alt+Digit8 (settings)
 * - KS-U-010: query binding has requiresAuth=true, requiresProxy=false
 * - KS-U-011: home binding has requiresAuth=false, requiresProxy=false
 * - KS-U-012: events binding has requiresAuth=true, requiresProxy=true
 * - KS-U-013: isEditableTarget returns false for null
 * - KS-U-014: isEditableTarget returns true for INPUT element
 * - KS-U-015: isEditableTarget returns true for TEXTAREA element
 * - KS-U-016: isEditableTarget returns false for plain DIV element
 * - KS-U-017: isEditableTarget returns true for contenteditable div
 * - KS-U-018: isEditableTarget returns false for contenteditable="false"
 * - KS-U-019: isEditableTarget returns false for non-Element EventTarget
 */

import { describe, it, expect } from 'vitest';
import {
    matchShortcut,
    isEditableTarget,
    SHORTCUT_BINDINGS,
} from '../../../src/lib/keyboard-shortcuts';

function makeKeyEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
    return {
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        code: '',
        ...overrides,
    } as unknown as KeyboardEvent;
}

describe('keyboard-shortcuts', () => {
    describe('SHORTCUT_BINDINGS', () => {
        it('contains bindings for Digit1 through Digit7 for features', () => {
            const featureBindings = SHORTCUT_BINDINGS.filter(b =>
                ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7'].includes(
                    b.code
                )
            );
            expect(featureBindings).toHaveLength(7);
        });

        it('contains binding for Digit8 mapped to settings', () => {
            const binding = SHORTCUT_BINDINGS.find(b => b.code === 'Digit8');
            expect(binding?.target).toBe('settings');
        });

        it('contains binding for Digit0 mapped to home', () => {
            const binding = SHORTCUT_BINDINGS.find(b => b.code === 'Digit0');
            expect(binding?.target).toBe('home');
        });

        it('contains binding for KeyO mapped to open-org', () => {
            const binding = SHORTCUT_BINDINGS.find(b => b.code === 'KeyO');
            expect(binding?.target).toBe('open-org');
        });
    });

    describe('matchShortcut', () => {
        it('KS-U-001: returns null when altKey is not pressed', () => {
            const e = makeKeyEvent({ altKey: false, code: 'Digit1' });
            expect(matchShortcut(e)).toBeNull();
        });

        it('KS-U-002: returns null when ctrlKey is also pressed', () => {
            const e = makeKeyEvent({ altKey: true, ctrlKey: true, code: 'Digit1' });
            expect(matchShortcut(e)).toBeNull();
        });

        it('KS-U-003: returns null when metaKey is also pressed', () => {
            const e = makeKeyEvent({ altKey: true, metaKey: true, code: 'Digit1' });
            expect(matchShortcut(e)).toBeNull();
        });

        it('KS-U-004: returns null when shiftKey is also pressed', () => {
            const e = makeKeyEvent({ altKey: true, shiftKey: true, code: 'Digit1' });
            expect(matchShortcut(e)).toBeNull();
        });

        it('KS-U-005: returns null for unmapped key codes', () => {
            const e = makeKeyEvent({ altKey: true, code: 'KeyZ' });
            expect(matchShortcut(e)).toBeNull();
        });

        it('KS-U-006: returns binding for Alt+Digit1 (query)', () => {
            const e = makeKeyEvent({ altKey: true, code: 'Digit1' });
            const binding = matchShortcut(e);
            expect(binding).not.toBeNull();
            expect(binding?.target).toBe('query');
        });

        it('KS-U-007: returns binding for Alt+Digit0 (home)', () => {
            const e = makeKeyEvent({ altKey: true, code: 'Digit0' });
            const binding = matchShortcut(e);
            expect(binding).not.toBeNull();
            expect(binding?.target).toBe('home');
        });

        it('KS-U-008: returns binding for Alt+KeyO (open-org)', () => {
            const e = makeKeyEvent({ altKey: true, code: 'KeyO' });
            const binding = matchShortcut(e);
            expect(binding).not.toBeNull();
            expect(binding?.target).toBe('open-org');
        });

        it('KS-U-009: returns binding for Alt+Digit8 (settings)', () => {
            const e = makeKeyEvent({ altKey: true, code: 'Digit8' });
            const binding = matchShortcut(e);
            expect(binding).not.toBeNull();
            expect(binding?.target).toBe('settings');
        });

        it('KS-U-010: query binding has requiresAuth=true, requiresProxy=false', () => {
            const e = makeKeyEvent({ altKey: true, code: 'Digit1' });
            const binding = matchShortcut(e);
            expect(binding?.requiresAuth).toBe(true);
            expect(binding?.requiresProxy).toBe(false);
        });

        it('KS-U-011: home binding has requiresAuth=false, requiresProxy=false', () => {
            const e = makeKeyEvent({ altKey: true, code: 'Digit0' });
            const binding = matchShortcut(e);
            expect(binding?.requiresAuth).toBe(false);
            expect(binding?.requiresProxy).toBe(false);
        });

        it('KS-U-012: events binding has requiresAuth=true, requiresProxy=true', () => {
            // Events is Digit6 (6th feature, 0-indexed = 5, so index+1 = 6)
            const e = makeKeyEvent({ altKey: true, code: 'Digit6' });
            const binding = matchShortcut(e);
            expect(binding?.target).toBe('events');
            expect(binding?.requiresAuth).toBe(true);
            expect(binding?.requiresProxy).toBe(true);
        });
    });

    describe('isEditableTarget', () => {
        it('KS-U-013: returns false for null', () => {
            expect(isEditableTarget(null)).toBe(false);
        });

        it('KS-U-014: returns true for INPUT element', () => {
            const input = document.createElement('input');
            expect(isEditableTarget(input)).toBe(true);
        });

        it('KS-U-015: returns true for TEXTAREA element', () => {
            const textarea = document.createElement('textarea');
            expect(isEditableTarget(textarea)).toBe(true);
        });

        it('KS-U-016: returns false for plain DIV element', () => {
            const div = document.createElement('div');
            expect(isEditableTarget(div)).toBe(false);
        });

        it('KS-U-017: returns true for contenteditable div', () => {
            const div = document.createElement('div');
            div.setAttribute('contenteditable', 'true');
            expect(isEditableTarget(div)).toBe(true);
        });

        it('KS-U-017b: returns true for contenteditable="" (empty string)', () => {
            const div = document.createElement('div');
            div.setAttribute('contenteditable', '');
            expect(isEditableTarget(div)).toBe(true);
        });

        it('KS-U-018: returns false for contenteditable="false"', () => {
            const div = document.createElement('div');
            div.setAttribute('contenteditable', 'false');
            expect(isEditableTarget(div)).toBe(false);
        });

        it('KS-U-019: returns false for non-Element EventTarget', () => {
            const target = new EventTarget();
            expect(isEditableTarget(target)).toBe(false);
        });
    });
});
