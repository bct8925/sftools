import { useState, useEffect, useCallback, useRef } from 'react';
import { getInstanceUrl, getAccessToken } from '../../lib/auth';
import { formatEventEntry } from '../../lib/events-utils';
import type { MonacoEditorRef } from '../monaco-editor/MonacoEditor';
import type { StatusType } from '../status-badge/StatusBadge';

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

interface UseStreamSubscriptionOptions {
    selectedChannel: string;
    replayPreset: string;
    replayId: string;
    isAuthenticated: boolean;
    isProxyConnected: boolean;
    updateStreamStatus: (text: string, type?: StatusType) => void;
    appendSystemMessage: (msg: string) => void;
    streamEditorRef: React.RefObject<MonacoEditorRef | null>;
    scrollStreamToBottom: () => void;
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
    updateStreamStatus,
    appendSystemMessage,
    streamEditorRef,
    scrollStreamToBottom,
}: UseStreamSubscriptionOptions): UseStreamSubscriptionReturn {
    const [currentSubscriptionId, setCurrentSubscriptionId] = useState<string | null>(null);
    const [isSubscribed, setIsSubscribed] = useState(false);

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
                    const timestamp = new Date().toISOString();
                    const eventEntry = formatEventEntry(
                        message.event,
                        eventCountRef.current,
                        timestamp
                    );

                    const currentValue = streamEditorRef.current?.getValue() || '';
                    const newEntry = JSON.stringify(eventEntry, null, 2);

                    if (currentValue.startsWith('//')) {
                        streamEditorRef.current?.setValue(newEntry);
                    } else {
                        streamEditorRef.current?.setValue(`${currentValue}\n\n${newEntry}`);
                    }

                    scrollStreamToBottom();
                    break;
                }

                case 'streamError':
                    appendSystemMessage(`Error: ${message.error}`);
                    updateStreamStatus('Error', 'error');
                    break;

                case 'streamEnd':
                    appendSystemMessage('Stream ended by server');
                    setIsSubscribed(false);
                    setCurrentSubscriptionId(null);
                    updateStreamStatus('Disconnected', '');
                    break;
            }
        },
        [
            currentSubscriptionId,
            appendSystemMessage,
            updateStreamStatus,
            scrollStreamToBottom,
            streamEditorRef,
        ]
    );

    // Listen for chrome runtime messages
    useEffect(() => {
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
            updateStreamStatus('Select a channel', 'error');
            return;
        }

        if (!isAuthenticated) {
            updateStreamStatus('Not authenticated', 'error');
            return;
        }

        if (!isProxyConnected) {
            updateStreamStatus('Proxy required', 'error');
            appendSystemMessage('Streaming requires the local proxy. Open Settings to connect.');
            return;
        }

        updateStreamStatus('Connecting...', 'loading');

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
                updateStreamStatus('Subscribed', 'success');
                appendSystemMessage(`Subscribed to ${selectedChannel} (replay: ${replayPreset})`);
            } else {
                throw new Error(response.error || 'Subscription failed');
            }
        } catch (err) {
            console.error('Subscribe error:', err);
            updateStreamStatus('Error', 'error');
            appendSystemMessage(`Error: ${(err as Error).message}`);
        }
    }, [
        selectedChannel,
        isAuthenticated,
        isProxyConnected,
        replayPreset,
        replayId,
        updateStreamStatus,
        appendSystemMessage,
    ]);

    // Unsubscribe from channel
    const unsubscribe = useCallback(async () => {
        if (!currentSubscriptionId) return;

        updateStreamStatus('Disconnecting...', 'loading');

        try {
            await chrome.runtime.sendMessage({
                type: 'unsubscribe',
                subscriptionId: currentSubscriptionId,
            });
            appendSystemMessage('Unsubscribed');
        } catch (err) {
            console.error('Unsubscribe error:', err);
        }

        setCurrentSubscriptionId(null);
        setIsSubscribed(false);
        updateStreamStatus('Disconnected', '');
    }, [currentSubscriptionId, updateStreamStatus, appendSystemMessage]);

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
            updateStreamStatus('Disconnected', '');
        }
    }, [updateStreamStatus]);

    return {
        isSubscribed,
        currentSubscriptionId,
        subscribe,
        unsubscribe,
        toggleSubscription,
        handleDisconnect,
    };
}
