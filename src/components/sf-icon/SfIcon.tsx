import { icons, type IconName } from '../../lib/icons';
import styles from './SfIcon.module.css';

interface SfIconProps {
  name: IconName;
  className?: string;
}

/**
 * Display-only icon component that renders SVG icons from the icons library.
 */
export function SfIcon({ name, className }: SfIconProps) {
  const icon = icons[name];

  if (!icon) {
    return null;
  }

  return (
    <span
      className={`${styles.icon}${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: icon }}
    />
  );
}
