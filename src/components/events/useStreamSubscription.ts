import { useState, useEffect, useCallback, useRef } from 'react';
import { getInstanceUrl, getAccessToken } from '../../auth/auth';
import { formatEventEntry } from '../../lib/events-utils';
import type { MonacoEditorRef } from '../monaco-editor/MonacoEditor';
import { useToast } from '../../contexts/ToastContext';

interface StreamMessage {
    subscriptionId: string;
    type: 'streamEvent' | 'streamError' | 'streamEnd';
    event?: {
        channel?: string;
        protocol?: string;
        replayId?: number | string;
        payload?: unknown;
        error?: string;
    };
    error?: string;
}

interface EventData {
    channel?: string;
    protocol?: string;
    replayId?: number | string;
    payload?: unknown;
    error?: string;
}

interface UseStreamSubscriptionOptions {
    selectedChannel: string;
    replayPreset: string;
    replayId: string;
    isAuthenticated: boolean;
    isProxyConnected: boolean;
    appendSystemMessage?: (msg: string) => void;
    onEventReceived?: (eventData: EventData, isSystemMessage: boolean) => void;
    streamEditorRef?: React.RefObject<MonacoEditorRef | null>;
    scrollStreamToBottom?: () => void;
}

interface UseStreamSubscriptionReturn {
    isSubscribed: boolean;
    currentSubscriptionId: string | null;
    subscribe: () => Promise<void>;
    unsubscribe: () => Promise<void>;
    toggleSubscription: () => void;
    handleDisconnect: () => Promise<void>;
}

/**
 * Hook for managing streaming subscription lifecycle
 *
 * Handles:
 * - Subscription state (subscribed/unsubscribed)
 * - Chrome runtime message listener for stream events
 * - Subscribe/unsubscribe actions
 * - Connection change cleanup
 */
