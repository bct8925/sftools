import { useMemo } from 'react';
import { buildChannelOptions, type ChannelGroup } from '../../lib/events-utils';

interface ChannelSelectorProps {
  /** Available platform events */
  platformEvents: Array<{ QualifiedApiName: string; Label?: string; DeveloperName: string }>;
  /** Available standard events */
  standardEvents: Array<{ name: string; label: string }>;
  /** Available push topics */
  pushTopics: Array<{ Name: string }>;
  /** Available system topics */
  systemTopics: Array<{ channel: string; label: string }>;
  /** Currently selected channel */
  value: string;
  /** Called when selection changes */
  onChange: (value: string) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Show only platform events (for publishing) */
  publishOnly?: boolean;
  className?: string;
  /** Test ID for the select element */
  'data-testid'?: string;
}

/**
 * Channel selector dropdown for streaming events.
 * Supports platform events, standard events, push topics, and system topics.
 */
export function ChannelSelector({
  platformEvents,
  standardEvents,
  pushTopics,
  systemTopics,
  value,
  onChange,
  disabled = false,
  publishOnly = false,
  className,
  'data-testid': dataTestId,
}: ChannelSelectorProps) {
  const channelGroups = useMemo(() => {
    if (publishOnly) {
      // Only show custom platform events for publishing
      const groups: ChannelGroup[] = [];
      if (platformEvents.length > 0) {
        groups.push({
          label: 'Custom Events',
          options: platformEvents.map((evt) => ({
            value: evt.QualifiedApiName,
            label: evt.Label || evt.DeveloperName,
          })),
        });
      }
      return groups;
    }

    // Show all channel types for subscribing
    return buildChannelOptions(platformEvents, standardEvents, pushTopics, systemTopics);
  }, [platformEvents, standardEvents, pushTopics, systemTopics, publishOnly]);

  return (
    <select
      className={`select${className ? ` ${className}` : ''}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      data-testid={dataTestId}
    >
      <option value="">
        {channelGroups.length === 0
          ? 'Loading channels...'
          : publishOnly
            ? 'Select an event type...'
            : 'Select a channel...'}
      </option>
      {channelGroups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
