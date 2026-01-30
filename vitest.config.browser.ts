import { defineConfig } from 'vitest/config';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';

// Plugin to resolve .js imports to .ts files during incremental migration
function jsToTsResolver() {
    return {
        name: 'js-to-ts-resolver',
        resolveId(source: string, importer: string | undefined) {
            if (!importer || !source.endsWith('.js')) return null;

            // Try to resolve .ts file instead of .js
            const tsSource = source.replace(/\.js$/, '.ts');
            const importerDir = dirname(importer);
            const tsPath = resolve(importerDir, tsSource);

            if (existsSync(tsPath)) {
                return tsPath;
            }
            return null;
        },
    };
}

export default defineConfig({
    plugins: [jsToTsResolver()],
    define: {
        __SFTOOLS_DEBUG__: false,
    },
    resolve: {
        extensions: ['.ts', '.js', '.tsx', '.jsx', '.json'],
    },
    test: {
        globals: true,
        environment: 'node', // Orchestration in Node, browser via Playwright
        include: ['tests/browser/**/*.test.ts'],
        globalSetup: ['tests/browser/global-setup.ts'],
        setupFiles: ['tests/browser/setup.ts'],
        testTimeout: 60000,
        hookTimeout: 30000,
        pool: 'forks',
        poolOptions: {
            forks: { singleFork: true }, // Sequential for browser resource management
        },
    },
});
