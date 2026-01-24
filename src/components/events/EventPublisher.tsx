import { useRef, useState } from 'react';
import { MonacoEditor, type MonacoEditorRef } from '../monaco-editor/MonacoEditor';
import { ChannelSelector } from './ChannelSelector';
import { publishPlatformEvent } from '../../lib/salesforce';

interface EventPublisherProps {
  /** Available platform events */
  platformEvents: Array<{ QualifiedApiName: string; Label?: string; DeveloperName: string }>;
  /** Called when an event is published successfully */
  onPublishSuccess?: (message: string) => void;
  /** Called when an error occurs */
  onError?: (message: string) => void;
}

/**
 * Event publisher card for publishing Platform Events.
 */
export function EventPublisher({
  platformEvents,
  onPublishSuccess,
  onError,
}: EventPublisherProps) {
  const editorRef = useRef<MonacoEditorRef>(null);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState<'' | 'loading' | 'success' | 'error'>('');
  const [isPublishing, setIsPublishing] = useState(false);

  const updateStatus = (text: string, type: '' | 'loading' | 'success' | 'error' = '') => {
    setStatus(text);
    setStatusType(type);
  };

  const handlePublish = async () => {
    if (!selectedChannel) {
      updateStatus('Select an event type', 'error');
      onError?.('Select an event type');
      return;
    }

    const editorValue = editorRef.current?.getValue() || '{}';
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(editorValue);
    } catch {
      updateStatus('Invalid JSON', 'error');
      onError?.('Invalid JSON');
      return;
    }

    updateStatus('Publishing...', 'loading');
    setIsPublishing(true);

    try {
      const result = await publishPlatformEvent(selectedChannel, payload);

      if (result.success) {
        updateStatus('Published', 'success');
        const message = `Published event: ${result.id || 'success'}`;
        onPublishSuccess?.(message);
      } else {
        updateStatus(result.error || 'Publish failed', 'error');
        onError?.(result.error || 'Publish failed');
      }
    } catch (err) {
      console.error('Publish error:', err);
      updateStatus('Error', 'error');
      onError?.('Publish error');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-header-icon" style={{ backgroundColor: '#706e6b' }}>
          P
        </div>
        <h2>Publish Event</h2>
      </div>
      <div className="card-body">
        <div className="form-element">
          <label htmlFor="event-publish-channel">Event Type</label>
          <ChannelSelector
            platformEvents={platformEvents}
            standardEvents={[]}
            pushTopics={[]}
            systemTopics={[]}
            value={selectedChannel}
            onChange={setSelectedChannel}
            disabled={isPublishing}
            publishOnly
          />
        </div>
        <div className="form-element">
          <label>JSON Payload (Ctrl/Cmd+Enter to publish)</label>
          <MonacoEditor
            ref={editorRef}
            language="json"
            value="{\n  \n}"
            onExecute={handlePublish}
            className="monaco-container"
          />
        </div>
        <div className="m-top_small">
          <button
            className="button-brand"
            onClick={handlePublish}
            disabled={isPublishing}
            type="button"
          >
            Publish Event
          </button>
          {status && (
            <span className={`status-badge${statusType ? ` status-${statusType}` : ''}`}>
              {status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
