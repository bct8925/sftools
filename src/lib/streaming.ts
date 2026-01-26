// Streaming Channels - Functions for discovering and publishing to streaming channels

import type { QueryResult } from '../types/salesforce';
import { API_VERSION } from './utils';
import { getInstanceUrl, getAccessToken } from './auth';
import { smartFetch } from './fetch';
import { salesforceRequest } from './salesforce-request';

interface EntityDefinition {
    DeveloperName: string;
    QualifiedApiName: string;
    Label: string;
}

interface PushTopic {
    Id: string;
    Name: string;
    Query: string;
    ApiVersion: string;
    IsActive: boolean;
}

// Standard Platform Events (commonly available)
const STANDARD_EVENTS = [
    { name: 'BatchApexErrorEvent', label: 'Batch Apex Error Event' },
    { name: 'FlowExecutionErrorEvent', label: 'Flow Execution Error Event' },
    { name: 'PlatformStatusAlertEvent', label: 'Platform Status Alert Event' },
    { name: 'AsyncOperationEvent', label: 'Async Operation Event' },
];

// System Topics (CometD only)
const SYSTEM_TOPICS = [{ channel: '/systemTopic/Logging', label: 'Debug Logs' }];

export interface StreamingChannels {
    platformEvents: EntityDefinition[];
    standardEvents: typeof STANDARD_EVENTS;
    pushTopics: PushTopic[];
    systemTopics: typeof SYSTEM_TOPICS;
}

export interface PublishEventResult {
    success: boolean;
    id: string | null;
    error: string | null;
}

/**
 * Get available Platform Event channels
 * Queries for custom Platform Events (entities ending in __e)
 */
export async function getEventChannels(): Promise<{ customEvents: EntityDefinition[] }> {
    const query = encodeURIComponent(
        "SELECT DeveloperName, QualifiedApiName, Label FROM EntityDefinition WHERE QualifiedApiName LIKE '%__e' AND IsCustomizable = true ORDER BY Label"
    );

    const response = await salesforceRequest<QueryResult<EntityDefinition>>(
        `/services/data/v${API_VERSION}/tooling/query?q=${query}`
    );

    return {
        customEvents: response.json?.records ?? [],
    };
}

/**
 * Get active PushTopic channels
 */
export async function getPushTopics(): Promise<PushTopic[]> {
    const query = encodeURIComponent(
        'SELECT Id, Name, Query, ApiVersion, IsActive FROM PushTopic WHERE IsActive = true ORDER BY Name'
    );

    const response = await salesforceRequest<QueryResult<PushTopic>>(
        `/services/data/v${API_VERSION}/query?q=${query}`
    );

    return response.json?.records ?? [];
}

/**
 * Get all streaming channels (unified)
 */
export async function getAllStreamingChannels(): Promise<StreamingChannels> {
    const [platformEvents, pushTopics] = await Promise.all([
        getEventChannels(),
        getPushTopics().catch(() => []),
    ]);

    return {
        platformEvents: platformEvents.customEvents,
        standardEvents: STANDARD_EVENTS,
        pushTopics,
        systemTopics: SYSTEM_TOPICS,
    };
}

/**
 * Publish a Platform Event
 */
export async function publishPlatformEvent(
    eventType: string,
    payload: Record<string, unknown>
): Promise<PublishEventResult> {
    const response = await smartFetch(
        `${getInstanceUrl()}/services/data/v${API_VERSION}/sobjects/${eventType}`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${getAccessToken()}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        }
    );

    if (response.success) {
        const data = JSON.parse(response.data ?? '{}');
        return { success: true, id: data.id, error: null };
    }

    let errorMsg = 'Publish failed';
    try {
        const errorData = JSON.parse(response.data ?? '{}');
        if (Array.isArray(errorData) && errorData[0]?.message) {
            errorMsg = errorData[0].message;
        }
    } catch {
        // Use default error message
    }

    return { success: false, id: null, error: errorMsg };
}
