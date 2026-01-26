import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './ButtonDropdown.module.css';

export interface DropdownOption {
  label: string;
  disabled?: boolean;
}

interface ButtonDropdownProps {
  /** Text displayed on main button */
  label?: string;
  /** Disables both main and trigger buttons */
  disabled?: boolean;
  /** Dropdown options */
  options: DropdownOption[];
  /** Called when main button is clicked */
  onClickMain?: () => void;
  /** Called when a dropdown option is clicked */
  onClickOption?: (index: number, option: DropdownOption) => void;
  className?: string;
}

/**
 * Split button with main action and dropdown trigger for alternative actions.
 */
export function ButtonDropdown({
  label = 'Action',
  disabled = false,
  options,
  onClickMain,
  onClickOption,
  className,
}: ButtonDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleMainClick = useCallback(() => {
    if (!disabled) {
      onClickMain?.();
    }
  }, [disabled, onClickMain]);

  const handleTriggerClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!disabled) {
        setIsOpen((prev) => !prev);
      }
    },
    [disabled]
  );

  const handleOptionClick = useCallback(
    (index: number, option: DropdownOption) => {
      if (!option.disabled) {
        onClickOption?.(index, option);
        setIsOpen(false);
      }
    },
    [onClickOption]
  );

  return (
    <div
      ref={containerRef}
      className={`${styles.buttonDropdown}${isOpen ? ` ${styles.open}` : ''}${className ? ` ${className}` : ''}`}
    >
      <button
        className={`${styles.main} button-brand`}
        disabled={disabled}
        onClick={handleMainClick}
        type="button"
      >
        {label}
      </button>
      <button
        className={`${styles.trigger} button-brand`}
        disabled={disabled}
        onClick={handleTriggerClick}
        type="button"
      >
        &#9662;
      </button>
      <div className={styles.menu}>
        {options.map((option, index) => (
          <button
            key={index}
            className={styles.option}
            disabled={option.disabled}
            onClick={() => handleOptionClick(index, option)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
