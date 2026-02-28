import { FEATURES } from '../react/TabNavigation';
import type { TabId } from '../react/TabNavigation';

export type ShortcutTarget = TabId | 'home' | 'open-org';

export interface ShortcutBinding {
    /** KeyboardEvent.code value (e.g., 'Digit1', 'KeyO') — layout-independent */
    code: string;
    target: ShortcutTarget;
    requiresAuth: boolean;
    requiresProxy: boolean;
}

/**
 * Global keyboard shortcut bindings.
 * Feature tabs are derived from FEATURES to stay in sync with TabNavigation.
 * Bindings: Alt+1–7 for features, Alt+8 for settings, Alt+0 for home, Alt+O to open org.
 */
export const SHORTCUT_BINDINGS: ShortcutBinding[] = [
    // Feature tabs: Alt+1 through Alt+7 (order matches FEATURES array)
    ...FEATURES.map((feature, index) => ({
        code: `Digit${index + 1}`,
        target: feature.id as ShortcutTarget,
        requiresAuth: feature.requiresAuth,
        requiresProxy: feature.requiresProxy,
    })),
    // Settings: Alt+8
    { code: 'Digit8', target: 'settings', requiresAuth: false, requiresProxy: false },
    // Home: Alt+0
    { code: 'Digit0', target: 'home', requiresAuth: false, requiresProxy: false },
    // Open Org: Alt+O
    { code: 'KeyO', target: 'open-org', requiresAuth: true, requiresProxy: false },
];

/**
 * Find a shortcut binding matching the given keyboard event.
 * Returns null if the event is not an Alt+key shortcut or has no binding.
 */
export function matchShortcut(e: KeyboardEvent): ShortcutBinding | null {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return null;
    return SHORTCUT_BINDINGS.find(b => b.code === e.code) ?? null;
}

/**
 * Returns true if the event target is an editable element (input, textarea, contenteditable).
 * Used to suppress shortcuts when the user is typing.
 * Note: Monaco editor uses non-editable div elements, so shortcuts work while coding.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
    if (!target || !(target instanceof Element)) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
    const contentEditable = target.getAttribute('contenteditable');
    return contentEditable !== null && contentEditable !== 'false';
}
