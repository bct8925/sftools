// Re-export hooks from contexts for convenience
export { useConnection } from '../contexts/ConnectionContext.js';
export { useTheme } from '../contexts/ThemeContext.js';
export { useProxy } from '../contexts/ProxyContext.js';

// Utility hooks
export { useStatusBadge } from './useStatusBadge.js';
export type { UseStatusBadgeReturn, StatusType } from './useStatusBadge.js';
export { useFilteredResults } from './useFilteredResults.js';
