/**
 * Tests for src/lib/debug.ts
 *
 * Test IDs: DBG-U-001 through DBG-U-010
 * - DBG-U-001: debugInfo() - Does nothing when __SFTOOLS_DEBUG__ is false (default)
 * - DBG-U-002: debugWarn() - Does nothing when __SFTOOLS_DEBUG__ is false (default)
 * - DBG-U-003: debugInfo() - Logs with [sftools] prefix when __SFTOOLS_DEBUG__ is true
 * - DBG-U-004: debugWarn() - Logs with [sftools] prefix when __SFTOOLS_DEBUG__ is true
 * - DBG-U-005: debugInfo() - Passes through all arguments when __SFTOOLS_DEBUG__ is true
 * - DBG-U-006: debugWarn() - Passes through all arguments when __SFTOOLS_DEBUG__ is true
 * - DBG-U-007: debugInfo() - Handles multiple arguments of different types
 * - DBG-U-008: debugWarn() - Handles multiple arguments of different types
 * - DBG-U-009: debugInfo() - Handles no arguments when __SFTOOLS_DEBUG__ is true
 * - DBG-U-010: debugWarn() - Handles no arguments when __SFTOOLS_DEBUG__ is true
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('debug', () => {
    let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        // Spy on console methods
        consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        // Clear module cache to allow fresh import with new __SFTOOLS_DEBUG__ value
        vi.resetModules();
    });

    afterEach(() => {
        // Restore console methods
        consoleInfoSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    describe('debugInfo', () => {
        it('DBG-U-001: does nothing when __SFTOOLS_DEBUG__ is false (default)', async () => {
            vi.stubGlobal('__SFTOOLS_DEBUG__', false);
            const { debugInfo } = await import('../../../src/lib/debug');

            debugInfo('test message');

            expect(consoleInfoSpy).not.toHaveBeenCalled();
        });

        it('DBG-U-003: logs with [sftools] prefix when __SFTOOLS_DEBUG__ is true', async () => {
            vi.stubGlobal('__SFTOOLS_DEBUG__', true);
            const { debugInfo } = await import('../../../src/lib/debug');

            debugInfo('test message');

            expect(consoleInfoSpy).toHaveBeenCalledWith('[sftools]', 'test message');
        });

        it('DBG-U-005: passes through all arguments when __SFTOOLS_DEBUG__ is true', async () => {
            vi.stubGlobal('__SFTOOLS_DEBUG__', true);
            const { debugInfo } = await import('../../../src/lib/debug');

            debugInfo('message', 'arg1', 'arg2', 'arg3');

            expect(consoleInfoSpy).toHaveBeenCalledWith(
                '[sftools]',
                'message',
                'arg1',
                'arg2',
                'arg3'
            );
        });

        it('DBG-U-007: handles multiple arguments of different types', async () => {
            vi.stubGlobal('__SFTOOLS_DEBUG__', true);
            const { debugInfo } = await import('../../../src/lib/debug');

            const obj = { key: 'value' };
            const arr = [1, 2, 3];
            const num = 42;

            debugInfo('Multiple types:', obj, arr, num, null, undefined);

            expect(consoleInfoSpy).toHaveBeenCalledWith(
                '[sftools]',
                'Multiple types:',
                obj,
                arr,
                num,
                null,
                undefined
            );
        });

        it('DBG-U-009: handles no arguments when __SFTOOLS_DEBUG__ is true', async () => {
            vi.stubGlobal('__SFTOOLS_DEBUG__', true);
            const { debugInfo } = await import('../../../src/lib/debug');

            debugInfo();

            expect(consoleInfoSpy).toHaveBeenCalledWith('[sftools]');
        });
    });

    describe('debugWarn', () => {
        it('DBG-U-002: does nothing when __SFTOOLS_DEBUG__ is false (default)', async () => {
            vi.stubGlobal('__SFTOOLS_DEBUG__', false);
            const { debugWarn } = await import('../../../src/lib/debug');

            debugWarn('test warning');

            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('DBG-U-004: logs with [sftools] prefix when __SFTOOLS_DEBUG__ is true', async () => {
            vi.stubGlobal('__SFTOOLS_DEBUG__', true);
            const { debugWarn } = await import('../../../src/lib/debug');

            debugWarn('test warning');

            expect(consoleWarnSpy).toHaveBeenCalledWith('[sftools]', 'test warning');
        });

        it('DBG-U-006: passes through all arguments when __SFTOOLS_DEBUG__ is true', async () => {
            vi.stubGlobal('__SFTOOLS_DEBUG__', true);
            const { debugWarn } = await import('../../../src/lib/debug');

            debugWarn('warning', 'arg1', 'arg2', 'arg3');

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '[sftools]',
                'warning',
                'arg1',
                'arg2',
                'arg3'
            );
        });

        it('DBG-U-008: handles multiple arguments of different types', async () => {
            vi.stubGlobal('__SFTOOLS_DEBUG__', true);
            const { debugWarn } = await import('../../../src/lib/debug');

            const obj = { error: true };
            const arr = ['a', 'b'];
            const num = 500;

            debugWarn('Error occurred:', obj, arr, num, null, undefined);

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '[sftools]',
                'Error occurred:',
                obj,
                arr,
                num,
                null,
                undefined
            );
        });

        it('DBG-U-010: handles no arguments when __SFTOOLS_DEBUG__ is true', async () => {
            vi.stubGlobal('__SFTOOLS_DEBUG__', true);
            const { debugWarn } = await import('../../../src/lib/debug');

            debugWarn();

            expect(consoleWarnSpy).toHaveBeenCalledWith('[sftools]');
        });
    });
});
