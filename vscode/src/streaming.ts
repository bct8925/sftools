// Streaming (Pub/Sub API over gRPC, and CometD) in the extension host.
// Reuses the local proxy's handlers; events go to the panel that subscribed
// instead of to Chrome over Native Messaging.

import { randomUUID } from 'crypto';
import * as streamingHandlers from '../../sftools-proxy/src/handlers/streaming.js';
import * as grpcHandlers from '../../sftools-proxy/src/handlers/grpc.js';
import { setEventSink } from '../../sftools-proxy/src/event-sink.js';
import { setProtoPath } from '../../sftools-proxy/src/grpc/pubsub-client.js';
import type { HostMessage } from '../../src/platform/protocol';

interface StreamingAuth {
    accessToken: string;
    instanceUrl: string;
}

export interface StreamingDeps {
    /** Real token for the connection; null when the org is unknown */
    resolveAuth(request: {
        connectionId?: string | null;
        instanceUrl?: string;
    }): Promise<StreamingAuth | null>;
    /** Deliver an event to a panel */
    deliver(panelId: string, message: HostMessage): void;
    protoPath: string;
}

type ProxyResult = { success: boolean; error?: string; [key: string]: unknown };

export class StreamingService {
    private readonly owners = new Map<string, string>();

    constructor(private readonly deps: StreamingDeps) {
        setProtoPath(deps.protoPath);
        setEventSink((event: object) => {
            const message = event as HostMessage;
            const subscriptionId = message.subscriptionId as string | undefined;
            const panelId = subscriptionId ? this.owners.get(subscriptionId) : undefined;
            if (!panelId) return;
            deps.deliver(panelId, message);
            if (message.type === 'streamEnd') this.owners.delete(subscriptionId!);
        });
    }

    async subscribe(request: HostMessage, panelId: string): Promise<ProxyResult> {
        const auth = await this.auth(request);
        if (!auth) return { success: false, error: 'No sf CLI org for this connection' };
        const subscriptionId = randomUUID();
        this.owners.set(subscriptionId, panelId);
        const result = (await streamingHandlers.handleSubscribe({
            channel: request.channel as string,
            replayPreset: request.replayPreset as string | undefined,
            replayId: request.replayId as string | undefined,
            subscriptionId,
            ...auth,
        })) as ProxyResult;
        if (!result.success) this.owners.delete(subscriptionId);
        return { ...result, subscriptionId };
    }

    unsubscribe(request: HostMessage): ProxyResult {
        const subscriptionId = request.subscriptionId as string;
        this.owners.delete(subscriptionId);
        return streamingHandlers.handleUnsubscribe({ subscriptionId }) as ProxyResult;
    }

    async getTopic(request: HostMessage): Promise<ProxyResult> {
        const auth = await this.auth(request);
        if (!auth) return { success: false, error: 'No sf CLI org for this connection' };
        return (await grpcHandlers.handleGetTopic({
            topicName: request.topicName as string,
            tenantId: request.tenantId as string | undefined,
            ...auth,
        })) as ProxyResult;
    }

    async getSchema(request: HostMessage): Promise<ProxyResult> {
        const auth = await this.auth(request);
        if (!auth) return { success: false, error: 'No sf CLI org for this connection' };
        return (await grpcHandlers.handleGetSchema({
            schemaId: request.schemaId as string,
            tenantId: request.tenantId as string | undefined,
            ...auth,
        })) as ProxyResult;
    }

    /** Stop every subscription a closed panel owned */
    disposePanel(panelId: string): void {
        for (const [subscriptionId, owner] of [...this.owners]) {
            if (owner !== panelId) continue;
            this.owners.delete(subscriptionId);
            try {
                streamingHandlers.handleUnsubscribe({ subscriptionId });
            } catch {
                // Already gone
            }
        }
    }

    dispose(): void {
        for (const panelId of new Set(this.owners.values())) this.disposePanel(panelId);
    }

    private async auth(request: HostMessage): Promise<StreamingAuth | null> {
        try {
            return await this.deps.resolveAuth({
                connectionId: request.connectionId as string | null | undefined,
                instanceUrl: request.instanceUrl as string | undefined,
            });
        } catch {
            return null;
        }
    }
}
