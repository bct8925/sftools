// Platform entry point: picks the Chrome or VS Code implementation at runtime.

import { chromePlatform } from './chrome';
import { createVsCodePlatform } from './vscode';
import { installWebviewBehaviors } from './vscode-dom';
import type { Platform } from './types';

export type {
    Platform,
    PlatformKind,
    PlatformStorage,
    PlatformCapabilities,
    RecordLaunchParams,
    StorageItems,
} from './types';
export type { HostMessage, StorageChange, StorageChanges, SubscribeResponse } from './protocol';

let vscodePlatform: Platform | null = null;

/**
 * Get the platform for the current page.
 * Inside a VS Code webview (acquireVsCodeApi exists) this is the VS Code platform,
 * otherwise the Chrome extension platform.
 */
export function getPlatform(): Platform {
    if (vscodePlatform) return vscodePlatform;
    if (typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function') {
        vscodePlatform = createVsCodePlatform(
            window.acquireVsCodeApi(),
            window,
            window.__SFTOOLS_VSCODE__
        );
        const platform = vscodePlatform;
        installWebviewBehaviors(window, url => platform.openExternal(url));
        return vscodePlatform;
    }
    return chromePlatform;
}

/** True when running inside the VS Code extension. */
export function isVsCode(): boolean {
    return getPlatform().kind === 'vscode';
}

/** Shorthand for getPlatform().storage */
export const storage = {
    get: (keys?: string | string[] | null) => getPlatform().storage.get(keys),
    set: (items: Record<string, unknown>) => getPlatform().storage.set(items),
    remove: (keys: string | string[]) => getPlatform().storage.remove(keys),
    onChanged: (listener: Parameters<Platform['storage']['onChanged']>[0]) =>
        getPlatform().storage.onChanged(listener),
};

/** Test-only: forget the cached VS Code platform. */
export function resetPlatformForTests(): void {
    vscodePlatform = null;
}
