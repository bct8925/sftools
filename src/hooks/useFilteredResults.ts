import { useState, useRef, useCallback } from 'react';

/**
 * Hook for managing filtered results with debounced input.
 * Provides filter state and handlers for text-based filtering.
 */
export function useFilteredResults() {
    const [filterText, setFilterText] = useState('');
    const filterTimeoutRef = useRef<number | null>(null);

    const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (filterTimeoutRef.current !== null) {
            clearTimeout(filterTimeoutRef.current);
        }
        filterTimeoutRef.current = window.setTimeout(() => {
            setFilterText(value);
        }, 200);
    }, []);

    const clearFilter = useCallback(() => {
        setFilterText('');
    }, []);

    return {
        filterText,
        setFilterText,
        handleFilterChange,
        clearFilter,
    };
}
