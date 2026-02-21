import { useRef, useState, useCallback } from 'react';
import { MonacoEditor, type MonacoEditorRef } from '../monaco-editor/MonacoEditor';
import { ChannelSelector } from './ChannelSelector';
import { StatusBadge, type StatusType } from '../status-badge/StatusBadge';
import { ButtonIcon } from '../button-icon/ButtonIcon';
import { publishPlatformEvent } from '../../api/salesforce';
import styles from './EventsTab.module.css';

interface EventPublisherProps {
    /** Available platform events */
    platformEvents: Array<{ QualifiedApiName: string; Label?: string; DeveloperName: string }>;
    /** Called when an event is published successfully */
    onPublishSuccess?: (message: string) => void;
    /** Called when an error occurs */
    onError?: (message: string) => void;
    /** Whether the publisher card body is collapsed */
    isCollapsed?: boolean;
    /** Called when the user toggles the collapse state */
    onToggleCollapse?: () => void;
}

/**
 * Event publisher card for publishing Platform Events.
 */
export function EventPublisher({
    platformEvents,
    onPublishSuccess,
    onError,
    isCollapsed = false,
    onToggleCollapse,
}: EventPublisherProps) {
    const editorRef = useRef<MonacoEditorRef>(null);
    const [selectedChannel, setSelectedChannel] = useState('');
    const [status, setStatus] = useState('');
    const [statusType, setStatusType] = useState<StatusType>('');
    const [isPublishing, setIsPublishing] = useState(false);

    const updateStatus = useCallback((text: string, type: StatusType = '') => {
        setStatus(text);
        setStatusType(type);
    }, []);

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
            <div className={`card-header ${styles.header}`}>
                <div
                    className={`${styles.headerRow} ${onToggleCollapse ? styles.publisherHeaderRow : ''}`}
                    onClick={onToggleCollapse}
                >
                    <div className={`card-header-icon ${styles.headerIconPublish}`}>P</div>
                    <h2>Publish</h2>
                    {status && (
                        <StatusBadge type={statusType} data-testid="event-publish-status">
                            {status}
                        </StatusBadge>
                    )}
                    <div className={styles.headerControls} onClick={e => e.stopPropagation()}>
                        <ButtonIcon
                            icon="send"
                            title="Publish event"
                            onClick={handlePublish}
                            disabled={isPublishing}
                            data-testid="event-publish-btn"
                        />
                    </div>
                    {onToggleCollapse && (
                        <svg
                            className={`${styles.collapseChevron} ${!isCollapsed ? styles.collapseChevronOpen : ''}`}
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <polyline points="9 6 15 12 9 18" />
                        </svg>
                    )}
                </div>
            </div>
            {!isCollapsed && (
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
                            data-testid="event-publish-channel"
                        />
                    </div>
                    <div className="form-element">
                        <label>JSON Payload (Ctrl/Cmd+Enter to publish)</label>
                        <MonacoEditor
                            ref={editorRef}
                            language="json"
                            value={'{\n  \n}'}
                            onExecute={handlePublish}
                            className={`monaco-container ${styles.publishEditor}`}
                            data-testid="event-publish-editor"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
