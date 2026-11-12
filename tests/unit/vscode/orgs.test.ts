// @vitest-environment node
/**
 * Tests for vscode/src/orgs.ts (sf CLI orgs as webview connections)
 */
import { describe, it, expect, vi } from 'vitest';
import { OrgService, myDomainKey, toWebviewConnection } from '../../../vscode/src/orgs';
import type { SfCli, SfOrg } from '../../../vscode/src/sf-cli';
import { SF_CLI_ACCESS_TOKEN } from '../../../src/platform/protocol';

function org(partial: Partial<SfOrg> & { username: string; instanceUrl: string }): SfOrg {
    return { isDefault: false, isScratch: false, isSandbox: false, isDevHub: false, ...partial };
}

function fakeCli(orgs: SfOrg[]) {
    return {
        listOrgs: vi.fn().mockResolvedValue(orgs),
        getAccessToken: vi.fn(async (username: string) => ({
            accessToken: `token-${username}-${Math.random()}`,
            instanceUrl: 'https://a.my.salesforce.com',
            username,
        })),
    } as unknown as SfCli & {
        listOrgs: ReturnType<typeof vi.fn>;
        getAccessToken: ReturnType<typeof vi.fn>;
    };
}

describe('toWebviewConnection', () => {
    it('never puts a real token in the connection', () => {
        const conn = toWebviewConnection(
            org({
                username: 'a@x.com',
                alias: 'dev',
                instanceUrl: 'https://a.my.salesforce.com',
                isDefault: true,
            })
        );
        expect(conn).toMatchObject({
            id: 'a@x.com',
            label: 'dev',
            accessToken: SF_CLI_ACCESS_TOKEN,
            isDefault: true,
            username: 'a@x.com',
            refreshToken: null,
        });
    });
});

describe('myDomainKey', () => {
    it('matches the same My Domain across Salesforce hostnames', () => {
        expect(myDomainKey('https://acme.my.salesforce.com')).toBe('acme|prod');
        expect(myDomainKey('https://acme.lightning.force.com/lightning/r/Account/001/view')).toBe(
            'acme|prod'
        );
        expect(myDomainKey('https://acme--dev.sandbox.lightning.force.com')).toBe(
            'acme--dev|sandbox'
        );
        expect(myDomainKey('https://acme--dev.sandbox.my.salesforce.com')).toBe(
            'acme--dev|sandbox'
        );
    });

    it('ignores other hosts', () => {
        expect(myDomainKey('https://example.com')).toBeNull();
        expect(myDomainKey('not a url')).toBeNull();
    });
});

describe('OrgService', () => {
    const orgs = [
        org({ username: 'a@x.com', instanceUrl: 'https://a.my.salesforce.com' }),
        org({ username: 'b@x.com', instanceUrl: 'https://a.my.salesforce.com', isDefault: true }),
    ];

    it('loads orgs once and reloads on refresh', async () => {
        const cli = fakeCli(orgs);
        const service = new OrgService(cli, () => '/w');
        await service.getOrgs();
        await service.getConnections();
        expect(cli.listOrgs).toHaveBeenCalledTimes(1);
        expect(cli.listOrgs).toHaveBeenCalledWith('/w');

        const listener = vi.fn();
        service.onDidChange(listener);
        await service.refresh();
        expect(cli.listOrgs).toHaveBeenCalledTimes(2);
        expect(listener).toHaveBeenCalledWith(orgs);
    });

    it('keeps the CLI error and returns no orgs when listing fails', async () => {
        const cli = fakeCli([]);
        cli.listOrgs.mockRejectedValue(new Error('sf was not found'));
        const service = new OrgService(cli, () => undefined);
        expect(await service.getOrgs()).toEqual([]);
        expect(service.getLastError()).toBe('sf was not found');
    });

    it('prefers the default org when several users share an instance', async () => {
        const service = new OrgService(fakeCli(orgs), () => undefined);
        expect(
            (await service.findOrgByUrl('https://a.my.salesforce.com/services/data'))?.username
        ).toBe('b@x.com');
        expect(
            (await service.findOrgForBrowserUrl('https://a.lightning.force.com/x'))?.username
        ).toBe('b@x.com');
        expect(await service.findOrg('a@x.com')).toBe(orgs[0]);
        expect(await service.findOrg(null)).toBeUndefined();
    });

    it('caches tokens until a refresh is forced', async () => {
        const cli = fakeCli(orgs);
        const service = new OrgService(cli, () => undefined);
        const first = await service.getToken('a@x.com');
        expect(await service.getToken('a@x.com')).toBe(first);
        const refreshed = await service.getToken('a@x.com', true);
        expect(refreshed).not.toBe(first);
        expect(cli.getAccessToken).toHaveBeenCalledTimes(2);
    });

    it('does not cache a failed token lookup', async () => {
        const cli = fakeCli(orgs);
        cli.getAccessToken.mockRejectedValueOnce(new Error('expired'));
        const service = new OrgService(cli, () => undefined);
        await expect(service.getToken('a@x.com')).rejects.toThrow('expired');
        await expect(service.getToken('a@x.com')).resolves.toMatchObject({ username: 'a@x.com' });
    });
});
