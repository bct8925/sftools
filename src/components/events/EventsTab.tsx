import { useRef, useState, useEffect, useCallback } from 'react';
import { MonacoEditor, type MonacoEditorRef } from '../monaco-editor/MonacoEditor';
import { ChannelSelector } from './ChannelSelector';
import { EventPublisher } from './EventPublisher';
import { useConnection, useProxy } from '../../contexts';
import { useStatusBadge } from '../../hooks';
import { getAllStreamingChannels } from '../../lib/salesforce';
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

/**
 * Events Tab - Unified Streaming (gRPC Pub/Sub + CometD)
 */
export function EventsTab() {
  const { isAuthenticated, activeConnection } = useConnection();
  const { isConnected: isProxyConnected } = useProxy();

  const streamEditorRef = useRef<MonacoEditorRef>(null);

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
  const { statusText: streamStatus, statusType: streamStatusType, updateStatus: updateStreamStatus } = useStatusBadge();

  // Append system message to stream
  const appendSystemMessage = useCallback((msg: string) => {
    const current = streamEditorRef.current?.getValue() || '';
    const newContent = `${current}${formatSystemMessage(msg)}\n`;
    streamEditorRef.current?.setValue(newContent);
    scrollStreamToBottom();
  }, []);

  // Scroll stream to bottom
  const scrollStreamToBottom = useCallback(() => {
    const editor = streamEditorRef.current?.getEditor();
    if (editor) {
      const lineCount = editor.getModel()?.getLineCount();
      if (lineCount) {
        editor.revealLine(lineCount);
      }
    }
  }, []);

  // Clear stream
  const clearStream = useCallback(() => {
    streamEditorRef.current?.setValue('// Stream cleared\n');
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
    appendSystemMessage,
    streamEditorRef,
    scrollStreamToBottom,
  });

  // Handle connection change - reload channels for new org
  useEffect(() => {
    const handleConnectionChange = async () => {
      // Unsubscribe from current channel if subscribed
      await handleDisconnect();

      // Clear stream and reload channels
      clearStream();
      setChannelsLoaded(false);
      if (isAuthenticated) {
        await loadChannels();
        setChannelsLoaded(true);
      }
    };

    handleConnectionChange();
  }, [activeConnection, isAuthenticated, loadChannels, clearStream, handleDisconnect]);

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
        <div className="card-header">
          <div className={`card-header-icon ${styles.headerIconEvents}`}>
            E
          </div>
          <h2>Streaming Events</h2>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px' }}>
              <select
                className="select"
                value={replayPreset}
                onChange={(e) => setReplayPreset(e.target.value)}
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
                onChange={(e) => setReplayId(e.target.value)}
                disabled={isSubscribed}
                data-testid="event-replay-id"
              />
            </div>
          )}
          <div className="form-element">
            <label>
              Event Stream{' '}
              {streamStatus && (
                <StatusBadge type={streamStatusType} data-testid="event-stream-status">{streamStatus}</StatusBadge>
              )}
            </label>
            <MonacoEditor
              ref={streamEditorRef}
              language="json"
              value="// Subscribe to a channel to see events here\n"
              readonly
              className="monaco-container monaco-container-lg"
              data-testid="event-stream-editor"
            />
          </div>
          <button className="button-neutral" onClick={clearStream} type="button" data-testid="event-clear-btn">
            Clear Stream
          </button>
        </div>
      </div>

      <EventPublisher
        platformEvents={channels.platformEvents}
        onPublishSuccess={appendSystemMessage}
        onError={(msg) => appendSystemMessage(`Error: ${msg}`)}
      />
    </div>
  );
}
