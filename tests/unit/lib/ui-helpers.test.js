/**
 * Tests for src/lib/ui-helpers.js
 *
 * Test ID: UT-U-010
 * - UT-U-010: updateStatusBadge() - Updates badge element
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { updateStatusBadge } from '../../../src/lib/ui-helpers.js';

describe('ui-helpers', () => {
    let element;

    beforeEach(() => {
        element = document.createElement('span');
    });

    describe('updateStatusBadge', () => {
        it('sets element text content to message', () => {
            updateStatusBadge(element, 'Loading...');

            expect(element.textContent).toBe('Loading...');
        });

        it('sets base class to status-badge', () => {
            updateStatusBadge(element, 'Test');

            expect(element.className).toBe('status-badge');
        });

        it('adds status-loading class for loading type', () => {
            updateStatusBadge(element, 'Processing...', 'loading');

            expect(element.classList.contains('status-badge')).toBe(true);
            expect(element.classList.contains('status-loading')).toBe(true);
        });

        it('adds status-success class for success type', () => {
            updateStatusBadge(element, 'Complete!', 'success');

            expect(element.classList.contains('status-badge')).toBe(true);
            expect(element.classList.contains('status-success')).toBe(true);
        });

        it('adds status-error class for error type', () => {
            updateStatusBadge(element, 'Failed', 'error');

            expect(element.classList.contains('status-badge')).toBe(true);
            expect(element.classList.contains('status-error')).toBe(true);
        });

        it('resets to base class when type is empty string', () => {
            // First set a type
            updateStatusBadge(element, 'Error', 'error');
            expect(element.classList.contains('status-error')).toBe(true);

            // Then reset with empty type
            updateStatusBadge(element, 'Idle', '');

            expect(element.className).toBe('status-badge');
            expect(element.classList.contains('status-error')).toBe(false);
        });

        it('removes previous status classes on subsequent calls', () => {
            // Set loading
            updateStatusBadge(element, 'Loading...', 'loading');
            expect(element.classList.contains('status-loading')).toBe(true);

            // Change to success
            updateStatusBadge(element, 'Done!', 'success');

            expect(element.classList.contains('status-loading')).toBe(false);
            expect(element.classList.contains('status-success')).toBe(true);
        });

        it('defaults type to empty string when not provided', () => {
            updateStatusBadge(element, 'Default state');

            expect(element.className).toBe('status-badge');
            expect(element.classList.length).toBe(1);
        });
    });
});
