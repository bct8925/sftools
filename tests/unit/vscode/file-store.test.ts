// @vitest-environment node
/**
 * Tests for vscode/src/file-store.ts (JSON files for large storage values)
 */
import { mkdtemp, readdir, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileStore } from '../../../vscode/src/file-store';

describe('FileStore', () => {
    let root: string;
    let dir: string;

    beforeEach(async () => {
        root = await mkdtemp(path.join(tmpdir(), 'sftools-files-'));
        dir = path.join(root, 'storage');
    });
    afterEach(() => rm(root, { recursive: true, force: true }));

    it('reads nothing from a folder that does not exist yet', async () => {
        const store = new FileStore(dir);
        expect(await store.keys()).toEqual([]);
        expect(await store.get('describeCache_a@x.com')).toBeUndefined();
    });

    it('writes JSON files that a new store reads back', async () => {
        const cache = { global: null, objects: { Account: { fields: [{ name: 'Id' }] } } };
        await new FileStore(dir).set('describeCache_a@x.com', cache);

        const files = await readdir(dir);
        expect(files).toEqual([`${encodeURIComponent('describeCache_a@x.com')}.json`]);
        expect(JSON.parse(await readFile(path.join(dir, files[0]), 'utf8'))).toEqual(cache);

        const fresh = new FileStore(dir);
        expect(await fresh.keys()).toEqual(['describeCache_a@x.com']);
        expect(await fresh.get('describeCache_a@x.com')).toEqual(cache);
    });

    it('keeps keys with path characters inside the folder', async () => {
        const store = new FileStore(dir);
        await store.set('describeCache_../../evil', { x: 1 });
        expect(await readdir(root)).toEqual(['storage']);
        expect(await store.keys()).toEqual(['describeCache_../../evil']);
    });

    it('applies writes in order and deletes', async () => {
        const store = new FileStore(dir);
        const writes = [1, 2, 3].map(n => store.set('k', { n }));
        await Promise.all(writes);
        expect(await new FileStore(dir).get('k')).toEqual({ n: 3 });

        await store.delete('k');
        expect(await store.get('k')).toBeUndefined();
        expect(await readdir(dir)).toEqual([]);
        // Setting undefined deletes too, and deleting twice is fine
        await store.set('j', { a: 1 });
        await store.set('j', undefined);
        await store.delete('j');
        expect(await new FileStore(dir).keys()).toEqual([]);
    });
});
