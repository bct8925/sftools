import {
    createContext,
    useContext,
    useReducer,
    useEffect,
    useCallback,
    useMemo,
    type ReactNode,
} from 'react';
import { setContentScriptAvailable } from '../api/fetch';
import { useToast } from './ToastContext';

interface ContentScriptContextType {
    isActive: boolean;
    isActivating: boolean;
    error: string | null;
    enable: () => Promise<void>;
    disable: () => Promise<void>;
    checkStatus: () => Promise<void>;
}

const ContentScriptContext = createContext<ContentScriptContextType | null>(null);

interface ContentScriptState {
    status: 'inactive' | 'activating' | 'active';
    error: string | null;
}

type ContentScriptAction =
    | { type: 'ACTIVATING' }
    | { type: 'ACTIVATED' }
    | { type: 'DEACTIVATED' }
    | { type: 'ERROR'; payload: string };

function contentScriptReducer(
    state: ContentScriptState,
    action: ContentScriptAction
): ContentScriptState {
    switch (action.type) {
        case 'ACTIVATING':
            return { status: 'activating', error: null };
        case 'ACTIVATED':
            return { status: 'active', error: null };
        case 'DEACTIVATED':
            return { status: 'inactive', error: null };
        case 'ERROR':
            return { status: 'inactive', error: action.payload };
        default:
            return state;
    }
}

const initialState: ContentScriptState = {
    status: 'inactive',
    error: null,
};

interface ContentScriptProviderProps {
    children: ReactNode;
}

export function ContentScriptProvider({ children }: ContentScriptProviderProps) {
    const [state, dispatch] = useReducer(contentScriptReducer, initialState);
    const toast = useToast();

    const checkStatus = useCallback(async () => {
        if (typeof chrome === 'undefined' || !chrome.runtime) return;

        try {
            const { contentScriptEnabled, contentScriptInjected } = await chrome.storage.local.get([
                'contentScriptEnabled',
                'contentScriptInjected',
            ]);

            if (contentScriptEnabled && contentScriptInjected) {
                dispatch({ type: 'ACTIVATED' });
            } else if (contentScriptEnabled) {
                // Enabled but not yet injected — waiting for icon click
                dispatch({ type: 'ACTIVATING' });
            } else {
                dispatch({ type: 'DEACTIVATED' });
            }
        } catch {
            dispatch({ type: 'DEACTIVATED' });
        }
    }, []);

    useEffect(() => {
        checkStatus();
    }, [checkStatus]);

    // Listen for storage changes from the background service worker
    useEffect(() => {
        if (typeof chrome === 'undefined' || !chrome.storage) return;

        const handleStorageChange = (
            changes: { [key: string]: chrome.storage.StorageChange },
            area: string
        ) => {
            if (area !== 'local') return;

            if ('contentScriptAttempt' in changes) {
                // Read the latest injected state (may not be in the same change batch)
                chrome.storage.local.get(['contentScriptInjected']).then(data => {
                    toast.show(
                        data.contentScriptInjected
                            ? 'Content script injected'
                            : 'Content script injection failed — not a Salesforce page',
                        'info'
                    );
                });
            }

            if (
                'contentScriptInjected' in changes ||
                'contentScriptEnabled' in changes ||
                'contentScriptAttempt' in changes
            ) {
                checkStatus();
            }
        };

        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }, [checkStatus]);

    useEffect(() => {
        setContentScriptAvailable(state.status === 'active');
    }, [state.status]);

    const enable = useCallback(async () => {
        dispatch({ type: 'ACTIVATING' });
        try {
            await chrome.storage.local.set({ contentScriptEnabled: true });
            // Injection will happen on next icon click (activeTab grant)
        } catch (err) {
            dispatch({
                type: 'ERROR',
                payload: err instanceof Error ? err.message : 'Failed to enable',
            });
        }
    }, []);

    const disable = useCallback(async () => {
        try {
            await chrome.storage.local.set({
                contentScriptEnabled: false,
                contentScriptInjected: false,
                contentScriptTabId: null,
            });
            dispatch({ type: 'DEACTIVATED' });
        } catch (err) {
            dispatch({
                type: 'ERROR',
                payload: err instanceof Error ? err.message : 'Failed to disable',
            });
        }
    }, []);

    const value = useMemo<ContentScriptContextType>(
        () => ({
            isActive: state.status === 'active',
            isActivating: state.status === 'activating',
            error: state.error,
            enable,
            disable,
            checkStatus,
        }),
        [state, enable, disable, checkStatus]
    );

    return <ContentScriptContext.Provider value={value}>{children}</ContentScriptContext.Provider>;
}

export function useContentScript() {
    const context = useContext(ContentScriptContext);
    if (!context) {
        throw new Error('useContentScript must be used within ContentScriptProvider');
    }
    return context;
}
