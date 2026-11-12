// Values kept as JSON files in a folder, for data too large for VS Code's
// globalState (which VS Code loads at startup and warns about when it grows).

import { promises as fs } from 'fs';
import * as path from 'path';

/** Async key/value store; values are anything JSON can hold */
export interface FileStoreLike {
    keys(): Promise<string[]>;
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
}

const SUFFIX = '.json';

export class FileStore implements FileStoreLike {
    /** Values already read or written, so repeated reads don't hit the disk */
    private readonly cache = new Map<string, unknown>();
    /** One write at a time per key, in order */
    private readonly writes = new Map<string, Promise<void>>();

    constructor(private readonly dir: string) {}

    private fileFor(key: string): string {
        return path.join(this.dir, encodeURIComponent(key) + SUFFIX);
    }

    async keys(): Promise<string[]> {
        let names: string[];
        try {
            names = await fs.readdir(this.dir);
        } catch {
            return [];
        }
        return names
            .filter(name => name.endsWith(SUFFIX))
            .map(name => decodeURIComponent(name.slice(0, -SUFFIX.length)));
    }

    async get(key: string): Promise<unknown> {
        await this.writes.get(key);
        if (this.cache.has(key)) return this.cache.get(key);
        let value: unknown;
        try {
            value = JSON.parse(await fs.readFile(this.fileFor(key), 'utf8'));
        } catch {
            // Missing or unreadable: treat as not stored
            value = undefined;
        }
        this.cache.set(key, value);
        return value;
    }

    set(key: string, value: unknown): Promise<void> {
        if (value === undefined) return this.delete(key);
        this.cache.set(key, value);
        return this.queue(key, async () => {
            await fs.mkdir(this.dir, { recursive: true });
            // Write then rename, so a crash never leaves half a file
            const file = this.fileFor(key);
            const temp = `${file}.${process.pid}.tmp`;
            await fs.writeFile(temp, JSON.stringify(value), 'utf8');
            await fs.rename(temp, file);
        });
    }

    delete(key: string): Promise<void> {
        this.cache.set(key, undefined);
        return this.queue(key, () => fs.rm(this.fileFor(key), { force: true }));
    }

    private queue(key: string, write: () => Promise<void>): Promise<void> {
        const previous = this.writes.get(key) ?? Promise.resolve();
        const next = previous.catch(() => undefined).then(write);
        this.writes.set(key, next);
        void next
            .finally(() => {
                if (this.writes.get(key) === next) this.writes.delete(key);
            })
            .catch(() => undefined);
        return next;
    }
}
