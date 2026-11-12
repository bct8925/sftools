/**
 * Tests for the VS Code webview platform (src/platform/vscode.ts) and platform selection
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    createVsCodePlatform,
    chromePlatform,
    resetPlatformForTests,
} from '../../../src/platform/index.testing';
import { getPlatform } from '../../../src/platform';

function setup(launchParams = '') {
    const posted: any[] = [];
    const target = new EventTarget();
    const api = { postMessage: (message: unknown) => posted.push(message) };
    const platform = createVsCodePlatform(api, target as unknown as Window, { launchParams });
    const deliver = (data: unknown) => target.dispatchEvent(new MessageEvent('message', { data }));
    return { platform, posted, deliver };
}

describe('createVsCodePlatform', () => {
    it('sends requests to the host and resolves with its response', async () => {
        const { platform, posted, deliver } = setup();
        const result = platform.sendMessage({ type: 'fetch', url: 'u' });
        expect(posted[0]).toEqual({ kind: 'request', id: 1, message: { type: 'fetch', url: 'u' } });
        deliver({ kind: 'response', id: 1, result: { success: true } });
        await expect(result).resolves.toEqual({ success: true });
    });

    it('rejects when the host answers with an error', async () => {
        const { platform, deliver } = setup();
        const result = platform.sendMessage({ type: 'nope' });
        deliver({ kind: 'response', id: 1, error: 'Unknown request: nope' });
        await expect(result).rejects.toThrow('Unknown request: nope');
    });

    it('delivers host events and storage changes to listeners until unsubscribed', () => {
        const { platform, deliver } = setup();
        const onMessage = vi.fn();
        const onStorage = vi.fn();
        const stop = platform.onMessage(onMessage);
        platform.storage.onChanged(onStorage);

        deliver({ kind: 'event', message: { type: 'streamEvent', subscriptionId: 's' } });
        deliver({ kind: 'storageChanged', changes: { theme: { newValue: 'dark' } } });
        stop();
        deliver({ kind: 'event', message: { type: 'streamEnd' } });
        deliver({ unrelated: true });

        expect(onMessage).toHaveBeenCalledTimes(1);
        expect(onStorage).toHaveBeenCalledWith({ theme: { newValue: 'dark' } });
    });

    it('answers host requests with the registered handler', async () => {
        const { platform, posted, deliver } = setup();
        platform.onRequest('editor:complete', async message => [{ label: String(message.docId) }]);

        deliver({
            kind: 'hostRequest',
            id: 9,
            message: { type: 'editor:complete', docId: 'Query-1' },
        });
        deliver({ kind: 'hostRequest', id: 10, message: { type: 'missing' } });
        await vi.waitFor(() => expect(posted).toHaveLength(2));

        expect(posted).toContainEqual({
            kind: 'hostResponse',
            id: 9,
            result: [{ label: 'Query-1' }],
        });
        expect(posted).toContainEqual({
            kind: 'hostResponse',
            id: 10,
            error: 'No handler for missing',
        });
    });

    it('wraps storage calls as host messages', async () => {
        const { platform, posted, deliver } = setup();
        const get = platform.storage.get('theme');
        expect(posted[0].message).toEqual({ type: 'storage:get', keys: ['theme'] });
        deliver({ kind: 'response', id: 1, result: { theme: 'dark' } });
        await expect(get).resolves.toEqual({ theme: 'dark' });

        void platform.storage.remove('theme');
        expect(posted[1].message).toEqual({ type: 'storage:remove', keys: ['theme'] });
    });

    it('reads launch params from the bootstrap and reports VS Code capabilities', () => {
        const { platform } = setup('feature=query');
        expect(platform.getLaunchParams().get('feature')).toBe('query');
        expect(platform.kind).toBe('vscode');
        expect(platform.capabilities).toEqual({
            oauth: false,
            manageConnections: false,
            nativeProxy: false,
            builtInStreaming: true,
        });
    });

    it('opens tools and records through the host', () => {
        const { platform, posted } = setup();
        platform.openFeature('apex');
        platform.openRecord({ objectType: 'Account', recordId: '001', connectionId: 'a@x.com' });
        platform.openExternal('https://a.lightning.force.com');
        expect(posted.map(p => p.message)).toEqual([
            { type: 'host:openFeature', featureId: 'apex' },
            {
                type: 'host:openRecord',
                objectType: 'Account',
                recordId: '001',
                connectionId: 'a@x.com',
            },
            { type: 'host:openExternal', url: 'https://a.lightning.force.com' },
        ]);
    });
});

describe('getPlatform', () => {
    beforeEach(() => resetPlatformForTests());
    afterEach(() => {
        delete (window as any).acquireVsCodeApi;
        delete (window as any).__SFTOOLS_VSCODE__;
        resetPlatformForTests();
    });

    it('uses Chrome outside a VS Code webview', () => {
        expect(getPlatform()).toBe(chromePlatform);
        expect(chromePlatform.capabilities.manageConnections).toBe(true);
    });

    it('uses VS Code when acquireVsCodeApi exists, acquiring the API only once', () => {
        const acquire = vi.fn(() => ({ postMessage: vi.fn() }));
        (window as any).acquireVsCodeApi = acquire;
        (window as any).__SFTOOLS_VSCODE__ = { launchParams: 'feature=logs' };
        const platform = getPlatform();
        expect(platform.kind).toBe('vscode');
        expect(getPlatform()).toBe(platform);
        expect(acquire).toHaveBeenCalledTimes(1);
        expect(platform.getLaunchParams().get('feature')).toBe('logs');
    });
});

describe('chromePlatform', () => {
    it('reads and writes chrome.storage.local', async () => {
        await chromePlatform.storage.set({ k: 1 });
        expect(await chromePlatform.storage.get(['k'])).toEqual({ k: 1 });
        await chromePlatform.storage.remove('k');
        expect(await chromePlatform.storage.get(['k'])).toEqual({});
    });

    it('has no host requests', () => {
        expect(chromePlatform.onRequest('x', () => 1)).toBeTypeOf('function');
    });
});
