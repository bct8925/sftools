// Orgs from the sf CLI, presented to the webview as sftools connections.
// Access tokens stay here in the extension host and never reach the webview.

import { SF_CLI_ACCESS_TOKEN } from '../../src/platform/protocol';
import type { SfCli, SfOrg, SfToken } from './sf-cli';

/** The connection shape the webview expects (see src/types/salesforce.d.ts) */
export interface WebviewConnection {
    id: string;
    label: string;
    instanceUrl: string;
    loginDomain: string;
    accessToken: string;
    refreshToken: null;
    clientId: null;
    createdAt: number;
    lastUsedAt: number;
    isDefault: boolean;
    username: string;
}

export function toWebviewConnection(org: SfOrg): WebviewConnection {
    return {
        id: org.username,
        label: org.alias ? `${org.alias}` : org.username,
        instanceUrl: org.instanceUrl,
        loginDomain: org.instanceUrl,
        accessToken: SF_CLI_ACCESS_TOKEN,
        refreshToken: null,
        clientId: null,
        createdAt: 0,
        lastUsedAt: 0,
        isDefault: org.isDefault,
        username: org.username,
    };
}

export class OrgService {
    private orgs: SfOrg[] = [];
    private loaded: Promise<SfOrg[]> | null = null;
    private readonly tokens = new Map<string, Promise<SfToken>>();
    private readonly listeners = new Set<(orgs: SfOrg[]) => void>();
    private lastError: string | null = null;

    constructor(
        private readonly cli: SfCli,
        private readonly getCwd: () => string | undefined
    ) {}

    /** Orgs, loading them from the CLI the first time */
    async getOrgs(): Promise<SfOrg[]> {
        if (!this.loaded) this.loaded = this.load();
        return this.loaded;
    }

    /** Error from the last CLI load, if it failed */
    getLastError(): string | null {
        return this.lastError;
    }

    async refresh(): Promise<SfOrg[]> {
        this.loaded = this.load();
        this.tokens.clear();
        const orgs = await this.loaded;
        for (const listener of this.listeners) listener(orgs);
        return orgs;
    }

    onDidChange(listener: (orgs: SfOrg[]) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    async getConnections(): Promise<WebviewConnection[]> {
        return (await this.getOrgs()).map(toWebviewConnection);
    }

    async findOrg(connectionId: string | null | undefined): Promise<SfOrg | undefined> {
        if (!connectionId) return undefined;
        return (await this.getOrgs()).find(o => o.username === connectionId);
    }

    /** First org whose instance matches the URL's origin (for requests without a connectionId) */
    async findOrgByUrl(url: string): Promise<SfOrg | undefined> {
        let origin: string;
        try {
            origin = new URL(url).origin.toLowerCase();
        } catch {
            return undefined;
        }
        const orgs = await this.getOrgs();
        return (
            orgs.find(o => o.isDefault && o.instanceUrl.toLowerCase() === origin) ??
            orgs.find(o => o.instanceUrl.toLowerCase() === origin)
        );
    }

    /**
     * Org a browser URL belongs to, matching My Domain across its Salesforce hostnames
     * (e.g. acme.my.salesforce.com and acme.lightning.force.com).
     */
    async findOrgForBrowserUrl(url: string): Promise<SfOrg | undefined> {
        const key = myDomainKey(url);
        if (!key) return undefined;
        const orgs = await this.getOrgs();
        const matches = orgs.filter(o => myDomainKey(o.instanceUrl) === key);
        return matches.find(o => o.isDefault) ?? matches[0];
    }

    /** Cached access token for an org; `forceRefresh` asks the CLI again (after a 401) */
    getToken(username: string, forceRefresh = false): Promise<SfToken> {
        if (forceRefresh) this.tokens.delete(username);
        let token = this.tokens.get(username);
        if (!token) {
            // show-access-token gives only the token; the org list has the instance URL
            token = this.getOrgs().then(orgs =>
                this.cli.getAccessToken(
                    username,
                    orgs.find(o => o.username === username)?.instanceUrl
                )
            );
            this.tokens.set(username, token);
            // Don't cache failures
            token.catch(() => {
                if (this.tokens.get(username) === token) this.tokens.delete(username);
            });
        }
        return token;
    }

    private async load(): Promise<SfOrg[]> {
        try {
            this.orgs = await this.cli.listOrgs(this.getCwd());
            this.lastError = null;
        } catch (error) {
            this.lastError = error instanceof Error ? error.message : String(error);
            this.orgs = [];
        }
        return this.orgs;
    }
}

const SALESFORCE_SUFFIXES = [
    '.sandbox.my.salesforce.com',
    '.develop.my.salesforce.com',
    '.scratch.my.salesforce.com',
    '.my.salesforce.com',
    '.sandbox.lightning.force.com',
    '.develop.lightning.force.com',
    '.scratch.lightning.force.com',
    '.lightning.force.com',
    '.sandbox.my.salesforce-setup.com',
    '.my.salesforce-setup.com',
];

/** "acme--dev|sandbox" for https://acme--dev.sandbox.lightning.force.com, or null */
export function myDomainKey(url: string): string | null {
    let host: string;
    try {
        host = new URL(url).hostname.toLowerCase();
    } catch {
        return null;
    }
    for (const suffix of SALESFORCE_SUFFIXES) {
        if (host.endsWith(suffix)) {
            const kind = suffix.split('.')[1];
            const variant = ['sandbox', 'develop', 'scratch'].includes(kind) ? kind : 'prod';
            return `${host.slice(0, -suffix.length)}|${variant}`;
        }
    }
    return null;
}
