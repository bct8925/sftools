// @vitest-environment node
/**
 * Tests for vscode/src/storage.ts and vscode/src/handlers.ts
 */
import { describe, it, expect, vi } from 'vitest';
import { HostStorage, type MementoLike } from '../../../vscode/src/storage';
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

const connections = [{ id: 'a@x.com', label: 'dev' }];
const orgs = {
    getConnections: vi.fn(async () => connections),
    refresh: vi.fn(async () => [{}, {}]),
    getLastError: vi.fn(() => null),
} as unknown as OrgService;

describe('HostStorage', () => {
    it('serves connections from the sf CLI and other keys from globalState', async () => {
        const storage = new HostStorage(memento({ theme: 'dark' }), orgs);
        expect(await storage.get(['connections', 'theme', 'missing'])).toEqual({
            connections,
            theme: 'dark',
        });
        expect(await storage.get(null)).toEqual({ connections, theme: 'dark' });
    });

    it('ignores writes to connections and reports other changes', async () => {
        const store = memento({ theme: 'dark' });
        const storage = new HostStorage(store, orgs);
        const listener = vi.fn();
        storage.onChanged(listener);

        await storage.set({ connections: [], theme: 'light' });
        expect(store.get('connections')).toBeUndefined();
        expect(listener).toHaveBeenCalledWith({ theme: { oldValue: 'dark', newValue: 'light' } });

        await storage.remove(['theme', 'nope']);
        expect(listener).toHaveBeenLastCalledWith({ theme: { oldValue: 'light' } });
    });

    it('does not emit for no-op changes', async () => {
        const storage = new HostStorage(memento(), orgs);
        const listener = vi.fn();
        storage.onChanged(listener);
        await storage.set({ connections: [] });
        await storage.remove(['missing']);
        expect(listener).not.toHaveBeenCalled();
    });
});

function deps(): HandlerDeps & { [K in keyof HandlerDeps]: any } {
    return {
        storage: new HostStorage(memento(), orgs),
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
