import { ButtonIcon } from '../button-icon/ButtonIcon';
import styles from './EventsSettingsModal.module.css';

interface EventsSettingsModalProps {
    replayPreset: string;
    onReplayPresetChange: (value: string) => void;
    replayId: string;
    onReplayIdChange: (value: string) => void;
    disabled: boolean;
    onClose: () => void;
}

/**
 * Settings modal for the Events (Streaming) tab.
 * Contains replay configuration options.
 */
export function EventsSettingsModal({
    replayPreset,
    onReplayPresetChange,
    replayId,
    onReplayIdChange,
    disabled,
    onClose,
}: EventsSettingsModalProps) {
    return (
        <div className={styles.settingsModal} data-testid="events-settings-modal">
            <div className={styles.header}>
                <h3>Streaming Settings</h3>
                <ButtonIcon
                    icon="close"
                    title="Close"
                    onClick={onClose}
                    data-testid="events-settings-close-btn"
                />
            </div>
            <div className={styles.content}>
                <div className={styles.section}>
                    <h4 className={styles.sectionTitle}>Replay From</h4>
                    <select
                        className="select"
                        value={replayPreset}
                        onChange={e => onReplayPresetChange(e.target.value)}
                        disabled={disabled}
                        data-testid="event-replay-select"
                    >
                        <option value="LATEST">Latest (new events only)</option>
                        <option value="EARLIEST">Earliest (all retained events)</option>
                        <option value="CUSTOM">Custom Replay ID</option>
                    </select>
                    {replayPreset === 'CUSTOM' && (
                        <div className={styles.customReplay}>
                            <label htmlFor="event-replay-id" className={styles.label}>
                                Replay ID
                            </label>
                            <input
                                id="event-replay-id"
                                type="text"
                                className="input"
                                placeholder="Enter base64 replay ID"
                                value={replayId}
                                onChange={e => onReplayIdChange(e.target.value)}
                                disabled={disabled}
                                data-testid="event-replay-id"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
