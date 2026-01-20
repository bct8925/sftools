/**
 * Tests for sftools-proxy/src/http-server.js
 *
 * Test IDs: HS-U-001, HS-U-002
 * - HS-U-001: generateSecret() - Returns 64-char hex (tested indirectly via startServer)
 * - HS-U-002: startServer() - Reuses existing (test getServerInfo returns same values)
 *
 * These tests verify server management behavior with actual network operations
 * since the module has stateful server management that requires real server instances.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { startServer, stopServer, getServerInfo } from '../../../sftools-proxy/src/http-server.js';

describe('http-server', () => {
    afterEach(async () => {
        // Clean up server after each test
        await stopServer();
    });

    describe('startServer', () => {
        it('starts server and returns port and secret', async () => {
            const result = await startServer();

            expect(result).toHaveProperty('port');
            expect(result).toHaveProperty('secret');
            expect(typeof result.port).toBe('number');
            expect(typeof result.secret).toBe('string');
            expect(result.port).toBeGreaterThan(0);
        });

        it('generates 64-character hex secret', async () => {
            const result = await startServer();

            // HS-U-001: Secret should be 64-char hex (32 bytes)
            expect(result.secret).toMatch(/^[a-f0-9]{64}$/);
        });

        it('reuses existing server on multiple calls', async () => {
            // HS-U-002: Multiple startServer() calls should return same port/secret
            const first = await startServer();
            const second = await startServer();

            expect(second.port).toBe(first.port);
            expect(second.secret).toBe(first.secret);
        });

        it('uses port 0 for OS-assigned ephemeral port', async () => {
            const result = await startServer();

            // Ephemeral ports are typically in range 32768-65535
            expect(result.port).toBeGreaterThanOrEqual(1024);
            expect(result.port).toBeLessThanOrEqual(65535);
        });
    });

    describe('getServerInfo', () => {
        it('returns null values when server is not running', () => {
            const info = getServerInfo();

            expect(info.port).toBeNull();
            expect(info.secret).toBeNull();
            expect(info.running).toBe(false);
        });

        it('returns correct info when server is running', async () => {
            const startResult = await startServer();
            const info = getServerInfo();

            expect(info.port).toBe(startResult.port);
            expect(info.secret).toBe(startResult.secret);
            expect(info.running).toBe(true);
        });

        it('reflects server state after stop', async () => {
            await startServer();
            await stopServer();

            const info = getServerInfo();
            expect(info.port).toBeNull();
            expect(info.secret).toBeNull();
            expect(info.running).toBe(false);
        });
    });

    describe('stopServer', () => {
        it('stops running server and cleans up state', async () => {
            await startServer();
            expect(getServerInfo().running).toBe(true);

            await stopServer();

            const info = getServerInfo();
            expect(info.port).toBeNull();
            expect(info.secret).toBeNull();
            expect(info.running).toBe(false);
        });

        it('handles stop when server is not running', async () => {
            // Should not throw error
            await expect(stopServer()).resolves.toBeUndefined();

            const info = getServerInfo();
            expect(info.running).toBe(false);
        });

        it('allows server to be restarted after stop', async () => {
            const first = await startServer();
            await stopServer();

            const second = await startServer();

            // New server should have different secret
            expect(second.secret).not.toBe(first.secret);
            expect(second.port).toBeGreaterThan(0);
        });
    });

    describe('server lifecycle', () => {
        it('maintains consistent state across getServerInfo calls', async () => {
            const startResult = await startServer();

            const info1 = getServerInfo();
            const info2 = getServerInfo();

            expect(info1.port).toBe(info2.port);
            expect(info1.secret).toBe(info2.secret);
            expect(info1.running).toBe(info2.running);
            expect(info1.port).toBe(startResult.port);
            expect(info1.secret).toBe(startResult.secret);
        });

        it('handles rapid start/stop cycles', async () => {
            await startServer();
            await stopServer();
            await startServer();
            await stopServer();
            await startServer();

            const info = getServerInfo();
            expect(info.running).toBe(true);
        });
    });
});
