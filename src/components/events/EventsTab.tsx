import { useRef, useState, useEffect, useCallback } from 'react';
import { MonacoEditor, type MonacoEditorRef } from '../monaco-editor/MonacoEditor';
import { ChannelSelector } from './ChannelSelector';
import { EventPublisher } from './EventPublisher';
import { useConnection } from '../../contexts/ConnectionContext';
import { useProxy } from '../../contexts/ProxyContext';
import { getAllStreamingChannels } from '../../lib/salesforce';
import { formatEventEntry, formatSystemMessage } from '../../lib/events-utils';
import { getInstanceUrl, getAccessToken } from '../../lib/auth';
import { StatusBadge, type StatusType } from '../status-badge/StatusBadge';
import styles from './EventsTab.module.css';

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
  const [currentSubscriptionId, setCurrentSubscriptionId] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [streamStatus, setStreamStatus] = useState('');
  const [streamStatusType, setStreamStatusType] = useState<StatusType>('');

  // Event counting
  const eventCountRef = useRef(0);

  // Update stream status helper
  const updateStreamStatus = useCallback(
    (text: string, type: '' | 'loading' | 'success' | 'error' = '') => {
      setStreamStatus(text);
      setStreamStatusType(type);
    },
    []
  );

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
    eventCountRef.current = 0;
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

  // Handle connection change - reload channels for new org
  useEffect(() => {
    const handleConnectionChange = async () => {
      // Unsubscribe from current channel if subscribed
      if (isSubscribed && currentSubscriptionId) {
        try {
          await chrome.runtime.sendMessage({
            type: 'unsubscribe',
            subscriptionId: currentSubscriptionId,
          });
        } catch {
          // Ignore errors during cleanup
        }
        setIsSubscribed(false);
        setCurrentSubscriptionId(null);
        updateStreamStatus('Disconnected', '');
      }

      // Clear stream and reload channels
      clearStream();
      setChannelsLoaded(false);
      if (isAuthenticated) {
        await loadChannels();
        setChannelsLoaded(true);
      }
    };

    handleConnectionChange();
  }, [
    activeConnection,
    isAuthenticated,
    loadChannels,
    clearStream,
    updateStreamStatus,
    isSubscribed,
    currentSubscriptionId,
  ]);

  // Load channels on mount if authenticated
  useEffect(() => {
    if (isAuthenticated && !channelsLoaded) {
      loadChannels();
      setChannelsLoaded(true);
    }
  }, [isAuthenticated, channelsLoaded, loadChannels]);

  // Handle stream messages
  const handleStreamMessage = useCallback(
    (message: StreamMessage) => {
      if (message.subscriptionId !== currentSubscriptionId) return;

      switch (message.type) {
        case 'streamEvent': {
          if (!message.event) return;

          eventCountRef.current++;
          const timestamp = new Date().toISOString();
          const eventEntry = formatEventEntry(message.event, eventCountRef.current, timestamp);

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
    [currentSubscriptionId, appendSystemMessage, updateStreamStatus, scrollStreamToBottom]
  );

  // Listen for chrome runtime messages
  useEffect(() => {
    const handler = (message: any) => {
      if (message.type === 'streamEvent' || message.type === 'streamError' || message.type === 'streamEnd') {
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

  return (
    <div className={styles.eventsTab} data-testid="events-tab">
      <div className="card">
        <div className="card-header">
          <div className="card-header-icon" style={{ backgroundColor: '#e96d63' }}>
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
