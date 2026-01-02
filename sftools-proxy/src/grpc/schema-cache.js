/**
 * Avro Schema Cache
 *
 * Caches and decodes Avro schemas for Salesforce Platform Events.
 * Salesforce Pub/Sub API returns events with Avro-encoded payloads.
 */

const avro = require('avsc');
const { getSchema } = require('./pubsub-client');

// Schema cache: schemaId -> avro.Type
const schemaCache = new Map();

/**
 * Get or fetch a schema by ID
 * @param {string} schemaId - Schema ID
 * @param {string} accessToken - Salesforce access token
 * @param {string} instanceUrl - Salesforce instance URL
 * @param {string} [tenantId] - Optional tenant ID
 * @returns {Promise<avro.Type>}
 */
async function getOrFetchSchema(schemaId, accessToken, instanceUrl, tenantId) {
    // Check cache first
    if (schemaCache.has(schemaId)) {
        console.error(`[Schema] Cache hit for schema ${schemaId}`);
        return schemaCache.get(schemaId);
    }

    console.error(`[Schema] Fetching schema ${schemaId} from Salesforce...`);
    // Fetch schema from Salesforce
    const schemaInfo = await getSchema(accessToken, instanceUrl, schemaId, tenantId);
    console.error(`[Schema] Received schema, parsing Avro...`);

    // Parse the Avro schema
    const schema = avro.Type.forSchema(JSON.parse(schemaInfo.schema_json));

    // Cache it
    schemaCache.set(schemaId, schema);
    console.error(`[Schema] Schema cached, cache size: ${schemaCache.size}`);

    return schema;
}

/**
 * Decode an Avro-encoded payload
 * @param {avro.Type} schema - Avro schema type
 * @param {Buffer|Uint8Array} payload - Encoded payload
 * @returns {object} - Decoded payload
 */
function decodePayload(schema, payload) {
    const buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    return schema.fromBuffer(buffer);
}

/**
 * Decode a consumer event's payload using its schema
 * @param {object} consumerEvent - Consumer event from Pub/Sub API
 * @param {string} accessToken - Salesforce access token
 * @param {string} instanceUrl - Salesforce instance URL
 * @param {string} [tenantId] - Optional tenant ID
 * @returns {Promise<object>} - Event with decoded payload
 */
async function decodeConsumerEvent(consumerEvent, accessToken, instanceUrl, tenantId) {
    console.error(`[Schema] decodeConsumerEvent called`);
    const { event, replay_id } = consumerEvent;

    if (!event || !event.schema_id || !event.payload) {
        console.error(`[Schema] Missing event data: event=${!!event}, schema=${event?.schema_id}, payload=${!!event?.payload}`);
        return {
            replayId: replay_id ? Buffer.from(replay_id).toString('base64') : null,
            schemaId: event?.schema_id,
            payload: null,
            error: 'Missing event data'
        };
    }

    console.error(`[Schema] Decoding event with schema ${event.schema_id}, payload size: ${event.payload?.length || 0}`);

    try {
        // Get or fetch the schema
        const schema = await getOrFetchSchema(
            event.schema_id,
            accessToken,
            instanceUrl,
            tenantId
        );

        // Decode the payload
        const decodedPayload = decodePayload(schema, event.payload);
        console.error(`[Schema] Payload decoded successfully`);

        return {
            id: event.id,
            replayId: replay_id ? Buffer.from(replay_id).toString('base64') : null,
            schemaId: event.schema_id,
            payload: decodedPayload
        };
    } catch (error) {
        console.error(`[Schema] Decode error: ${error.message}`);
        return {
            id: event.id,
            replayId: replay_id ? Buffer.from(replay_id).toString('base64') : null,
            schemaId: event.schema_id,
            payload: null,
            error: error.message
        };
    }
}

/**
 * Encode a payload using a schema
 * @param {avro.Type} schema - Avro schema type
 * @param {object} payload - Payload to encode
 * @returns {Buffer} - Encoded payload
 */
function encodePayload(schema, payload) {
    return schema.toBuffer(payload);
}

/**
 * Clear the schema cache
 */
function clearCache() {
    schemaCache.clear();
}

/**
 * Get cache size
 * @returns {number}
 */
function getCacheSize() {
    return schemaCache.size;
}

module.exports = {
    getOrFetchSchema,
    decodePayload,
    decodeConsumerEvent,
    encodePayload,
    clearCache,
    getCacheSize,
    schemaCache
};
