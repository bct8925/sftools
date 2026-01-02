/**
 * Native Messaging Protocol Handler
 *
 * Chrome's Native Messaging uses stdin/stdout with a specific format:
 * - Messages are prefixed with a 4-byte little-endian message length
 * - Messages are JSON encoded
 * - Max message size: 1MB (we use 800KB threshold to be safe)
 */

/**
 * Read exactly `size` bytes from stdin
 * @param {number} size - Number of bytes to read
 * @returns {Promise<Buffer>}
 */
function readBytes(size) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let bytesRead = 0;

        const onReadable = () => {
            while (bytesRead < size) {
                const remaining = size - bytesRead;
                const chunk = process.stdin.read(remaining);

                if (chunk === null) {
                    // No more data available right now, wait for more
                    return;
                }

                chunks.push(chunk);
                bytesRead += chunk.length;
            }

            // Got all bytes
            process.stdin.removeListener('readable', onReadable);
            process.stdin.removeListener('end', onEnd);
            resolve(Buffer.concat(chunks, size));
        };

        const onEnd = () => {
            process.stdin.removeListener('readable', onReadable);
            reject(new Error('stdin closed'));
        };

        process.stdin.on('readable', onReadable);
        process.stdin.once('end', onEnd);

        // Try to read immediately in case data is already available
        onReadable();
    });
}

/**
 * Read a single message from stdin
 * Format: [4-byte length (LE)][JSON message]
 * @returns {Promise<object>}
 */
async function readMessage() {
    // Read 4-byte length prefix
    const lengthBuffer = await readBytes(4);
    const messageLength = lengthBuffer.readUInt32LE(0);

    if (messageLength === 0) {
        return {};
    }

    if (messageLength > 1024 * 1024) {
        throw new Error(`Message too large: ${messageLength} bytes`);
    }

    // Read message content
    const messageBuffer = await readBytes(messageLength);
    return JSON.parse(messageBuffer.toString('utf8'));
}

/**
 * Send a message to stdout
 * Format: [4-byte length (LE)][JSON message]
 * @param {object} message - Message to send
 */
function sendMessage(message) {
    const json = JSON.stringify(message);
    const messageBuffer = Buffer.from(json, 'utf8');
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32LE(messageBuffer.length, 0);

    // Log streaming messages for debugging
    if (message.type && !message.id) {
        console.error(`[NativeMsg] Sending streaming message: type=${message.type}, subscriptionId=${message.subscriptionId}, size=${messageBuffer.length}`);
    }

    process.stdout.write(lengthBuffer);
    process.stdout.write(messageBuffer);
}

module.exports = { readMessage, sendMessage };
