// @vitest-environment node
/**
 * Tests for vscode/src/storage.ts and vscode/src/handlers.ts
 */
import { describe, it, expect, vi } from 'vitest';
import { HostStorage, type MementoLike } from '../../../vscode/src/storage';
import type { FileStoreLike } from '../../../vscode/src/file-store';
import { createRequestHandler, type HandlerDeps } from '../../../vscode/src/handlers';
import { buildWebviewHtml } from '../../../vscode/src/webview-html';
import type { OrgService } from '../../../vscode/src/orgs';

function memento(initial: Record<string, unknown> = {}): MementoLike {
    const data = new Map(Object.entries(initial));
    return {
        keys: () => [...data.keys()],
        get: <T>(key: string) => data.get(key) as T | undefined,
        update: async (key: string, value: unknown) => {
            if (value === undefined) data.delete(key);
            else data.set(key, value);
        },
    };
}

function fileStore(initial: Record<string, unknown> = {}): FileStoreLike & {
    data: Map<string, unknown>;
} {
    const data = new Map(Object.entries(initial));
    return {
        data,
        keys: async () => [...data.keys()],
        get: async (key: string) => data.get(key),
        set: async (key: string, value: unknown) => {
            if (value === undefined) data.delete(key);
            else data.set(key, value);
        },
        delete: async (key: string) => {
            data.delete(key);
        },
    };
}

const connections = [{ id: 'a@x.com', label: 'dev' }];
const orgs = {
    getConnections: vi.fn(async () => connections),
    refresh: vi.fn(async () => [{}, {}]),
    getLastError: vi.fn(() => null),
} as unknown as OrgService;

describe('HostStorage', () => {
    it('serves connections from the sf CLI and other keys from globalState', async () => {
        const storage = new HostStorage(memento({ theme: 'dark' }), orgs, fileStore());
        expect(await storage.get(['connections', 'theme', 'missing'])).toEqual({
            connections,
            theme: 'dark',
        });
        expect(await storage.get(null)).toEqual({ connections, theme: 'dark' });
    });

    it('ignores writes to connections and reports other changes', async () => {
        const store = memento({ theme: 'dark' });
        const storage = new HostStorage(store, orgs, fileStore());
        const listener = vi.fn();
        storage.onChanged(listener);

        await storage.set({ connections: [], theme: 'light' });
        expect(store.get('connections')).toBeUndefined();
        expect(listener).toHaveBeenCalledWith({ theme: { oldValue: 'dark', newValue: 'light' } });

        await storage.remove(['theme', 'nope']);
        expect(listener).toHaveBeenLastCalledWith({ theme: { oldValue: 'light' } });
    });

    it('keeps the describe cache in files, not globalState', async () => {
        const store = memento({ theme: 'dark' });
        const files = fileStore();
        const storage = new HostStorage(store, orgs, files);
        const listener = vi.fn();
        storage.onChanged(listener);
        const cache = { global: { sobjects: [] }, objects: {} };

        await storage.set({ 'describeCache_a@x.com': cache, theme: 'light' });
        expect(files.data.get('describeCache_a@x.com')).toEqual(cache);
        expect(store.get('describeCache_a@x.com')).toBeUndefined();
        expect(store.get('theme')).toBe('light');
        expect(await storage.get(['describeCache_a@x.com'])).toEqual({
            'describeCache_a@x.com': cache,
        });
        expect(Object.keys(await storage.get(null)).sort()).toEqual([
            'connections',
            'describeCache_a@x.com',
            'theme',
        ]);

        await storage.remove(['describeCache_a@x.com']);
        expect(files.data.has('describeCache_a@x.com')).toBe(false);
        expect(listener).toHaveBeenLastCalledWith({ 'describeCache_a@x.com': { oldValue: cache } });
    });

    it('moves a describe cache from globalState into files', async () => {
        const cache = { global: null, objects: { Account: { name: 'Account' } } };
        const store = memento({ 'describeCache_a@x.com': cache, theme: 'dark' });
        const files = fileStore();
        const storage = new HostStorage(store, orgs, files);
        expect(await storage.get(['describeCache_a@x.com'])).toEqual({
            'describeCache_a@x.com': cache,
        });
        expect(store.keys()).toEqual(['theme']);
        expect(files.data.get('describeCache_a@x.com')).toEqual(cache);
    });

    it('does not emit for no-op changes', async () => {
        const storage = new HostStorage(memento(), orgs, fileStore());
        const listener = vi.fn();
        storage.onChanged(listener);
        await storage.set({ connections: [] });
        await storage.remove(['missing']);
        expect(listener).not.toHaveBeenCalled();
    });
});

