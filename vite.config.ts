import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const isProduction = process.env.SFTOOLS_PRODUCTION === 'true';

export default defineConfig({
    // Use src as root so output paths are cleaner
    root: 'src',

    // Crucial for Chrome Extensions: ensures assets load from relative paths
    base: './',

    plugins: [react()],

    define: {
        __SFTOOLS_DEBUG__: !isProduction,
    },

    build: {
        // Output to dist at project root
        outDir: '../dist',
        emptyOutDir: true,
        chunkSizeWarningLimit: 5000,
        rollupOptions: {
            input: {
                // Main pages
                app: resolve(__dirname, 'src/pages/app/app.html'),
                callback: resolve(__dirname, 'src/pages/callback/callback.html'),
                record: resolve(__dirname, 'src/pages/record/record.html'),
                // Background service worker
                background: resolve(__dirname, 'src/background/background.ts'),
                // Content script (injected into Salesforce tabs for CORS bypass)
                'content-fetch': resolve(__dirname, 'src/content-script/content-fetch.ts'),
            },
            output: {
                entryFileNames: chunkInfo => {
                    // Keep background.js at root level for service worker
                    if (chunkInfo.name === 'background') {
                        return 'background.js';
                    }
                    // Keep content-fetch.js at root level for injection
                    if (chunkInfo.name === 'content-fetch') {
                        return 'content-fetch.js';
                    }
                    // Output JS files to pages/ to match HTML structure
                    return 'pages/[name]/[name].js';
                },
                chunkFileNames: 'chunks/[name].js',
                assetFileNames: assetInfo => {
                    // Keep CSS with their pages
                    if (assetInfo.name?.endsWith('.css')) {
                        return '[name].[ext]';
                    }
                    return 'assets/[name].[ext]';
                },
                manualChunks: id => {
                    // Explicitly chunk Monaco to avoid auto-generated names
                    if (id.includes('node_modules/monaco-editor')) {
                        return 'monaco';
                    }
                },
                format: 'es',
            },
        },
    },

    worker: {
        format: 'es',
    },
});
