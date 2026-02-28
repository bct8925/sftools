import { useEffect } from 'react';
import { useConnection } from '../contexts/ConnectionContext';
import { useProxy } from '../contexts/ProxyContext';
import { matchShortcut, isEditableTarget } from '../lib/keyboard-shortcuts';
import type { FeatureId } from '../react/TabNavigation';

interface UseKeyboardShortcutsOptions {
    navigateToFeature: (featureId: FeatureId | 'settings') => void;
    navigateHome: () => void;
}

/**
 * Registers global Alt+Number keyboard shortcuts for tab navigation.
 * Shortcuts are suppressed when focus is in an editable element (input, textarea, contenteditable).
 * Auth-required shortcuts no-op when unauthenticated; proxy-required shortcuts no-op when proxy is disconnected.
 */
export function useKeyboardShortcuts({
    navigateToFeature,
    navigateHome,
}: UseKeyboardShortcutsOptions): void {
    const { isAuthenticated, activeConnection } = useConnection();
    const { isConnected: isProxyConnected } = useProxy();

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent): void {
            if (isEditableTarget(e.target)) return;

            const binding = matchShortcut(e);
            if (!binding) return;

            if (binding.requiresAuth && !isAuthenticated) return;
            if (binding.requiresProxy && !isProxyConnected) return;

            e.preventDefault();
            e.stopPropagation();

            if (binding.target === 'home') {
                navigateHome();
            } else if (binding.target === 'open-org') {
                if (!activeConnection?.instanceUrl) return;
                chrome.tabs.create({ url: activeConnection.instanceUrl });
            } else {
                navigateToFeature(binding.target);
            }
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isAuthenticated, isProxyConnected, activeConnection, navigateToFeature, navigateHome]);
}
