import { useEffect, useRef } from 'react';
import styles from './UtilsTab.module.css';

// Import Web Component implementations
import '../utils-tools/schema-browser-link.js';
import '../utils-tools/debug-logs.js';
import '../utils-tools/flow-cleanup.js';

/**
 * Utils Tab Container - Renders utility tools
 *
 * NOTE: Currently uses Web Component versions of utils-tools.
 * These will be migrated to React in a future wave.
 */
export function UtilsTab() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Web components are rendered via the JSX below
    // This effect is a placeholder for future React utils-tools integration
  }, []);

  return (
    <div ref={containerRef} className={styles.utilsContent}>
      {/* @ts-expect-error - Web Component not in React types */}
      <schema-browser-link />
      {/* @ts-expect-error - Web Component not in React types */}
      <debug-logs />
      {/* @ts-expect-error - Web Component not in React types */}
      <flow-cleanup />
    </div>
  );
}
