/**
 * HTTP Server for Large Payloads
 *
 * Provides a secret-authenticated HTTP endpoint for retrieving payloads
 * that exceed Native Messaging size limits.
 *
 * Security:
 * - Binds only to 127.0.0.1 (localhost)
 * - Requires X-Proxy-Secret header matching the generated secret
 * - Secret is only shared via Native Messaging (secure channel)
 * - Payloads are one-time retrieval (deleted after fetch)
 */

const http = require('http');
const crypto = require('crypto');
const { getPayload, deletePayload } = require('./payload-store');

let server = null;
let serverPort = null;
let serverSecret = null;

/**
 * Generate a cryptographically secure secret
 * @returns {string} - 64-character hex string (32 bytes)
 */
function generateSecret() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Start the HTTP server on an OS-assigned port
 * @returns {Promise<{port: number, secret: string}>}
 */
function startServer() {
    return new Promise((resolve, reject) => {
        if (server) {
            // Already running
            resolve({ port: serverPort, secret: serverSecret });
            return;
        }

        serverSecret = generateSecret();

        server = http.createServer((req, res) => {
            // CORS headers for extension access
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', 'X-Proxy-Secret');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

            // Handle preflight
            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }

            // Only accept GET requests
            if (req.method !== 'GET') {
                res.writeHead(405, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Method not allowed' }));
                return;
            }

            // Validate secret
            const providedSecret = req.headers['x-proxy-secret'];
            if (providedSecret !== serverSecret) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid or missing secret' }));
                return;
            }

            // Extract payload ID from URL: /payload/{uuid}
            const match = req.url.match(/^\/payload\/([a-f0-9-]{36})$/);
            if (!match) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not found' }));
                return;
            }

            const payloadId = match[1];
            const payload = getPayload(payloadId);

            if (!payload) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Payload not found or expired' }));
                return;
            }

            // Return payload and delete (one-time retrieval)
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(payload);
            deletePayload(payloadId);
        });

        // Handle server errors
        server.on('error', (err) => {
            server = null;
            serverPort = null;
            serverSecret = null;
            reject(err);
        });

        // Listen on port 0 - OS assigns an available ephemeral port
        server.listen(0, '127.0.0.1', () => {
            serverPort = server.address().port;
            resolve({ port: serverPort, secret: serverSecret });
        });
    });
}

/**
 * Stop the HTTP server
 * @returns {Promise<void>}
 */
function stopServer() {
    return new Promise((resolve) => {
        if (server) {
            server.close(() => {
                server = null;
                serverPort = null;
                serverSecret = null;
                resolve();
            });
        } else {
            resolve();
        }
    });
}

/**
 * Get current server info
 * @returns {{port: number|null, secret: string|null, running: boolean}}
 */
function getServerInfo() {
    return {
        port: serverPort,
        secret: serverSecret,
        running: !!server
    };
}

module.exports = { startServer, stopServer, getServerInfo };
