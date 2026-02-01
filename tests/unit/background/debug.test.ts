import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
        it('does nothing when __SFTOOLS_DEBUG__ is false (default)', async () => {
            vi.stubGlobal('__SFTOOLS_DEBUG__', false);
            const { debugInfo } = await import('../../../src/background/debug');

            debugInfo('test message', 123, { key: 'value' });

            expect(consoleInfoSpy).not.toHaveBeenCalled();
        });

        it('logs with [sftools:bg] prefix when __SFTOOLS_DEBUG__ is true', async () => {
            vi.stubGlobal('__SFTOOLS_DEBUG__', true);
            const { debugInfo } = await import('../../../src/background/debug');

            debugInfo('test message');

            expect(consoleInfoSpy).toHaveBeenCalledWith('[sftools:bg]', 'test message');
        });

        it('passes through all arguments when __SFTOOLS_DEBUG__ is true', async () => {
            vi.stubGlobal('__SFTOOLS_DEBUG__', true);
            const { debugInfo } = await import('../../../src/background/debug');

            debugInfo('message', 'arg1', 'arg2', 'arg3');

            expect(consoleInfoSpy).toHaveBeenCalledWith(
                '[sftools:bg]',
                'message',
                'arg1',
                'arg2',
                'arg3'
            );
        });

        it('handles multiple arguments of different types', async () => {
            vi.stubGlobal('__SFTOOLS_DEBUG__', true);
            const { debugInfo } = await import('../../../src/background/debug');

            const obj = { key: 'value' };
            const arr = [1, 2, 3];

            debugInfo('Multiple types:', obj, arr, 42, null);

            expect(consoleInfoSpy).toHaveBeenCalledWith(
                '[sftools:bg]',
                'Multiple types:',
                obj,
                arr,
                42,
                null
            );
        });
    });

    describe('debugWarn', () => {
        it('does nothing when __SFTOOLS_DEBUG__ is false (default)', async () => {
            vi.stubGlobal('__SFTOOLS_DEBUG__', false);
            const { debugWarn } = await import('../../../src/background/debug');

            debugWarn('warning message', { error: 'details' });

            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('logs with [sftools:bg] prefix when __SFTOOLS_DEBUG__ is true', async () => {
            vi.stubGlobal('__SFTOOLS_DEBUG__', true);
            const { debugWarn } = await import('../../../src/background/debug');

            debugWarn('test warning');

            expect(consoleWarnSpy).toHaveBeenCalledWith('[sftools:bg]', 'test warning');
        });

        it('passes through all arguments when __SFTOOLS_DEBUG__ is true', async () => {
            vi.stubGlobal('__SFTOOLS_DEBUG__', true);
            const { debugWarn } = await import('../../../src/background/debug');

            debugWarn('warning', 'arg1', 'arg2', 'arg3');

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '[sftools:bg]',
                'warning',
                'arg1',
                'arg2',
                'arg3'
            );
        });

        it('handles multiple arguments of different types', async () => {
            vi.stubGlobal('__SFTOOLS_DEBUG__', true);
            const { debugWarn } = await import('../../../src/background/debug');

            const obj = { error: true };
            const arr = ['a', 'b'];

            debugWarn('Error occurred:', obj, arr, 500, null);

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '[sftools:bg]',
                'Error occurred:',
                obj,
                arr,
                500,
                null
            );
        });
    });
});
