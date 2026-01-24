import styles from './UtilsTab.module.css';
import { SchemaBrowserLink } from '../utils-tools/SchemaBrowserLink';
import { DebugLogs } from '../utils-tools/DebugLogs';
import { FlowCleanup } from '../utils-tools/FlowCleanup';

/**
 * Utils Tab Container - Renders utility tools
 */
export function UtilsTab() {
  return (
    <div className={styles.utilsContent} data-testid="utils-tab">
      <SchemaBrowserLink />
      <DebugLogs />
      <FlowCleanup />
    </div>
  );
}
