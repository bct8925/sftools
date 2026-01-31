import { describe, it, expect } from 'vitest';
import { debugInfo, debugWarn } from '../../../src/background/debug.js';

describe('debug', () => {
    describe('debugInfo', () => {
        it('should execute without throwing', () => {
            expect(() => debugInfo('test message', 123, { key: 'value' })).not.toThrow();
        });

        it('should handle single argument', () => {
            expect(() => debugInfo('single arg')).not.toThrow();
        });

        it('should handle multiple arguments', () => {
            expect(() => debugInfo('arg1', 'arg2', 'arg3')).not.toThrow();
        });
    });

    describe('debugWarn', () => {
        it('should execute without throwing', () => {
            expect(() => debugWarn('warning message', { error: 'details' })).not.toThrow();
        });

        it('should handle single argument', () => {
            expect(() => debugWarn('single warning')).not.toThrow();
        });

        it('should handle multiple arguments', () => {
            expect(() => debugWarn('warn1', 'warn2', 'warn3')).not.toThrow();
        });
    });
});
