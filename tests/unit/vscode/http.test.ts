// @vitest-environment node
/**
 * Tests for vscode/src/http.ts (Salesforce requests from the extension host)
 */
import { describe, it, expect, vi } from 'vitest';
import { HostHttp, type FetchImpl } from '../../../vscode/src/http';
import type { OrgService } from '../../../vscode/src/orgs';
import type { SfOrg } from '../../../vscode/src/sf-cli';
import { SF_CLI_ACCESS_TOKEN } from '../../../src/platform/protocol';

const ORG: SfOrg = {
    username: 'a@x.com',
    instanceUrl: 'https://a.my.salesforce.com',
    isDefault: true,
    isScratch: false,
    isSandbox: false,
    isDevHub: false,
};

function fakeOrgs() {
    let n = 0;
    return {
        findOrg: vi.fn(async (id?: string | null) => (id === ORG.username ? ORG : undefined)),
        findOrgByUrl: vi.fn(async (url: string) =>
            url.startsWith(ORG.instanceUrl) ? ORG : undefined
        ),
        getToken: vi.fn(async (_username: string, force?: boolean) => {
            n++;
            return {
                accessToken: force ? `fresh-${n}` : `cached-${n}`,
                instanceUrl: ORG.instanceUrl,
                username: ORG.username,
            };
        }),
    } as unknown as OrgService & { getToken: ReturnType<typeof vi.fn> };
}

function respond(status: number, body = '{}'): Response {
    return new Response(body, { status, headers: { 'Content-Type': 'application/json' } });
}

const placeholderHeaders = {
    Authorization: `Bearer ${SF_CLI_ACCESS_TOKEN}`,
    Accept: 'application/json',
};

describe('HostHttp.fetch', () => {
    it('swaps the placeholder for the CLI token on the org instance', async () => {
        const fetchImpl = vi.fn<FetchImpl>().mockResolvedValue(respond(200, '{"ok":true}'));
        const http = new HostHttp(fakeOrgs(), fetchImpl);
        const result = await http.fetch({
            url: `${ORG.instanceUrl}/services/data/v62.0/query?q=x`,
            options: { headers: placeholderHeaders },
            connectionId: ORG.username,
        });
        expect(result).toMatchObject({ success: true, status: 200, data: '{"ok":true}' });
        expect(result.headers?.['content-type']).toBe('application/json');
        const init = fetchImpl.mock.calls[0][1];
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer cached-1');
    });

    it('never sends the placeholder or a token to another host', async () => {
        const fetchImpl = vi.fn<FetchImpl>().mockResolvedValue(respond(200));
        const orgs = fakeOrgs();
        const http = new HostHttp(orgs, fetchImpl);
        await http.fetch({
            url: 'https://evil.example.com/steal',
            options: { headers: placeholderHeaders },
            connectionId: ORG.username,
        });
        const headers = fetchImpl.mock.calls[0][1].headers as Record<string, string>;
        expect(headers.Authorization).toBeUndefined();
        expect(orgs.getToken).not.toHaveBeenCalled();
    });

    it('sends unauthenticated requests unchanged', async () => {
        const fetchImpl = vi.fn<FetchImpl>().mockResolvedValue(respond(200));
        const orgs = fakeOrgs();
        await new HostHttp(orgs, fetchImpl).fetch({ url: `${ORG.instanceUrl}/services/data/` });
        expect(orgs.getToken).not.toHaveBeenCalled();
    });

    it('serializes object bodies as JSON', async () => {
        const fetchImpl = vi.fn<FetchImpl>().mockResolvedValue(respond(201));
        await new HostHttp(fakeOrgs(), fetchImpl).fetch({
            url: `${ORG.instanceUrl}/x`,
            options: { method: 'POST', body: { Name: 'Acme' } },
        });
        expect(fetchImpl.mock.calls[0][1]).toMatchObject({
            method: 'POST',
            body: '{"Name":"Acme"}',
        });
    });

    it('refreshes the token through the CLI and retries once after a 401', async () => {
        const fetchImpl = vi
            .fn<FetchImpl>()
            .mockResolvedValueOnce(respond(401))
            .mockResolvedValueOnce(respond(200));
        const orgs = fakeOrgs();
        const result = await new HostHttp(orgs, fetchImpl).fetch({
            url: `${ORG.instanceUrl}/x`,
            options: { headers: placeholderHeaders },
            connectionId: ORG.username,
        });
        expect(result.status).toBe(200);
        expect(orgs.getToken).toHaveBeenLastCalledWith(ORG.username, true);
        expect((fetchImpl.mock.calls[1][1].headers as Record<string, string>).Authorization).toBe(
            'Bearer fresh-2'
        );
    });

    it('reports an expired session when the retry is also refused', async () => {
        const fetchImpl = vi.fn<FetchImpl>().mockImplementation(async () => respond(401));
        const result = await new HostHttp(fakeOrgs(), fetchImpl).fetch({
            url: `${ORG.instanceUrl}/x`,
            options: { headers: placeholderHeaders },
            connectionId: ORG.username,
        });
        expect(result).toMatchObject({
            success: false,
            status: 401,
            authExpired: true,
            connectionId: ORG.username,
        });
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('reports an expired session when the CLI cannot give a token', async () => {
        const orgs = fakeOrgs();
        orgs.getToken.mockRejectedValue(new Error('expired access/refresh token'));
        const fetchImpl = vi.fn<FetchImpl>();
        const result = await new HostHttp(orgs, fetchImpl).fetch({
            url: `${ORG.instanceUrl}/x`,
            options: { headers: placeholderHeaders },
            connectionId: ORG.username,
        });
        expect(result).toMatchObject({ authExpired: true, error: 'expired access/refresh token' });
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('returns status 0 for network failures', async () => {
        const fetchImpl = vi.fn<FetchImpl>().mockRejectedValue(new TypeError('fetch failed'));
        const result = await new HostHttp(fakeOrgs(), fetchImpl).fetch({
            url: `${ORG.instanceUrl}/x`,
        });
        expect(result).toMatchObject({ success: false, status: 0, error: 'fetch failed' });
    });
});

describe('HostHttp.resolveStreamingAuth', () => {
    it('finds the org by connection or instance URL', async () => {
        const http = new HostHttp(fakeOrgs(), vi.fn());
        expect(await http.resolveStreamingAuth({ connectionId: ORG.username })).toMatchObject({
            instanceUrl: ORG.instanceUrl,
        });
        expect(await http.resolveStreamingAuth({ instanceUrl: ORG.instanceUrl })).not.toBeNull();
        expect(
            await http.resolveStreamingAuth({ instanceUrl: 'https://other.example.com' })
        ).toBeNull();
    });
});
