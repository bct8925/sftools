/**
 * Payload Store
 *
 * In-memory storage for large payloads that exceed Native Messaging limits.
 * Payloads are stored with a TTL and deleted after retrieval (one-time use).
 */

const crypto = require('crypto');

const PAYLOAD_TTL_MS = 60000; // 60 seconds
const MAX_NATIVE_MESSAGE_SIZE = 800 * 1024; // 800KB threshold

// Map of payloadId -> { data, expiresAt, timeoutId }
const payloads = new Map();

/**
 * Store a payload and return its ID
 * @param {string} data - The payload data to store
 * @returns {string} - UUID for retrieving the payload
 */
function storePayload(data) {
    const id = crypto.randomUUID();

    const timeoutId = setTimeout(() => {
        payloads.delete(id);
    }, PAYLOAD_TTL_MS);

    payloads.set(id, {
        data,
        expiresAt: Date.now() + PAYLOAD_TTL_MS,
        timeoutId
    });

    return id;
}

/**
 * Get a payload by ID (does not delete it)
 * @param {string} id - The payload UUID
 * @returns {string|null} - The payload data or null if not found/expired
 */
function getPayload(id) {
    const entry = payloads.get(id);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
        deletePayload(id);
        return null;
    }

    return entry.data;
}

/**
 * Delete a payload by ID
 * @param {string} id - The payload UUID
 */
function deletePayload(id) {
    const entry = payloads.get(id);
    if (entry) {
        clearTimeout(entry.timeoutId);
        payloads.delete(id);
    }
}

/**
 * Check if data exceeds the Native Messaging size threshold
 * @param {string} data - The data to check
 * @returns {boolean} - True if data should use large payload handling
 */
function shouldUseLargePayload(data) {
    return Buffer.byteLength(data, 'utf8') >= MAX_NATIVE_MESSAGE_SIZE;
}

/**
 * Get the number of stored payloads (for debugging)
 * @returns {number}
 */
function getPayloadCount() {
    return payloads.size;
}

module.exports = {
    storePayload,
    getPayload,
    deletePayload,
    shouldUseLargePayload,
    getPayloadCount,
    MAX_NATIVE_MESSAGE_SIZE,
    PAYLOAD_TTL_MS
};
