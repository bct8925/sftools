// @vitest-environment node
/**
 * Tests for vscode/src/sf-cli.ts (sf CLI wrapper used for org auth)
 */
import { describe, it, expect, vi } from 'vitest';
import {
    SfCli,
    SfCliError,
    parseOrgList,
    parseSfJson,
    type ExecResult,
    type SfExec,
} from '../../../vscode/src/sf-cli';

const ok = (result: unknown): ExecResult => ({
    code: 0,
    stdout: JSON.stringify({ status: 0, result }),
    stderr: '',
});

describe('parseSfJson', () => {
    it('reads JSON that follows CLI warnings', () => {
        const output = {
            code: 0,
            stdout: 'Warning: update available\n' + JSON.stringify({ status: 0, result: { a: 1 } }),
            stderr: '',
        };
        expect(parseSfJson(output)).toEqual({ a: 1 });
    });

    it('throws the CLI error message for a failed command', () => {
        const output = {
            code: 1,
            stdout: JSON.stringify({ status: 1, name: 'NoOrgFound', message: 'No org found' }),
            stderr: '',
        };
        expect(() => parseSfJson(output)).toThrow('No org found');
    });

    it('uses stderr when there is no JSON (e.g. sf not installed)', () => {
        expect(() => parseSfJson({ code: -1, stdout: '', stderr: 'sf was not found' })).toThrow(
            'sf was not found'
        );
    });
});

describe('parseOrgList', () => {
    it('flattens groups, drops expired orgs, merges duplicates and puts the default first', () => {
        const orgs = parseOrgList({
            devHubs: [
                {
                    username: 'hub@x.com',
                    alias: 'hub',
                    instanceUrl: 'https://hub.my.salesforce.com/',
                    isDevHub: true,
                },
            ],
            nonScratchOrgs: [
                { username: 'hub@x.com', instanceUrl: 'https://hub.my.salesforce.com' },
                { username: 'b@x.com', alias: 'beta', instanceUrl: 'https://b.my.salesforce.com' },
            ],
            scratchOrgs: [
                {
                    username: 's@x.com',
                    alias: 'scratch',
                    instanceUrl: 'https://s.scratch.my.salesforce.com',
                    isScratch: true,
                    isDefaultUsername: true,
                },
                {
                    username: 'old@x.com',
                    instanceUrl: 'https://old.my.salesforce.com',
                    isExpired: true,
                },
            ],
        });

        expect(orgs.map(o => o.username)).toEqual(['s@x.com', 'b@x.com', 'hub@x.com']);
        expect(orgs[0].isDefault).toBe(true);
        const hub = orgs.find(o => o.username === 'hub@x.com')!;
        expect(hub).toMatchObject({
            alias: 'hub',
            isDevHub: true,
            instanceUrl: 'https://hub.my.salesforce.com',
        });
    });

    it('recognises the (U) default marker', () => {
        const [org] = parseOrgList({
            nonScratchOrgs: [
                {
                    username: 'a@x.com',
                    instanceUrl: 'https://a.my.salesforce.com',
                    defaultMarker: '(U)',
                },
            ],
        });
        expect(org.isDefault).toBe(true);
    });
});

describe('SfCli', () => {
    it('lists orgs in the workspace folder so the project default is marked', async () => {
        const exec = vi.fn<SfExec>().mockResolvedValue(ok({ nonScratchOrgs: [] }));
        await new SfCli(exec).listOrgs('/work/project');
        expect(exec).toHaveBeenCalledWith(['org', 'list', '--json', '--skip-connection-status'], {
            cwd: '/work/project',
        });
    });

    it('gets the token from show-access-token', async () => {
        const exec = vi.fn<SfExec>().mockResolvedValue(
            ok({
                accessToken: '00D!abc',
                instanceUrl: 'https://a.my.salesforce.com/',
                username: 'a@x.com',
            })
        );
        const token = await new SfCli(exec).getAccessToken('a@x.com');
        expect(token).toEqual({
            accessToken: '00D!abc',
            instanceUrl: 'https://a.my.salesforce.com',
            username: 'a@x.com',
        });
        expect(exec.mock.calls[0][0]).toEqual([
            'org',
            'auth',
            'show-access-token',
            '--target-org',
            'a@x.com',
            '--json',
        ]);
    });

    it('falls back to org display on CLIs without show-access-token', async () => {
        const exec = vi
            .fn<SfExec>()
            .mockResolvedValueOnce({
                code: 1,
                stdout: JSON.stringify({
                    status: 1,
                    name: 'CommandNotFound',
                    message: 'org auth show-access-token is not a sf command.',
                }),
                stderr: '',
            })
            .mockResolvedValueOnce(
                ok({ accessToken: 'tok', instanceUrl: 'https://a.my.salesforce.com' })
            );
        const token = await new SfCli(exec).getAccessToken('a@x.com');
        expect(token.accessToken).toBe('tok');
        expect(exec.mock.calls[1][0]).toEqual([
            'org',
            'display',
            '--target-org',
            'a@x.com',
            '--json',
        ]);
    });

    it('explains a redacted token instead of using it', async () => {
        const exec = vi
            .fn<SfExec>()
            .mockResolvedValueOnce({
                code: 1,
                stdout: JSON.stringify({
                    status: 1,
                    name: 'CommandNotFound',
                    message: 'is not a sf command',
                }),
                stderr: '',
            })
            .mockResolvedValueOnce(
                ok({ accessToken: '[REDACTED]', instanceUrl: 'https://a.my.salesforce.com' })
            );
        await expect(new SfCli(exec).getAccessToken('a@x.com')).rejects.toThrow('sf update');
    });

    it('passes real auth failures through without a fallback', async () => {
        const exec = vi.fn<SfExec>().mockResolvedValue({
            code: 1,
            stdout: JSON.stringify({
                status: 1,
                name: 'RefreshTokenAuthError',
                message: 'expired access/refresh token',
            }),
            stderr: '',
        });
        await expect(new SfCli(exec).getAccessToken('a@x.com')).rejects.toBeInstanceOf(SfCliError);
        expect(exec).toHaveBeenCalledTimes(1);
    });

    it('logs in on the web with instance URL and alias', async () => {
        const exec = vi.fn<SfExec>().mockResolvedValue(ok({ username: 'n@x.com' }));
        await new SfCli(exec).loginWeb({
            instanceUrl: 'https://test.salesforce.com',
            alias: 'dev',
            cwd: '/w',
        });
        expect(exec).toHaveBeenCalledWith(
            [
                'org',
                'login',
                'web',
                '--json',
                '--instance-url',
                'https://test.salesforce.com',
                '--alias',
                'dev',
            ],
            { cwd: '/w' }
        );
    });
});
