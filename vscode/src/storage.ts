// chrome.storage.local equivalent for the webviews, kept in the extension's globalState.
// 'connections' is virtual: it always reflects the sf CLI's orgs and can't be written.
// Large values (the per-org describe cache) live in files instead, see FILE_KEY_PREFIXES.

import type { StorageChanges } from '../../src/platform/protocol';
import type { FileStoreLike } from './file-store';
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
/**
 * Keys stored as files rather than in globalState. VS Code loads globalState at startup
 * and warns about large extension state; the describe cache grows with every object
 * described, per org.
 */
const FILE_KEY_PREFIXES = ['describeCache_'];

export function isFileKey(key: string): boolean {
    return FILE_KEY_PREFIXES.some(prefix => key.startsWith(prefix));
}

export class HostStorage {
    private readonly listeners = new Set<(changes: StorageChanges) => void>();

    private readonly ready: Promise<void>;

    constructor(
        private readonly memento: MementoLike,
        private readonly orgs: OrgService,
        private readonly files: FileStoreLike
    ) {
        this.ready = this.moveLargeValuesToFiles();
    }

    /** Earlier versions kept the describe cache in globalState; move it out */
    private async moveLargeValuesToFiles(): Promise<void> {
        for (const key of this.memento.keys().filter(isFileKey)) {
            try {
                await this.files.set(key, this.memento.get(key));
                await this.memento.update(key, undefined);
            } catch {
                // Leave it where it is; reads fall back to globalState
            }
        }
    }

    private async read(key: string): Promise<unknown> {
        if (!isFileKey(key)) return this.memento.get(key);
        const value = await this.files.get(key);
        return value !== undefined ? value : this.memento.get(key);
    }

    private async write(key: string, value: unknown): Promise<void> {
        if (!isFileKey(key)) {
            await this.memento.update(key, value);
            return;
        }
        await this.files.set(key, value);
        // Drop any copy the move to files couldn't take
        if (this.memento.get(key) !== undefined) await this.memento.update(key, undefined);
    }

    onChanged(listener: (changes: StorageChanges) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    async get(keys: string[] | null): Promise<Record<string, unknown>> {
        await this.ready;
        const wanted = keys ?? [
            ...new Set([...this.memento.keys(), ...(await this.files.keys()), CONNECTIONS_KEY]),
        ];
        const result: Record<string, unknown> = {};
        for (const key of wanted) {
            if (key === CONNECTIONS_KEY) {
                result[key] = await this.orgs.getConnections();
                continue;
            }
            if (IGNORED_KEYS.has(key)) continue;
            const value = await this.read(key);
            if (value !== undefined) result[key] = value;
        }
        return result;
    }

    async set(items: Record<string, unknown>): Promise<void> {
        await this.ready;
        const changes: StorageChanges = {};
        for (const [key, value] of Object.entries(items)) {
            if (IGNORED_KEYS.has(key)) continue;
            const oldValue = await this.read(key);
            await this.write(key, value);
            changes[key] = { oldValue, newValue: value };
        }
        this.emit(changes);
    }

    async remove(keys: string[]): Promise<void> {
        await this.ready;
        const changes: StorageChanges = {};
        for (const key of keys) {
            if (IGNORED_KEYS.has(key)) continue;
            const oldValue = await this.read(key);
            if (oldValue === undefined) continue;
            await this.write(key, undefined);
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
