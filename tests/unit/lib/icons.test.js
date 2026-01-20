/**
 * Tests for src/lib/icons.js
 *
 * Test ID: UT-U-011
 * - UT-U-011: replaceIcons() - Replaces placeholders with SVG icons
 */

import { describe, it, expect } from 'vitest';
import { replaceIcons, icons } from '../../../src/lib/icons.js';

describe('icons', () => {
    describe('replaceIcons', () => {
        it('replaces {{icon:close}} placeholder with close icon SVG', () => {
            const input = '<button>{{icon:close}}</button>';
            const result = replaceIcons(input);

            expect(result).toContain('<svg');
            expect(result).not.toContain('{{icon:close}}');
        });

        it('replaces {{icon:edit}} placeholder with edit icon SVG', () => {
            const input = '<button>{{icon:edit}}</button>';
            const result = replaceIcons(input);

            expect(result).toContain('<svg');
            expect(result).not.toContain('{{icon:edit}}');
        });

        it('replaces {{icon:refresh}} placeholder with refresh icon SVG', () => {
            const input = '<button>{{icon:refresh}}</button>';
            const result = replaceIcons(input);

            expect(result).toContain('<svg');
            expect(result).not.toContain('{{icon:refresh}}');
        });

        it('replaces multiple icon placeholders in same string', () => {
            const input = '<div>{{icon:close}} and {{icon:edit}}</div>';
            const result = replaceIcons(input);

            expect(result).not.toContain('{{icon:close}}');
            expect(result).not.toContain('{{icon:edit}}');
            // Should have two SVG elements
            expect(result.match(/<svg/g)?.length).toBe(2);
        });

        it('leaves unknown icon placeholders unchanged', () => {
            const input = '<button>{{icon:nonexistent}}</button>';
            const result = replaceIcons(input);

            expect(result).toBe('<button>{{icon:nonexistent}}</button>');
        });

        it('leaves non-icon template syntax unchanged', () => {
            const input = '<div>{{something:else}}</div>';
            const result = replaceIcons(input);

            expect(result).toBe('<div>{{something:else}}</div>');
        });

        it('handles string with no placeholders', () => {
            const input = '<div>Plain text</div>';
            const result = replaceIcons(input);

            expect(result).toBe('<div>Plain text</div>');
        });

        it('handles empty string', () => {
            const result = replaceIcons('');

            expect(result).toBe('');
        });
    });

    describe('icons object', () => {
        it('contains expected icon keys', () => {
            expect(icons).toHaveProperty('close');
            expect(icons).toHaveProperty('edit');
            expect(icons).toHaveProperty('refresh');
            expect(icons).toHaveProperty('trash');
            expect(icons).toHaveProperty('hamburger');
            expect(icons).toHaveProperty('verticalDots');
        });

        it('icons contain SVG markup', () => {
            expect(icons.close).toContain('<svg');
            expect(icons.close).toContain('</svg>');
        });

        it('icons use currentColor for fill', () => {
            expect(icons.close).toContain('currentColor');
        });

        it('close icon has correct dimensions', () => {
            expect(icons.close).toContain('width="16"');
            expect(icons.close).toContain('height="16"');
        });

        it('closeLarge icon has larger dimensions', () => {
            expect(icons.closeLarge).toContain('width="20"');
            expect(icons.closeLarge).toContain('height="20"');
        });

        it('hamburger icon has correct dimensions', () => {
            expect(icons.hamburger).toContain('width="20"');
            expect(icons.hamburger).toContain('height="20"');
        });

        it('refreshSmall icon has smaller dimensions', () => {
            expect(icons.refreshSmall).toContain('width="12"');
            expect(icons.refreshSmall).toContain('height="12"');
        });
    });
});
