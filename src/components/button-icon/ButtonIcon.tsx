import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { icons, type IconName } from '../../lib/icons.js';
import styles from './ButtonIcon.module.css';

interface ButtonIconProps {
  /** SLDS icon name from icons library */
  icon?: IconName;
  /** HTML entity fallback (if icon not provided) */
  iconHtml?: string;
  /** Tooltip text */
  title?: string;
  /** Disables the button and menu */
  disabled?: boolean;
  /** Click handler for simple button mode (no children) */
  onClick?: () => void;
  /** Toggle handler for dropdown mode (with children) */
  onToggle?: (isOpen: boolean) => void;
  /** Menu content - if provided, enables dropdown mode */
  children?: ReactNode;
  className?: string;
  'data-testid'?: string;
}

/**
 * Icon button with optional dropdown menu support.
 * - Without children: simple icon button that fires onClick
 * - With children: dropdown button that shows menu on click
 */
export function ButtonIcon({
  icon,
  iconHtml = '&#8942;',
  title,
  disabled = false,
  onClick,
  onToggle,
  children,
  className,
  'data-testid': dataTestId,
}: ButtonIconProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasMenu = children != null;

  // Get icon content
  const iconContent = icon && icons[icon] ? icons[icon] : iconHtml;

  // Close on outside click
  useEffect(() => {
    if (!hasMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [hasMenu]);

  const handleTriggerClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();

      if (disabled) return;

      if (hasMenu) {
        const newState = !isOpen;
        setIsOpen(newState);
        onToggle?.(newState);
      } else {
        onClick?.();
      }
    },
    [disabled, hasMenu, isOpen, onClick, onToggle]
  );

  // Public methods via ref could be added here with useImperativeHandle if needed
  const close = useCallback(() => setIsOpen(false), []);
  const open = useCallback(() => setIsOpen(true), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return (
    <div
      ref={containerRef}
      className={`${styles.buttonIcon}${isOpen ? ` ${styles.open}` : ''}${className ? ` ${className}` : ''}`}
    >
      <button
        className={styles.trigger}
        title={title}
        disabled={disabled}
        onClick={handleTriggerClick}
        type="button"
        dangerouslySetInnerHTML={{ __html: iconContent }}
        data-testid={dataTestId}
      />
      {hasMenu && <div className={styles.menu}>{children}</div>}
    </div>
  );
}

/** Menu option button style */
export function ButtonIconOption({
  children,
  disabled,
  onClick,
  'data-testid': dataTestId,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  'data-testid'?: string;
}) {
  return (
    <button
      className={styles.option}
      disabled={disabled}
      onClick={onClick}
      type="button"
      data-testid={dataTestId}
    >
      {children}
    </button>
  );
}

/** Checkbox option style for menus */
export function ButtonIconCheckbox({
  children,
  checked,
  onChange,
  'data-testid': dataTestId,
}: {
  children: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  'data-testid'?: string;
}) {
  return (
    <label className={styles.checkbox}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        data-testid={dataTestId}
      />
      {children}
    </label>
  );
}
