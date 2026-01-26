// Salesforce REST API request wrapper

import { smartFetch, type FetchResponse } from './fetch.js';
import {
    getAccessToken,
    getInstanceUrl,
    getActiveConnectionId,
    triggerAuthExpired,
} from './auth.js';
import { isCorsError, showCorsErrorModal } from './cors-detection.js';

// --- Types ---

export interface SalesforceRequestOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    params?: Record<string, string>;
}

export interface SalesforceResponse<T = unknown> extends FetchResponse {
    json: T | null;
}

interface SalesforceErrorResponse {
    message?: string;
}

/**
 * Make an authenticated Salesforce REST API request
 * Handles URL building, headers, and error parsing
 * Uses proxy if available, falls back to extension fetch
 */
export async function salesforceRequest<T = unknown>(
    endpoint: string,
    options: SalesforceRequestOptions = {}
): Promise<SalesforceResponse<T>> {
    const url = `${getInstanceUrl()}${endpoint}`;
    const response = await smartFetch(url, {
        method: options.method || 'GET',
        headers: {
            Authorization: `Bearer ${getAccessToken()}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...options.headers,
        },
        body: options.body,
    });

    if (!response.success && response.status !== 404) {
        // Check for CORS errors first
        if (isCorsError(response)) {
            showCorsErrorModal();
            throw new Error(
                'CORS error - please configure CORS settings or enable the local proxy'
            );
        }

        // Check for 401 Unauthorized (session expired)
        if (response.status === 401 && !response.authExpired) {
            // Trigger auth expiration flow (proxy requests don't set authExpired flag)
            const connectionId = getActiveConnectionId();
            triggerAuthExpired(connectionId || undefined, 'Session expired');
        }

        // Use response.error if available (e.g., from auth expiration), otherwise parse response data
        if (response.error) {
            throw new Error(response.error);
        }
        let error: SalesforceErrorResponse | SalesforceErrorResponse[] = {
            message: response.statusText,
        };
        if (response.data) {
            try {
                error = JSON.parse(response.data) as
                    | SalesforceErrorResponse
                    | SalesforceErrorResponse[];
            } catch {
                // Response data isn't valid JSON (e.g., HTML maintenance page)
                error = { message: response.data.substring(0, 200) };
            }
        }
        const errorMessage = Array.isArray(error) ? error[0]?.message : error.message;
        throw new Error(errorMessage || 'Request failed');
    }

    return {
        ...response,
        json: response.data ? (JSON.parse(response.data) as T) : null,
    };
}