export function useStreamSubscription({
    selectedChannel,
    replayPreset,
    replayId,
    isAuthenticated,
    isProxyConnected,
    appendSystemMessage,
    onEventReceived,
    streamEditorRef,
    scrollStreamToBottom,
}: UseStreamSubscriptionOptions): UseStreamSubscriptionReturn {
    const [currentSubscriptionId, setCurrentSubscriptionId] = useState<string | null>(null);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const toast = useToast();
    const activeToastRef = useRef<string | null>(null);

    // Event counting
    const eventCountRef = useRef(0);

    // Track subscription state in refs for use in connection change handler
    // This avoids re-running the effect when subscription state changes
    const subscriptionRef = useRef<{ isSubscribed: boolean; subscriptionId: string | null }>({
        isSubscribed: false,
        subscriptionId: null,
    });

    // Keep refs in sync with state
    useEffect(() => {
        subscriptionRef.current = { isSubscribed, subscriptionId: currentSubscriptionId };
    }, [isSubscribed, currentSubscriptionId]);

    // Handle stream messages
    const handleStreamMessage = useCallback(
        (message: StreamMessage) => {
            if (message.subscriptionId !== currentSubscriptionId) return;

            switch (message.type) {
                case 'streamEvent': {
                    if (!message.event) return;

                    eventCountRef.current++;

                    // New callback-based approach
                    if (onEventReceived) {
                        onEventReceived(message.event, false);
                    }

                    // Legacy Monaco editor approach (deprecated)
                    if (streamEditorRef?.current && scrollStreamToBottom) {
                        const timestamp = new Date().toISOString();
                        const eventEntry = formatEventEntry(
                            message.event,
                            eventCountRef.current,
                            timestamp
                        );

                        const currentValue = streamEditorRef.current.getValue() || '';
                        const newEntry = JSON.stringify(eventEntry, null, 2);

                        if (currentValue.startsWith('//')) {
                            streamEditorRef.current.setValue(newEntry);
                        } else {
                            streamEditorRef.current.setValue(`${currentValue}\n\n${newEntry}`);
                        }

                        scrollStreamToBottom();
                    }
                    break;
                }

                case 'streamError':
                    if (onEventReceived) {
                        onEventReceived({ error: message.error }, true);
                    }
                    if (appendSystemMessage) {
                        appendSystemMessage(`Error: ${message.error}`);
                    }
                    toast.show('Stream error', 'error');
                    break;

                case 'streamEnd':
                    if (onEventReceived) {
                        onEventReceived({ error: 'Stream ended by server' }, true);
                    }
                    if (appendSystemMessage) {
                        appendSystemMessage('Stream ended by server');
                    }
                    setIsSubscribed(false);
                    setCurrentSubscriptionId(null);
                    break;
            }
        },
        [
            currentSubscriptionId,
            appendSystemMessage,
            onEventReceived,
            toast,
            scrollStreamToBottom,
            streamEditorRef,
        ]
    );

    // Listen for chrome runtime messages
    useEffect(() => {
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handler = (message: any) => {
            if (
                message.type === 'streamEvent' ||
                message.type === 'streamError' ||
                message.type === 'streamEnd'
            ) {
                handleStreamMessage(message as StreamMessage);
            }
        };

        chrome.runtime.onMessage.addListener(handler);
        return () => chrome.runtime.onMessage.removeListener(handler);
    }, [handleStreamMessage]);

    // Subscribe to channel
    const subscribe = useCallback(async () => {
        if (!selectedChannel) {
            toast.show('Select a channel', 'error');
            return;
        }

        if (!isAuthenticated) {
            toast.show('Not authenticated', 'error');
            return;
        }

        if (!isProxyConnected) {
            toast.show('Proxy required', 'error');
            const msg = 'Streaming requires the local proxy. Open Settings to connect.';
            if (onEventReceived) {
                onEventReceived({ error: msg }, true);
            }
            if (appendSystemMessage) {
                appendSystemMessage(msg);
            }
            return;
        }

        const id = toast.show('Connecting...', 'loading');
        activeToastRef.current = id;

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'subscribe',
                instanceUrl: getInstanceUrl(),
                accessToken: getAccessToken(),
                channel: selectedChannel,
                replayPreset,
                replayId: replayPreset === 'CUSTOM' ? replayId : undefined,
            });

            if (response.success) {
                setCurrentSubscriptionId(response.subscriptionId);
                setIsSubscribed(true);
                if (activeToastRef.current) {
                    toast.update(activeToastRef.current, 'Subscribed', 'success');
                    activeToastRef.current = null;
                }
                const msg = `Subscribed to ${selectedChannel} (replay: ${replayPreset})`;
                if (onEventReceived) {
                    onEventReceived({ channel: selectedChannel, payload: { message: msg } }, true);
                }
                if (appendSystemMessage) {
                    appendSystemMessage(msg);
                }
            } else {
                throw new Error(response.error || 'Subscription failed');
            }
        } catch (err) {
            console.error('Subscribe error:', err);
            if (activeToastRef.current) {
                toast.update(activeToastRef.current, 'Error', 'error');
                activeToastRef.current = null;
            } else {
                toast.show('Error', 'error');
            }
            const msg = `Error: ${(err as Error).message}`;
            if (onEventReceived) {
                onEventReceived({ error: msg }, true);
            }
            if (appendSystemMessage) {
                appendSystemMessage(msg);
            }
        }
    }, [
        selectedChannel,
        isAuthenticated,
        isProxyConnected,
        replayPreset,
        replayId,
        toast,
        appendSystemMessage,
        onEventReceived,
    ]);

    // Unsubscribe from channel
    const unsubscribe = useCallback(async () => {
        if (!currentSubscriptionId) return;

        try {
            await chrome.runtime.sendMessage({
                type: 'unsubscribe',
                subscriptionId: currentSubscriptionId,
            });
            const msg = 'Unsubscribed';
            if (onEventReceived) {
                onEventReceived({ payload: { message: msg } }, true);
            }
            if (appendSystemMessage) {
                appendSystemMessage(msg);
            }
        } catch (err) {
            console.error('Unsubscribe error:', err);
        }

        setCurrentSubscriptionId(null);
        setIsSubscribed(false);
    }, [currentSubscriptionId, appendSystemMessage, onEventReceived]);

    // Toggle subscription
    const toggleSubscription = useCallback(() => {
        if (isSubscribed) {
            unsubscribe();
        } else {
            subscribe();
        }
    }, [isSubscribed, subscribe, unsubscribe]);

    // Handle connection change cleanup
    const handleDisconnect = useCallback(async () => {
        const { isSubscribed: wasSubscribed, subscriptionId } = subscriptionRef.current;
        if (wasSubscribed && subscriptionId) {
            try {
                await chrome.runtime.sendMessage({
                    type: 'unsubscribe',
                    subscriptionId,
                });
            } catch {
                // Ignore errors during cleanup
            }
            setIsSubscribed(false);
            setCurrentSubscriptionId(null);
        }
    }, []);

    return {
        isSubscribed,
        currentSubscriptionId,
        subscribe,
        unsubscribe,
        toggleSubscription,
        handleDisconnect,
    };
}
