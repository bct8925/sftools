/**
 * Vitest Global Setup — runs once before all test files.
 *
 * Starts the Vite dev server and a Playwright browser server so that
 * individual test files (via setup.ts) can connect without paying the
 * startup cost each time.
 */

import { chromium, BrowserServer } from 'playwright';
import { spawn, ChildProcess } from 'child_process';

let viteProcess: ChildProcess | null = null;
let browserServer: BrowserServer | null = null;

const VITE_PORT = parseInt(process.env.VITE_PORT || '5174');

function startViteServer(): Promise<void> {
    console.log(`Starting Vite dev server on port ${VITE_PORT}...`);

    return new Promise((resolve, reject) => {
        viteProcess = spawn('npx', ['vite', 'dev', '--port', String(VITE_PORT)], {
            cwd: process.cwd(),
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: true,
        });

        let serverReady = false;

        const handleOutput = (data: Buffer) => {
            const output = data.toString();
            if (!serverReady && (output.includes('ready in') || output.includes('Local:'))) {
                serverReady = true;
                console.log('Vite dev server ready');
                resolve();
            }
        };

        viteProcess.stdout?.on('data', handleOutput);
        viteProcess.stderr?.on('data', handleOutput);

        viteProcess.on('error', err => {
            reject(new Error(`Failed to start Vite server: ${err.message}`));
        });

        viteProcess.on('exit', code => {
            if (!serverReady) {
                reject(new Error(`Vite server exited unexpectedly with code ${code}`));
            }
        });

        setTimeout(() => {
            if (!serverReady) {
                stopViteServer();
                reject(new Error('Vite server startup timed out after 30 seconds'));
            }
        }, 30000);
    });
}

function stopViteServer(): void {
    if (viteProcess) {
        console.log('Stopping Vite server...');
        viteProcess.kill('SIGTERM');
        viteProcess = null;
    }
}

export async function setup() {
    await startViteServer();

    browserServer = await chromium.launchServer({
        headless: true,
        args: [
            '--no-first-run',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-background-timer-throttling',
            '--disable-hang-monitor',
            '--disable-popup-blocking',
            '--disable-prompt-on-repost',
            '--disable-sync',
            '--no-default-browser-check',
        ],
    });

    // Expose to worker processes via env vars
    process.env.BROWSER_WS_ENDPOINT = browserServer.wsEndpoint();
    process.env.VITE_BASE_URL = `http://localhost:${VITE_PORT}`;

    console.log('Browser server ready');
}

export async function teardown() {
    if (browserServer) {
        await browserServer.close();
        browserServer = null;
    }
    stopViteServer();
}
