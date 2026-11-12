// Test-only re-exports from the platform layer
// Production code should import from './index' directly

export { resetPlatformForTests } from './index';
export { chromePlatform } from './chrome';
export { createVsCodePlatform } from './vscode';
export type { VsCodeApi } from './vscode';
