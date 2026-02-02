import { useRef, useState, useEffect, useCallback } from 'react';
import { MonacoEditor, type MonacoEditorRef } from '../monaco-editor/MonacoEditor';
import { ChannelSelector } from './ChannelSelector';
import { EventPublisher } from './EventPublisher';
import { useConnection } from '../../contexts/ConnectionContext';
import { useProxy } from '../../contexts/ProxyContext';
import { useStatusBadge } from '../../hooks/useStatusBadge';
import { getAllStreamingChannels } from '../../api/salesforce';
import { formatSystemMessage } from '../../lib/events-utils';
import { StatusBadge } from '../status-badge/StatusBadge';
import { useStreamSubscription } from './useStreamSubscription';
import styles from './EventsTab.module.css';

interface StreamingChannels {
    platformEvents: Array<{ QualifiedApiName: string; Label?: string; DeveloperName: string }>;
    standardEvents: Array<{ name: string; label: string }>;
    pushTopics: Array<{ Name: string }>;
    systemTopics: Array<{ channel: string; label: string }>;
}

interface StreamEvent {
    id: string;
    timestamp: string;
    replayId?: number | string;
    channel: string;
    eventType: string;
    payload: unknown;
    isSystemMessage?: boolean;
}

// Generate unique event ID
const generateEventId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Extract event type from payload
const extractEventType = (payload: unknown, channel: string): string => {
    if (typeof payload === 'object' && payload !== null) {
        const p = payload as Record<string, unknown>;
        if (p.schema && typeof p.schema === 'string') {
            const parts = p.schema.split('/');
            return parts[parts.length - 1] || 'Unknown';
        }
        if (p.sobject && typeof p.sobject === 'object') {
            const sobject = p.sobject as Record<string, unknown>;
            const attrs = sobject.attributes as Record<string, unknown> | undefined;
            if (attrs?.type && typeof attrs.type === 'string') {
                return attrs.type;
            }
        }
    }
    return channel || 'Unknown';
};

// Format time for display
const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
};

const MAX_EVENTS = 100;

/**
 * Events Tab - Unified Streaming (gRPC Pub/Sub + CometD)
 */
