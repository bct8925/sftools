// Global test setup for Vitest
// Installs Chrome mock and resets state between tests

import { chromeMock } from './mocks/chrome.js';

// Install Chrome mock globally before all tests
globalThis.chrome = chromeMock;

// Also mock crypto.randomUUID for connection ID generation
if (!globalThis.crypto) {
    globalThis.crypto = {};
}
if (!globalThis.crypto.randomUUID) {
    let counter = 0;
    globalThis.crypto.randomUUID = () => `test-uuid-${++counter}`;
}

// Reset all mocks between tests
beforeEach(() => {
    chromeMock._reset();
    // Reset UUID counter for predictable IDs
    let counter = 0;
    globalThis.crypto.randomUUID = () => `test-uuid-${++counter}`;
});
