// Schema Browser - Standalone Page Entry
import { initTheme } from '../../lib/theme.js';
import { migrateDescribeCache } from '../../lib/utils.js';
import '../../components/schema/schema-page.js';

// Initialize theme before content renders
initTheme();

// Migrate cache format if needed (runs once, no-op on subsequent loads)
migrateDescribeCache();