function deps(): HandlerDeps & { [K in keyof HandlerDeps]: any } {
    return {
        storage: new HostStorage(memento(), orgs, fileStore()),
        http: { fetch: vi.fn(async () => ({ success: true, status: 200 })) },
        orgs,
        streaming: {
            subscribe: vi.fn(async () => ({ success: true, subscriptionId: 's1' })),
            unsubscribe: vi.fn(() => ({ success: true })),
            getTopic: vi.fn(),
            getSchema: vi.fn(),
        },
        ui: {
            openExternal: vi.fn(async () => {}),
            openFeature: vi.fn(),
            openRecord: vi.fn(),
            saveFile: vi.fn(async () => {}),
            loginOrg: vi.fn(async () => {}),
            setDefaultOrg: vi.fn(async () => ({ scope: 'project' })),
            reload: vi.fn(),
        },
        editors: {
            getTheme: vi.fn(async () => ({ name: 'Dark+', tokenColors: [] })),
            getGrammar: vi.fn(async () => null),
            complete: vi.fn(async () => [{ label: 'Name', kind: 'field', insertText: 'Name' }]),
        },
    } as any;
}

describe('createRequestHandler', () => {
    it('reports the built-in streaming as a connected proxy', async () => {
        const handle = createRequestHandler(deps());
        expect(await handle({ type: 'checkProxyConnection' }, 'p1')).toMatchObject({
            connected: true,
        });
        expect(await handle({ type: 'connectProxy' }, 'p1')).toMatchObject({
            success: true,
            connected: true,
        });
    });

    it('routes fetch and proxyFetch to the host HTTP client', async () => {
        const d = deps();
        const handle = createRequestHandler(d);
        await handle(
            { type: 'fetch', url: 'u', options: { method: 'GET' }, connectionId: 'c' },
            'p1'
        );
        await handle(
            { type: 'proxyFetch', url: 'u', method: 'POST', body: 'b', connectionId: 'c' },
            'p1'
        );
        expect(d.http.fetch).toHaveBeenNthCalledWith(1, {
            url: 'u',
            options: { method: 'GET' },
            connectionId: 'c',
        });
        expect(d.http.fetch).toHaveBeenNthCalledWith(2, {
            url: 'u',
            options: { method: 'POST', headers: undefined, body: 'b' },
            connectionId: 'c',
        });
    });

    it('passes the panel to streaming so events go back to it', async () => {
        const d = deps();
        await createRequestHandler(d)({ type: 'subscribe', channel: '/event/X__e' }, 'p7');
        expect(d.streaming.subscribe).toHaveBeenCalledWith(
            { type: 'subscribe', channel: '/event/X__e' },
            'p7'
        );
    });

    it('routes editor theme, grammar and completion requests', async () => {
        const d = deps();
        const handle = createRequestHandler(d);
        expect(await handle({ type: 'editor:theme' }, 'p1')).toEqual({
            name: 'Dark+',
            tokenColors: [],
        });
        await handle({ type: 'editor:theme', variant: 'light' }, 'p1');
        expect(d.editors.getTheme.mock.calls).toEqual([[undefined], ['light']]);
        await handle({ type: 'editor:grammar', language: 'sql' }, 'p1');
        expect(d.editors.getGrammar).toHaveBeenCalledWith({
            language: 'sql',
            scopeName: undefined,
        });
        const request = { type: 'editor:complete', language: 'sql', text: 'SELECT ', offset: 7 };
        expect(await handle(request, 'p1')).toEqual([
            { label: 'Name', kind: 'field', insertText: 'Name' },
        ]);
        expect(d.editors.complete).toHaveBeenCalledWith(request);
    });

    it('logs in with the chosen login URL and refreshes orgs on request', async () => {
        const d = deps();
        const handle = createRequestHandler(d);
        await handle(
            { type: 'host:loginOrg', loginUrl: 'https://test.salesforce.com', alias: '' },
            'p1'
        );
        expect(d.ui.loginOrg).toHaveBeenCalledWith({
            instanceUrl: 'https://test.salesforce.com',
            alias: undefined,
        });
        expect(await handle({ type: 'host:refreshOrgs' }, 'p1')).toEqual({
            success: true,
            count: 2,
            error: null,
        });
    });

    it('opens links in the system browser only when asked', async () => {
        const d = deps();
        const handle = createRequestHandler(d);
        await handle({ type: 'host:openExternal', url: 'https://a.my.salesforce.com/001' }, 'p1');
        await handle(
            {
                type: 'host:openExternal',
                url: 'https://a.my.salesforce.com/001',
                systemBrowser: true,
            },
            'p1'
        );
        expect(d.ui.openExternal.mock.calls).toEqual([
            ['https://a.my.salesforce.com/001', false],
            ['https://a.my.salesforce.com/001', true],
        ]);
    });

    it('sets the default org and refreshes the org list', async () => {
        const d = deps();
        const refresh = vi.spyOn(d.orgs, 'refresh').mockResolvedValue([]);
        const handle = createRequestHandler(d);
        expect(await handle({ type: 'host:setDefaultOrg', username: 'a@x.com' }, 'p1')).toEqual({
            success: true,
            scope: 'project',
        });
        expect(d.ui.setDefaultOrg).toHaveBeenCalledWith('a@x.com');
        expect(refresh).toHaveBeenCalled();
        await expect(handle({ type: 'host:setDefaultOrg' }, 'p1')).rejects.toThrow();
    });

    it('rejects unknown requests', async () => {
        await expect(createRequestHandler(deps())({ type: 'nope' }, 'p1')).rejects.toThrow(
            'Unknown request'
        );
    });
});

