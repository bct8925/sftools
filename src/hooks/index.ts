// Re-export hooks from contexts for convenience
export { useConnection } from '../contexts/ConnectionContext';
export { useTheme } from '../contexts/ThemeContext';
export { useProxy } from '../contexts/ProxyContext';

// Utility hooks
export { useStatusBadge } from './useStatusBadge';
export type { UseStatusBadgeReturn, StatusType } from './useStatusBadge';
export { useFilteredResults } from './useFilteredResults';
