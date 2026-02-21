import styles from './UtilsTab.module.css';
import { FlowCleanup } from '../utils-tools/FlowCleanup';

/**
 * Utils Tab Container - Renders utility tools
 */
export function UtilsTab() {
    return (
        <div className={styles.utilsContent} data-testid="utils-tab">
            <FlowCleanup />
        </div>
    );
}