describe('buildWebviewHtml', () => {
    const html = `<!doctype html><html><head><link rel="icon" href="../../icon.png" />
<script type="module" crossorigin src="../../pages/app/app.js"></script></head><body></body></html>`;

    it('adds base, CSP and bootstrap, and removes crossorigin and the favicon', () => {
        const out = buildWebviewHtml({
            html,
            baseUri: 'https://file+.vscode-resource/ext/dist/webview/pages/app/',
            cspSource: 'https://*.vscode-cdn.net',
            nonce: 'abc',
            bootstrap: { launchParams: 'feature=query' },
        });
        expect(out).toContain(
            '<base href="https://file+.vscode-resource/ext/dist/webview/pages/app/">'
        );
        expect(out).toContain("script-src https://*.vscode-cdn.net 'nonce-abc'");
        expect(out).toContain('window.__SFTOOLS_VSCODE__ = {"launchParams":"feature=query"}');
        expect(out).not.toContain('crossorigin');
        expect(out).not.toContain('rel="icon"');
    });

    it('cannot be broken out of by launch params', () => {
        const out = buildWebviewHtml({
            html,
            baseUri: 'x/',
            cspSource: 'y',
            nonce: 'n',
            bootstrap: { launchParams: '</script><script>alert(1)</script>' },
        });
        expect(out).not.toContain('</script><script>alert(1)');
    });
});
