/**
 * Tests for src/components/sf-icon/sf-icon.js
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Register the component
import '../../../src/components/sf-icon/sf-icon.js';

describe('sf-icon component', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('renders known icon as SVG', () => {
        document.body.innerHTML = '<sf-icon name="close"></sf-icon>';
        const icon = document.querySelector('sf-icon');

        expect(icon.innerHTML).toContain('<svg');
        expect(icon.innerHTML).toContain('</svg>');
    });

    it('renders empty for unknown icon', () => {
        document.body.innerHTML = '<sf-icon name="nonexistent"></sf-icon>';
        const icon = document.querySelector('sf-icon');

        expect(icon.innerHTML).toBe('');
    });

    it('renders empty when no name attribute', () => {
        document.body.innerHTML = '<sf-icon></sf-icon>';
        const icon = document.querySelector('sf-icon');

        expect(icon.innerHTML).toBe('');
    });

    it('updates when name attribute changes', () => {
        document.body.innerHTML = '<sf-icon name="close"></sf-icon>';
        const icon = document.querySelector('sf-icon');

        const closeSvg = icon.innerHTML;
        icon.setAttribute('name', 'edit');

        expect(icon.innerHTML).not.toBe(closeSvg);
        expect(icon.innerHTML).toContain('<svg');
    });

    it('inherits color from parent via currentColor', () => {
        document.body.innerHTML = '<sf-icon name="close"></sf-icon>';
        const icon = document.querySelector('sf-icon');

        expect(icon.innerHTML).toContain('currentColor');
    });

    it('renders different icons correctly', () => {
        document.body.innerHTML = `
            <sf-icon name="hamburger"></sf-icon>
            <sf-icon name="edit"></sf-icon>
            <sf-icon name="refresh"></sf-icon>
        `;
        const icons = document.querySelectorAll('sf-icon');

        icons.forEach(icon => {
            expect(icon.innerHTML).toContain('<svg');
        });

        // Each should have different content
        const svgs = Array.from(icons).map(i => i.innerHTML);
        expect(new Set(svgs).size).toBe(3); // All unique
    });
});
