// Streaming support per connection
// Salesforce's Pub/Sub API (gRPC) and Streaming API (CometD) don't accept DPoP-bound
// tokens: tested against an org whose app requires DPoP, every Pub/Sub metadata shape
// came back UNAUTHENTICATED and CometD treated "Authorization: DPoP" as no credentials,
// while REST accepted the same token. Until Salesforce supports DPoP there, streaming
// is off for DPoP connections; features that can fall back to REST polling do.

import type { SalesforceConnection } from '../types/salesforce';

export const DPOP_STREAMING_UNSUPPORTED =
    "Streaming isn't available for DPoP sessions, which Salesforce's streaming APIs don't accept yet. To stream, edit this connection in Settings and set Session type to Bearer (if its app allows it).";

/** How often features that would use streaming poll over REST instead */
export const STREAMING_FALLBACK_POLL_MS = 10_000;

/** True when the connection's token can be used with the streaming APIs */
export function supportsStreaming(
    connection: Pick<SalesforceConnection, 'tokenType'> | null | undefined
): boolean {
    return connection?.tokenType !== 'DPoP';
}
