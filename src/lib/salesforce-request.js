// Salesforce REST API request wrapper

import { smartFetch } from './fetch.js';
import {
    getAccessToken,
    getInstanceUrl,
    getActiveConnectionId,
    triggerAuthExpired,
} from './auth.js';
import { isCorsError, showCorsErrorModal } from './cors-detection.js';

/**
 * Make an authenticated Salesforce REST API request
 * Handles URL building, headers, and error parsing
 * Uses proxy if available, falls back to extension fetch
 */
export async function salesforceRequest(endpoint, options = {}) {
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
            triggerAuthExpired(connectionId, 'Session expired');
        }

        // Use response.error if available (e.g., from auth expiration), otherwise parse response data
        if (response.error) {
            throw new Error(response.error);
        }
        let error = { message: response.statusText };
        if (response.data) {
            try {
                error = JSON.parse(response.data);
            } catch {
                // Response data isn't valid JSON (e.g., HTML maintenance page)
                error = { message: response.data.substring(0, 200) };
            }
        }
        throw new Error(error[0]?.message || error.message || 'Request failed');
    }

    return {
        ...response,
        json: response.data ? JSON.parse(response.data) : null,
    };
}