export function EventsTab() {
    const { isAuthenticated, activeConnection } = useConnection();
    const { isConnected: isProxyConnected } = useProxy();

    const streamEditorRef = useRef<MonacoEditorRef>(null);
    const tableScrollRef = useRef<HTMLDivElement>(null);

    // Event table state
    const [events, setEvents] = useState<StreamEvent[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [openedEventIds, setOpenedEventIds] = useState<Set<string>>(new Set());

    // Channel data
    const [channels, setChannels] = useState<StreamingChannels>({
        platformEvents: [],
        standardEvents: [],
        pushTopics: [],
        systemTopics: [],
    });
    const [channelsLoaded, setChannelsLoaded] = useState(false);

    // Subscription state
    const [selectedChannel, setSelectedChannel] = useState('');
    const [replayPreset, setReplayPreset] = useState('LATEST');
    const [replayId, setReplayId] = useState('');
    const {
        statusText: streamStatus,
        statusType: streamStatusType,
        updateStatus: updateStreamStatus,
    } = useStatusBadge();

    // Handle event received from subscription
    const handleEventReceived = useCallback(
        (
            eventData: {
                channel?: string;
                protocol?: string;
                replayId?: number | string;
                payload?: unknown;
                error?: string;
            },
            isSystemMessage: boolean
        ) => {
            const timestamp = new Date().toISOString();
            const id = generateEventId();

            const event: StreamEvent = {
                id,
                timestamp,
                replayId: eventData.replayId,
                channel: eventData.channel || selectedChannel,
                eventType: isSystemMessage
                    ? eventData.error
                        ? 'Error'
                        : 'System'
                    : extractEventType(eventData.payload, eventData.channel || selectedChannel),
                payload: eventData.error ? { message: eventData.error } : eventData.payload || {},
                isSystemMessage,
            };

            setEvents(prev => {
                const next = [...prev, event];

                // Enforce limit on non-system events while preserving order
                const nonSystemCount = next.filter(e => !e.isSystemMessage).length;
                if (nonSystemCount > MAX_EVENTS) {
                    // Remove oldest non-system event
                    const idx = next.findIndex(e => !e.isSystemMessage);
                    if (idx !== -1) next.splice(idx, 1);
                }

                return next;
            });

            // Auto-scroll table to bottom
            setTimeout(() => {
                if (tableScrollRef.current) {
                    tableScrollRef.current.scrollTop = tableScrollRef.current.scrollHeight;
                }
            }, 50);
        },
        [selectedChannel]
    );

    // Open event in Monaco editor
    const handleOpenEvent = useCallback((event: StreamEvent) => {
        const formatted = JSON.stringify(event.payload, null, 2);
        streamEditorRef.current?.setValue(formatted);
        setSelectedEventId(event.id);
        setOpenedEventIds(prev => new Set(prev).add(event.id));
    }, []);

    // Clear stream and events
    const clearStream = useCallback(() => {
        setEvents([]);
        setSelectedEventId(null);
        setOpenedEventIds(new Set());
        streamEditorRef.current?.setValue('// Click Open on any event to view details\n');
    }, []);

    // Load channels from API
    const loadChannels = useCallback(async () => {
        if (!isAuthenticated) {
            setChannels({
                platformEvents: [],
                standardEvents: [],
                pushTopics: [],
                systemTopics: [],
            });
            return;
        }

        try {
            const channelData = await getAllStreamingChannels();
            setChannels(channelData);
        } catch (err) {
            console.error('Error loading streaming channels:', err);
        }
    }, [isAuthenticated]);

    // Stream subscription hook
    const { isSubscribed, toggleSubscription, handleDisconnect } = useStreamSubscription({
        selectedChannel,
        replayPreset,
        replayId,
        isAuthenticated,
        isProxyConnected,
        updateStreamStatus,
        onEventReceived: handleEventReceived,
    });

    // Handle connection change - reload channels for new org
    useEffect(() => {
        const handleConnectionChange = async () => {
            // Unsubscribe from current channel if subscribed
            await handleDisconnect();

            // Clear events, stream and reload channels
            setEvents([]);
            setSelectedEventId(null);
            setOpenedEventIds(new Set());
            streamEditorRef.current?.setValue('// Subscribe to a channel to see events here\n');
            setChannelsLoaded(false);
            if (isAuthenticated) {
                await loadChannels();
                setChannelsLoaded(true);
            }
        };

        handleConnectionChange();
    }, [activeConnection, isAuthenticated, loadChannels, handleDisconnect]);

    // Load channels on mount if authenticated
    useEffect(() => {
        if (isAuthenticated && !channelsLoaded) {
            loadChannels();
            setChannelsLoaded(true);
        }
    }, [isAuthenticated, channelsLoaded, loadChannels]);

    return (
        <div className={styles.eventsTab} data-testid="events-tab">
            <div className="card">
                <div className={`card-header ${styles.header}`}>
                    <div className={styles.headerRow}>
                        <div className={`card-header-icon ${styles.headerIconEvents}`}>E</div>
                        <h2>Streaming Events</h2>
                    </div>
                    <div className={styles.headerRow}>
                        {streamStatus && (
                            <StatusBadge type={streamStatusType} data-testid="event-stream-status">
                                {streamStatus}
                            </StatusBadge>
                        )}
                        <div className={styles.headerControls}>
                            <button
                                className="button-neutral"
                                onClick={clearStream}
                                type="button"
                                data-testid="event-clear-btn"
                            >
                                Clear Stream
                            </button>
                        </div>
                    </div>
                </div>
                <div className="card-body">
                    <div className="form-element">
                        <label htmlFor="event-channel-select">Channel</label>
                        <ChannelSelector
                            platformEvents={channels.platformEvents}
                            standardEvents={channels.standardEvents}
                            pushTopics={channels.pushTopics}
                            systemTopics={channels.systemTopics}
                            value={selectedChannel}
                            onChange={setSelectedChannel}
                            disabled={isSubscribed}
                            data-testid="event-channel-select"
                        />
                    </div>
                    <div className="form-element">
                        <label htmlFor="event-replay-select">Replay From</label>
                        <div className={styles.replayRow}>
                            <select
                                className="select"
                                value={replayPreset}
                                onChange={e => setReplayPreset(e.target.value)}
                                disabled={isSubscribed}
                                data-testid="event-replay-select"
                            >
                                <option value="LATEST">Latest (new events only)</option>
                                <option value="EARLIEST">Earliest (all retained events)</option>
                                <option value="CUSTOM">Custom Replay ID</option>
                            </select>
                            <button
                                className="button-brand"
                                onClick={toggleSubscription}
                                type="button"
                                data-testid="event-subscribe-btn"
                            >
                                {isSubscribed ? 'Unsubscribe' : 'Subscribe'}
                            </button>
                        </div>
                    </div>
                    {replayPreset === 'CUSTOM' && (
                        <div className="form-element">
                            <label htmlFor="event-replay-id">Replay ID</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Enter base64 replay ID"
                                value={replayId}
                                onChange={e => setReplayId(e.target.value)}
                                disabled={isSubscribed}
                                data-testid="event-replay-id"
                            />
                        </div>
                    )}

                    {/* Viewer Layout */}
                    <div className={styles.viewer}>
                        {/* Monaco Editor (2/3) */}
                        <div className={styles.viewerEditor}>
                            <MonacoEditor
                                ref={streamEditorRef}
                                language="json"
                                value="// Click Open on any event to view details\n"
                                readonly
                                className="monaco-container monaco-container-lg"
                                data-testid="event-stream-editor"
                            />
                        </div>

                        {/* Event Table (1/3) */}
                        <div className={styles.viewerTable} ref={tableScrollRef}>
                            {events.length === 0 ? (
                                <div className={styles.emptyState}>
                                    <div className={styles.emptyStateIcon}>📡</div>
                                    <p>Subscribe to a channel to see events</p>
                                </div>
                            ) : (
                                <table className={styles.eventTable} data-testid="event-table">
                                    <thead>
                                        <tr>
                                            <th>Time</th>
                                            <th>Replay ID</th>
                                            <th>Channel</th>
                                            <th>Event Type</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {events.map(event => (
                                            <tr
                                                key={event.id}
                                                className={`${openedEventIds.has(event.id) ? styles.rowOpened : ''} ${
                                                    event.isSystemMessage ? styles.rowSystem : ''
                                                }`}
                                                data-testid={`event-row-${event.id}`}
                                            >
                                                <td className={styles.time}>
                                                    {formatTime(event.timestamp)}
                                                </td>
                                                <td className={styles.replayIdCell}>
                                                    {event.replayId !== undefined
                                                        ? String(event.replayId)
                                                        : '-'}
                                                </td>
                                                <td>{event.channel}</td>
                                                <td>{event.eventType}</td>
                                                <td>
                                                    <button
                                                        className="button-neutral button-sm"
                                                        onClick={() => handleOpenEvent(event)}
                                                        data-testid={`event-open-${event.id}`}
                                                    >
                                                        Open
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <EventPublisher
                platformEvents={channels.platformEvents}
                onPublishSuccess={msg =>
                    handleEventReceived(
                        { channel: 'PublishEvent', payload: { message: msg } },
                        true
                    )
                }
                onError={msg => handleEventReceived({ error: msg }, true)}
            />
        </div>
    );
}
