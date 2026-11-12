// Thin wrapper around the Salesforce CLI (sf). All org auth comes from here.
// No vscode imports, so it can be unit tested with a fake exec.

import { spawn } from 'child_process';

export interface ExecResult {
    code: number;
    stdout: string;
    stderr: string;
}

/** Runs the sf CLI with arguments. Injectable for tests. */
export type SfExec = (args: string[], options?: { cwd?: string }) => Promise<ExecResult>;

export interface SfOrg {
    username: string;
    alias?: string;
    instanceUrl: string;
    orgId?: string;
    isDefault: boolean;
    isScratch: boolean;
    isSandbox: boolean;
    isDevHub: boolean;
    connectedStatus?: string;
}

export interface SfToken {
    accessToken: string;
    instanceUrl: string;
    username: string;
}

export class SfCliError extends Error {
    constructor(
        message: string,
        readonly code?: string
    ) {
        super(message);
        this.name = 'SfCliError';
    }
}

/**
 * Create an exec function that runs the sf binary.
 * @param getSfPath - returns the configured sf path (setting sftools.sfPath)
 */
export function createSfExec(getSfPath: () => string): SfExec {
    return (args, options = {}) =>
        new Promise(resolve => {
            const child = spawn(getSfPath(), args, {
                cwd: options.cwd,
                // sf is a .cmd shim on Windows, which needs a shell to run
                shell: process.platform === 'win32',
                env: {
                    ...process.env,
                    SF_AUTOUPDATE_DISABLE: 'true',
                    SF_SKIP_NEW_VERSION_CHECK: 'true',
                    SF_DISABLE_TELEMETRY: process.env.SF_DISABLE_TELEMETRY ?? 'true',
                    FORCE_COLOR: '0',
                },
                windowsHide: true,
            });
            let stdout = '';
            let stderr = '';
            child.stdout?.on('data', chunk => (stdout += chunk.toString()));
            child.stderr?.on('data', chunk => (stderr += chunk.toString()));
            child.on('error', error => {
                const err = error as NodeJS.ErrnoException;
                resolve({
                    code: -1,
                    stdout: '',
                    stderr:
                        err.code === 'ENOENT'
                            ? 'The Salesforce CLI (sf) was not found. Install it or set sftools.sfPath.'
                            : err.message,
                });
            });
            child.on('close', code => resolve({ code: code ?? -1, stdout, stderr }));
        });
}

interface SfJson<T> {
    status: number;
    result?: T;
    name?: string;
    message?: string;
}

/** Parse sf --json output; sf may print warnings before the JSON object */
export function parseSfJson<T>(output: ExecResult): T {
    const text = output.stdout.trim();
    const start = text.indexOf('{');
    if (start === -1) {
        throw new SfCliError(
            output.stderr.trim() || `sf exited with code ${output.code} and no output`
        );
    }
    let parsed: SfJson<T>;
    try {
        parsed = JSON.parse(text.substring(start)) as SfJson<T>;
    } catch {
        throw new SfCliError(output.stderr.trim() || 'Could not read sf output');
    }
    if (parsed.status !== 0 || parsed.result === undefined) {
        throw new SfCliError(
            parsed.message || `sf failed (${parsed.name ?? parsed.status})`,
            parsed.name
        );
    }
    return parsed.result;
}

interface RawOrg {
    username?: string;
    alias?: string;
    instanceUrl?: string;
    loginUrl?: string;
    orgId?: string;
    isDefaultUsername?: boolean;
    defaultMarker?: string;
    isScratch?: boolean;
    isSandbox?: boolean;
    isDevHub?: boolean;
    connectedStatus?: string;
    isExpired?: boolean;
}

interface RawOrgList {
    nonScratchOrgs?: RawOrg[];
    scratchOrgs?: RawOrg[];
    sandboxes?: RawOrg[];
    devHubs?: RawOrg[];
    other?: RawOrg[];
}

