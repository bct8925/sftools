// Test-only re-exports from fetch.ts
// Production code should import from './fetch' directly

export type { FetchOptions } from './fetch';
export { extensionFetch, proxyFetch } from './fetch';
