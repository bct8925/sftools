// chrome.storage.local equivalent for the webviews, kept in the extension's globalState.
// 'connections' is virtual: it always reflects the sf CLI's orgs and can't be written.

import type { StorageChanges } from '../../src/platform/protocol';
import type { OrgService } from './orgs';

/** The part of vscode.Memento this needs */
export interface MementoLike {
    keys(): readonly string[];
    get<T>(key: string): T | undefined;
    update(key: string, value: unknown): Thenable<void> | Promise<void>;
}

export const CONNECTIONS_KEY = 'connections';
/** Keys the Chrome extension uses for its own connection management, not used here */
const IGNORED_KEYS = new Set([CONNECTIONS_KEY, 'accessToken', 'instanceUrl', 'refreshToken']);

export class HostStorage {
    private readonly listeners = new Set<(changes: StorageChanges) => void>();

    constructor(
        private readonly memento: MementoLike,
        private readonly orgs: OrgService
    ) {}

    onChanged(listener: (changes: StorageChanges) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    async get(keys: string[] | null): Promise<Record<string, unknown>> {
        const wanted = keys ?? [...this.memento.keys(), CONNECTIONS_KEY];
        const result: Record<string, unknown> = {};
        for (const key of wanted) {
            if (key === CONNECTIONS_KEY) {
                result[key] = await this.orgs.getConnections();
                continue;
            }
            if (IGNORED_KEYS.has(key)) continue;
            const value = this.memento.get(key);
            if (value !== undefined) result[key] = value;
        }
        return result;
    }

    async set(items: Record<string, unknown>): Promise<void> {
        const changes: StorageChanges = {};
        for (const [key, value] of Object.entries(items)) {
            if (IGNORED_KEYS.has(key)) continue;
            const oldValue = this.memento.get(key);
            await this.memento.update(key, value);
            changes[key] = { oldValue, newValue: value };
        }
        this.emit(changes);
    }

    async remove(keys: string[]): Promise<void> {
        const changes: StorageChanges = {};
        for (const key of keys) {
            if (IGNORED_KEYS.has(key)) continue;
            const oldValue = this.memento.get(key);
            if (oldValue === undefined) continue;
            await this.memento.update(key, undefined);
            changes[key] = { oldValue };
        }
        this.emit(changes);
    }

    /** Tell webviews the org list changed */
    async emitConnectionsChanged(): Promise<void> {
        this.emit({ [CONNECTIONS_KEY]: { newValue: await this.orgs.getConnections() } });
    }

    private emit(changes: StorageChanges): void {
        if (Object.keys(changes).length === 0) return;
        for (const listener of this.listeners) listener(changes);
    }
}
