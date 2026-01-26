import { useState, useRef, useEffect, useCallback } from 'react';
import { escapeHtml } from '../../lib/text-utils';
import styles from './SearchBox.module.css';

export interface SearchBoxRenderData {
  id: string;
  name: string;
  detail?: string;
}

interface SearchBoxProps {
  /** Function to search for items based on search term */
  searchFn: (term: string) => Promise<unknown[]>;
  /** Function to render search result data */
  renderFn?: (item: unknown) => SearchBoxRenderData;
  /** Label text for the input */
  label?: string;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Callback when an item is selected */
  onSelect?: (item: unknown) => void;
  className?: string;
  /** data-testid for the input element */
  inputTestId?: string;
  /** data-testid for the dropdown container */
  dropdownTestId?: string;
}

/**
 * Reusable search box component with dropdown results.
 * Provides debounced search with customizable result rendering.
 */
export function SearchBox({
  searchFn,
  renderFn,
  label = '',
  placeholder = '',
  onSelect,
  className,
  inputTestId,
  dropdownTestId,
}: SearchBoxProps) {
  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState<unknown[]>([]);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [selectedValue, setSelectedValue] = useState<unknown | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Default render function
  const defaultRender = useCallback((item: unknown): SearchBoxRenderData => {
    const obj = item as Record<string, unknown>;
    return {
      id: String(obj.Id || obj.id || ''),
      name: String(obj.Name || obj.name || obj.Label || obj.label || ''),
      detail: obj.detail ? String(obj.detail) : undefined,
    };
  }, []);

  const renderResult = renderFn || defaultRender;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownVisible(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      const term = value.trim();

      if (term.length < 2) {
        setIsDropdownVisible(false);
        return;
      }

      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const items = await searchFn(term);
          setResults(items);
          setIsDropdownVisible(true);
        } catch (error) {
          console.error('Search error:', error);
          setResults([]);
          setIsDropdownVisible(false);
        }
      }, 300);
    },
    [searchFn]
  );

  const handleInputFocus = useCallback(() => {
    if (inputValue.trim().length >= 2 && results.length > 0) {
      setIsDropdownVisible(true);
    }
  }, [inputValue, results.length]);

  const handleResultClick = useCallback(
    (item: unknown) => {
      const data = renderResult(item);
      setSelectedValue(item);
      setInputValue(data.name);
      setIsDropdownVisible(false);
      onSelect?.(item);
    },
    [renderResult, onSelect]
  );

  return (
    <div ref={containerRef} className={`${styles.searchBox}${className ? ` ${className}` : ''}`}>
      <div className={styles.formElement}>
        {label && <label className={styles.label}>{label}</label>}
        <input
          type="text"
          className={`input ${styles.input}`}
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          data-testid={inputTestId}
        />
      </div>
      {isDropdownVisible && (
        <div className={styles.dropdown} data-testid={dropdownTestId}>
          <div className={styles.results}>
            {results.length === 0 ? (
              <div className={styles.noResults}>No results found</div>
            ) : (
              results.map((item) => {
                const data = renderResult(item);
                return (
                  <div
                    key={data.id}
                    className={`${styles.item} search-box-item`}
                    onClick={() => handleResultClick(item)}
                    data-testid="search-box-item"
                  >
                    <span className={`${styles.itemName} search-box-item-name`}>{data.name}</span>
                    {data.detail && <span className={`${styles.itemDetail} search-box-item-detail`}>{data.detail}</span>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
