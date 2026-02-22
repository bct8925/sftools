import type { IconName } from '../lib/icons';

export type FeatureId = 'query' | 'apex' | 'logs' | 'rest-api' | 'events' | 'schema' | 'utils';
export type TabId = FeatureId | 'settings';

export interface Feature {
    id: FeatureId;
    label: string;
    requiresAuth: boolean;
    requiresProxy: boolean;
    tileIcon: IconName;
    tileColor: string;
}

export const FEATURES: Feature[] = [
    {
        id: 'query',
        label: 'Query',
        requiresAuth: true,
        requiresProxy: false,
        tileIcon: 'tileQuery',
        tileColor: 'var(--icon-query)',
    },
    {
        id: 'apex',
        label: 'Apex',
        requiresAuth: true,
        requiresProxy: false,
        tileIcon: 'tileApex',
        tileColor: 'var(--icon-apex)',
    },
    {
        id: 'logs',
        label: 'Debug Logs',
        requiresAuth: true,
        requiresProxy: false,
        tileIcon: 'tileLogs',
        tileColor: 'var(--icon-logs)',
    },
    {
        id: 'rest-api',
        label: 'REST API',
        requiresAuth: true,
        requiresProxy: false,
        tileIcon: 'tileRestApi',
        tileColor: 'var(--icon-rest-api)',
    },
    {
        id: 'schema',
        label: 'Schema',
        requiresAuth: true,
        requiresProxy: false,
        tileIcon: 'tileSchema',
        tileColor: 'var(--icon-schema)',
    },
    {
        id: 'events',
        label: 'Platform Events',
        requiresAuth: true,
        requiresProxy: true,
        tileIcon: 'tileEvents',
        tileColor: 'var(--icon-events)',
    },
    {
        id: 'utils',
        label: 'Utils',
        requiresAuth: true,
        requiresProxy: false,
        tileIcon: 'tileUtils',
        tileColor: 'var(--icon-utils)',
    },
];
