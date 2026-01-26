// OAuth Credentials Helper
// Shared utility for retrieving OAuth credentials in both frontend and service worker contexts

export interface OAuthCredentials {
    clientId: string;
    isCustom: boolean;
}

interface Connection {
    id: string;
    clientId?: string | null;
}

interface OAuth2Manifest {
    client_id: string;
}

/**
 * Get OAuth credentials for a specific connection or default
 * Uses per-connection clientId if available, otherwise falls back to manifest default
 *
 * This function is context-agnostic and works in both frontend pages and service workers.
 */
export async function getOAuthCredentials(
    connectionId: string | null = null
): Promise<OAuthCredentials> {
    // Check for per-connection clientId first
    if (connectionId) {
        const { connections } = await chrome.storage.local.get(['connections']);
        const connection = (connections as Connection[] | undefined)?.find(
            c => c.id === connectionId
        );
        if (connection?.clientId) {
            return { clientId: connection.clientId, isCustom: true };
        }
    }

    // Fall back to manifest default
    const manifest = chrome.runtime.getManifest() as { oauth2: OAuth2Manifest };
    return { clientId: manifest.oauth2.client_id, isCustom: false };
}
