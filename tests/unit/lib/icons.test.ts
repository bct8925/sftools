/**
 * Tests for src/lib/icons.js
 */

import { describe, it, expect } from 'vitest';
import { icons } from '../../../src/lib/icons.js';

describe('icons', () => {
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
