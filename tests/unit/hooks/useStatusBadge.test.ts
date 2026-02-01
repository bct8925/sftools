/**
 * Tests for src/hooks/useStatusBadge.ts
 *
 * Test IDs: H-U-001 through H-U-005
 * - H-U-001: Returns initial empty state for statusText and statusType
 * - H-U-002: updateStatus sets both text and type
 * - H-U-003: updateStatus defaults type to empty string when not provided
 * - H-U-004: clearStatus resets both to empty strings
 * - H-U-005: Multiple updates work correctly (update, clear, update again)
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStatusBadge } from '../../../src/hooks/useStatusBadge';

describe('useStatusBadge', () => {
    it('H-U-001: returns initial empty state for statusText and statusType', () => {
        const { result } = renderHook(() => useStatusBadge());

        expect(result.current.statusText).toBe('');
        expect(result.current.statusType).toBe('');
    });

    it('H-U-002: updateStatus sets both text and type', () => {
        const { result } = renderHook(() => useStatusBadge());

        act(() => {
            result.current.updateStatus('Loading...', 'loading');
        });

        expect(result.current.statusText).toBe('Loading...');
        expect(result.current.statusType).toBe('loading');
    });

    it('H-U-003: updateStatus defaults type to empty string when not provided', () => {
        const { result } = renderHook(() => useStatusBadge());

        act(() => {
            result.current.updateStatus('Status message');
        });

        expect(result.current.statusText).toBe('Status message');
        expect(result.current.statusType).toBe('');
    });

    it('H-U-004: clearStatus resets both to empty strings', () => {
        const { result } = renderHook(() => useStatusBadge());

        // First set some status
        act(() => {
            result.current.updateStatus('Error occurred', 'error');
        });

        expect(result.current.statusText).toBe('Error occurred');
        expect(result.current.statusType).toBe('error');

        // Then clear it
        act(() => {
            result.current.clearStatus();
        });

        expect(result.current.statusText).toBe('');
        expect(result.current.statusType).toBe('');
    });

    it('H-U-005: multiple updates work correctly (update, clear, update again)', () => {
        const { result } = renderHook(() => useStatusBadge());

        // First update
        act(() => {
            result.current.updateStatus('Loading...', 'loading');
        });

        expect(result.current.statusText).toBe('Loading...');
        expect(result.current.statusType).toBe('loading');

        // Update to success
        act(() => {
            result.current.updateStatus('Done!', 'success');
        });

        expect(result.current.statusText).toBe('Done!');
        expect(result.current.statusType).toBe('success');

        // Clear
        act(() => {
            result.current.clearStatus();
        });

        expect(result.current.statusText).toBe('');
        expect(result.current.statusType).toBe('');

        // Update again
        act(() => {
            result.current.updateStatus('New status', 'error');
        });

        expect(result.current.statusText).toBe('New status');
        expect(result.current.statusType).toBe('error');
    });
});
