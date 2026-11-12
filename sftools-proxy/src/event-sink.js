/**
 * Event Sink
 *
 * Where streaming handlers send events (streamEvent, streamError, streamEnd).
 * The proxy sends them to Chrome over Native Messaging (the default). The VS Code
 * extension reuses these handlers in its extension host and routes events to its
 * webview panels instead, via setEventSink().
 */

let sink = null;

/**
 * Replace the destination for streaming events
 * @param {(message: object) => void} fn
 */
function setEventSink(fn) {
    sink = fn;
}

/**
 * Send a streaming event to the current sink
 * @param {object} message
 */
function emitEvent(message) {
    if (sink) {
        sink(message);
        return;
    }
    // Lazy require so hosts that set their own sink never load native messaging
    require('./native-messaging').sendMessage(message);
}

module.exports = { setEventSink, emitEvent };