/** Flatten `sf org list --json` into unique orgs, default first then by alias/username */
export function parseOrgList(result: RawOrgList): SfOrg[] {
    const groups = [
        result.devHubs,
        result.nonScratchOrgs,
        result.sandboxes,
        result.scratchOrgs,
        result.other,
    ];
    const byUsername = new Map<string, SfOrg>();
    for (const group of groups) {
        for (const raw of group ?? []) {
            if (!raw.username || !raw.instanceUrl || raw.isExpired) continue;
            const existing = byUsername.get(raw.username);
            const org: SfOrg = {
                username: raw.username,
                alias: raw.alias || existing?.alias,
                instanceUrl: raw.instanceUrl.replace(/\/+$/, ''),
                orgId: raw.orgId,
                isDefault:
                    !!raw.isDefaultUsername ||
                    (raw.defaultMarker ?? '').includes('(U)') ||
                    !!existing?.isDefault,
                isScratch: !!raw.isScratch || !!existing?.isScratch,
                isSandbox: !!raw.isSandbox || !!existing?.isSandbox,
                isDevHub: !!raw.isDevHub || !!existing?.isDevHub,
                connectedStatus: raw.connectedStatus ?? existing?.connectedStatus,
            };
            byUsername.set(raw.username, org);
        }
    }
    return [...byUsername.values()].sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return (a.alias ?? a.username).localeCompare(b.alias ?? b.username);
    });
}

export class SfCli {
    constructor(private readonly exec: SfExec) {}

    /** All orgs the CLI knows; `cwd` decides which one is the project's default */
    async listOrgs(cwd?: string): Promise<SfOrg[]> {
        const output = await this.exec(['org', 'list', '--json', '--skip-connection-status'], {
            cwd,
        });
        return parseOrgList(parseSfJson<RawOrgList>(output));
    }

    /**
     * Get a current access token for an org. The CLI refreshes it first when needed.
     * Newer CLIs redact tokens in `org display`, so `org auth show-access-token` is tried
     * first and `org display` is the fallback for older CLIs.
     */
    async getAccessToken(username: string): Promise<SfToken> {
        const shown = await this.exec([
            'org',
            'auth',
            'show-access-token',
            '--target-org',
            username,
            '--json',
        ]);
        try {
            const result = parseSfJson<{
                accessToken?: string;
                instanceUrl?: string;
                username?: string;
            }>(shown);
            const token = extractToken(result, username);
            if (token) return token;
        } catch (error) {
            // Older CLIs don't have this command; anything else is a real failure
            if (!isUnknownCommand(shown, error)) throw error;
        }

        const display = await this.exec(['org', 'display', '--target-org', username, '--json']);
        const result = parseSfJson<{
            accessToken?: string;
            instanceUrl?: string;
            username?: string;
        }>(display);
        const token = extractToken(result, username);
        if (!token) {
            throw new SfCliError(
                `The sf CLI did not return an access token for ${username}. Update the CLI with "sf update".`
            );
        }
        return token;
    }

    /** Open a browser to log in; resolves once the CLI has stored the new org */
    async loginWeb(options: { instanceUrl?: string; alias?: string; cwd?: string }): Promise<void> {
        const args = ['org', 'login', 'web', '--json'];
        if (options.instanceUrl) args.push('--instance-url', options.instanceUrl);
        if (options.alias) args.push('--alias', options.alias);
        parseSfJson(await this.exec(args, { cwd: options.cwd }));
    }

    /** URL that signs in to the org (frontdoor) and goes to `path` */
    async getOrgOpenUrl(username: string, path?: string): Promise<string> {
        const args = ['org', 'open', '--target-org', username, '--url-only', '--json'];
        if (path) args.push('--path', path);
        const result = parseSfJson<{ url?: string }>(await this.exec(args));
        if (!result.url) throw new SfCliError('The sf CLI did not return a URL');
        return result.url;
    }
}

function extractToken(
    result: { accessToken?: string; instanceUrl?: string; username?: string },
    username: string
): SfToken | null {
    const accessToken = result.accessToken;
    if (!accessToken || accessToken.includes('REDACTED') || !result.instanceUrl) return null;
    return {
        accessToken,
        instanceUrl: result.instanceUrl.replace(/\/+$/, ''),
        username: result.username || username,
    };
}

function isUnknownCommand(output: ExecResult, error: unknown): boolean {
    const text = `${output.stdout} ${output.stderr} ${error instanceof Error ? error.message : ''}`;
    return /not a sf command|command .* not found|CommandNotFound|isn't a sf command/i.test(text);
}
