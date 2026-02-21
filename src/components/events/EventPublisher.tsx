import { useRef, useState } from 'react';
import { MonacoEditor, type MonacoEditorRef } from '../monaco-editor/MonacoEditor';
import { ChannelSelector } from './ChannelSelector';
import { ButtonIcon } from '../button-icon/ButtonIcon';
import { CollapseChevron } from '../collapse-chevron/CollapseChevron';
import { useToast } from '../../contexts/ToastContext';
import { publishPlatformEvent } from '../../api/salesforce';
import styles from './EventsTab.module.css';

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
export function EventPublisher({ platformEvents, onPublishSuccess, onError }: EventPublisherProps) {
    const editorRef = useRef<MonacoEditorRef>(null);
    const [selectedChannel, setSelectedChannel] = useState('');
    const [isPublishing, setIsPublishing] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(true);

    const handleToggleCollapse = useCallback(() => setIsCollapsed(prev => !prev), []);

    const toast = useToast();

    const handlePublish = async () => {
        if (!selectedChannel) {
            toast.show('Select an event type', 'error');
            onError?.('Select an event type');
            return;
        }

        const editorValue = editorRef.current?.getValue() || '{}';
        let payload: Record<string, unknown>;
        try {
            payload = JSON.parse(editorValue);
        } catch {
            toast.show('Invalid JSON', 'error');
            onError?.('Invalid JSON');
            return;
        }

        const id = toast.show('Publishing...', 'loading');
        setIsPublishing(true);

        try {
            const result = await publishPlatformEvent(selectedChannel, payload);

            if (result.success) {
                toast.update(id, 'Published', 'success');
                const message = `Published event: ${result.id || 'success'}`;
                onPublishSuccess?.(message);
            } else {
                toast.update(id, result.error || 'Publish failed', 'error');
                onError?.(result.error || 'Publish failed');
            }
        } catch (err) {
            console.error('Publish error:', err);
            toast.update(id, 'Error', 'error');
            onError?.('Publish error');
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <div className="card">
            <div className={`card-header ${styles.header}`}>
                <div className={styles.headerRow}>
                    <div className={`card-header-icon ${styles.headerIconPublish}`}>P</div>
                    <h2 className="card-collapse-title" onClick={handleToggleCollapse}>
                        Publish
                    </h2>
                    <CollapseChevron isOpen={!isCollapsed} onClick={handleToggleCollapse} />
                    {status && (
                        <StatusBadge type={statusType} data-testid="event-publish-status">
                            {status}
                        </StatusBadge>
                    )}
                    <div className={styles.headerControls}>
                        <ButtonIcon
                            icon="send"
                            title="Publish event"
                            onClick={handlePublish}
                            disabled={isPublishing}
                            data-testid="event-publish-btn"
                        />
                    </div>
                </div>
            </div>
            <div className="card-body" hidden={isCollapsed}>
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
            </div >
        </div >
    );
}
