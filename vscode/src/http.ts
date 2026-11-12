// Salesforce requests from the extension host. No browser, so no CORS.
// The webview sends a placeholder token; the real one from the sf CLI is added here.

import { SF_CLI_ACCESS_TOKEN } from '../../src/platform/protocol';
import type { OrgService } from './orgs';
import type { SfOrg } from './sf-cli';

export interface FetchRequest {
    url: string;
    options?: { method?: string; headers?: Record<string, string>; body?: unknown };
    connectionId?: string | null;
}

export interface FetchResponse {
    success: boolean;
    status: number;
    statusText?: string;
    headers?: Record<string, string>;
    data?: string;
    error?: string;
    authExpired?: boolean;
    connectionId?: string;
}

export type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

function getAuthHeaderName(headers: Record<string, string>): string | undefined {
    return Object.keys(headers).find(k => k.toLowerCase() === 'authorization');
}

function sameOrigin(url: string, instanceUrl: string): boolean {
    try {
        return new URL(url).origin.toLowerCase() === new URL(instanceUrl).origin.toLowerCase();
    } catch {
        return false;
    }
}

function serializeBody(body: unknown): BodyInit | undefined {
    if (body === undefined || body === null) return undefined;
    if (typeof body === 'string') return body;
    return JSON.stringify(body);
}

export class HostHttp {
    constructor(
        private readonly orgs: OrgService,
        private readonly fetchImpl: FetchImpl = (url, init) => fetch(url, init)
    ) {}

    async fetch(request: FetchRequest): Promise<FetchResponse> {
        const headers: Record<string, string> = { ...(request.options?.headers ?? {}) };
        const method = request.options?.method ?? 'GET';
        const body = serializeBody(request.options?.body);
        const authHeader = getAuthHeaderName(headers);

        // Only requests that the webview meant to authenticate get a token
        let org: SfOrg | undefined;
        if (authHeader) {
            org =
                (await this.orgs.findOrg(request.connectionId)) ??
                (await this.orgs.findOrgByUrl(request.url));
            const usesPlaceholder = headers[authHeader].includes(SF_CLI_ACCESS_TOKEN);
            if (!org || !sameOrigin(request.url, org.instanceUrl)) {
                // Never send the placeholder anywhere; a real token typed by the user is left alone
                if (usesPlaceholder) delete headers[authHeader];
                org = undefined;
            }
        }

        const send = async (token?: string): Promise<FetchResponse> => {
            const finalHeaders = { ...headers };
            if (token && authHeader) finalHeaders[authHeader] = `Bearer ${token}`;
            try {
                const response = await this.fetchImpl(request.url, {
                    method,
                    headers: finalHeaders,
                    body,
                });
                const responseHeaders: Record<string, string> = {};
                response.headers.forEach((value, key) => {
                    responseHeaders[key.toLowerCase()] = value;
                });
                return {
                    success: response.ok,
                    status: response.status,
                    statusText: response.statusText,
                    headers: responseHeaders,
                    data: await response.text(),
                };
            } catch (error) {
                return {
                    success: false,
                    status: 0,
                    error: error instanceof Error ? describeNetworkError(error) : String(error),
                };
            }
        };

        if (!org) return send();

        const expired = (error: string): FetchResponse => ({
            success: false,
            status: 401,
            statusText: 'Unauthorized',
            authExpired: true,
            connectionId: org!.username,
            error,
        });

        let token: string;
        try {
            token = (await this.orgs.getToken(org.username)).accessToken;
        } catch (error) {
            return expired(error instanceof Error ? error.message : String(error));
        }

        const first = await send(token);
        if (first.status !== 401) return first;

        // The CLI refreshes the token when asked again
        try {
            token = (await this.orgs.getToken(org.username, true)).accessToken;
        } catch (error) {
            return expired(error instanceof Error ? error.message : String(error));
        }
        const retry = await send(token);
        if (retry.status !== 401) return retry;
        return expired(
            `Session expired for ${org.username}. Log in again with "sf org login web".`
        );
    }

    /** Resolve the real token for streaming requests, which carry the token in the body */
    async resolveStreamingAuth(request: {
        connectionId?: string | null;
        instanceUrl?: string;
    }): Promise<{ accessToken: string; instanceUrl: string } | null> {
        const org =
            (await this.orgs.findOrg(request.connectionId)) ??
            (request.instanceUrl ? await this.orgs.findOrgByUrl(request.instanceUrl) : undefined);
        if (!org) return null;
        const token = await this.orgs.getToken(org.username);
        return { accessToken: token.accessToken, instanceUrl: token.instanceUrl };
    }
}

function describeNetworkError(error: Error): string {
    const cause = (error as Error & { cause?: { code?: string; message?: string } }).cause;
    if (cause?.message) return `${error.message}: ${cause.message}`;
    return error.message;
}
