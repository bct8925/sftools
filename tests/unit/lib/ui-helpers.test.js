/**
 * Tests for src/lib/ui-helpers.js
 *
 * Test IDs: UT-U-010, UT-U-068 through UT-U-075
 * - UT-U-010: updateStatusBadge() - Updates badge element
 * - UT-U-068: updateStatusBadge() - Sets element text content to message
 * - UT-U-069: updateStatusBadge() - Sets base class to status-badge
 * - UT-U-070: updateStatusBadge() - Adds status-loading class for loading type
 * - UT-U-071: updateStatusBadge() - Adds status-success class for success type
 * - UT-U-072: updateStatusBadge() - Adds status-error class for error type
 * - UT-U-073: updateStatusBadge() - Resets to base class when type is empty string
 * - UT-U-074: updateStatusBadge() - Removes previous status classes on subsequent calls
 * - UT-U-075: updateStatusBadge() - Defaults type to empty string when not provided
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { updateStatusBadge } from '../../../src/lib/ui-helpers.js';

describe('ui-helpers', () => {
    let element;

    beforeEach(() => {
        element = document.createElement('span');
    });

    describe('updateStatusBadge', () => {
        it('UT-U-068: sets element text content to message', () => {
            updateStatusBadge(element, 'Loading...');

            expect(element.textContent).toBe('Loading...');
        });

        it('UT-U-069: sets base class to status-badge', () => {
            updateStatusBadge(element, 'Test');

            expect(element.className).toBe('status-badge');
        });

        it('UT-U-070: adds status-loading class for loading type', () => {
            updateStatusBadge(element, 'Processing...', 'loading');

            expect(element.classList.contains('status-badge')).toBe(true);
            expect(element.classList.contains('status-loading')).toBe(true);
        });

        it('UT-U-071: adds status-success class for success type', () => {
            updateStatusBadge(element, 'Complete!', 'success');

            expect(element.classList.contains('status-badge')).toBe(true);
            expect(element.classList.contains('status-success')).toBe(true);
        });

        it('UT-U-072: adds status-error class for error type', () => {
            updateStatusBadge(element, 'Failed', 'error');

            expect(element.classList.contains('status-badge')).toBe(true);
            expect(element.classList.contains('status-error')).toBe(true);
        });

        it('UT-U-073: resets to base class when type is empty string', () => {
            // First set a type
            updateStatusBadge(element, 'Error', 'error');
            expect(element.classList.contains('status-error')).toBe(true);

            // Then reset with empty type
            updateStatusBadge(element, 'Idle', '');

            expect(element.className).toBe('status-badge');
            expect(element.classList.contains('status-error')).toBe(false);
        });

        it('UT-U-074: removes previous status classes on subsequent calls', () => {
            // Set loading
            updateStatusBadge(element, 'Loading...', 'loading');
            expect(element.classList.contains('status-loading')).toBe(true);

            // Change to success
            updateStatusBadge(element, 'Done!', 'success');

            expect(element.classList.contains('status-loading')).toBe(false);
            expect(element.classList.contains('status-success')).toBe(true);
        });

        it('UT-U-075: defaults type to empty string when not provided', () => {
            updateStatusBadge(element, 'Default state');

            expect(element.className).toBe('status-badge');
            expect(element.classList.length).toBe(1);
        });
    });
});
