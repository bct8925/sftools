// Webview build for the VS Code extension (vscode/).
// Builds the same React pages as the Chrome extension, with two differences:
// - A module `foo.ts` is replaced by `foo.vscode.ts` when that file exists. This is how
//   Monaco takes its theme, syntax highlighting and completions from VS Code
//   (components/monaco-editor/editor-host.vscode.ts).
// - Only the pages a webview shows (app, record) are built; there is no background
//   worker or OAuth callback, because the extension host and the sf CLI handle those.
import { existsSync } from 'fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const isProduction = process.env.SFTOOLS_PRODUCTION === 'true';

function vscodeVariants(): Plugin {
    return {
        name: 'sftools-vscode-variants',
        enforce: 'pre',
        async resolveId(source, importer, options) {
            if (!importer || source.includes('.vscode') || source.includes('node_modules')) {
                return null;
            }
            const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
            if (!resolved || resolved.id.includes('node_modules')) return null;
            const variant = resolved.id.replace(/\.(tsx?)$/, '.vscode.$1');
            return variant !== resolved.id && existsSync(variant) ? variant : null;
        },
    };
}

export default defineConfig({
    root: 'src',
    base: './',
    plugins: [vscodeVariants(), react()],
    define: {
        __SFTOOLS_DEBUG__: !isProduction,
    },
    build: {
        outDir: '../vscode/dist/webview',
        emptyOutDir: true,
        chunkSizeWarningLimit: 5000,
        rollupOptions: {
            input: {
                app: resolve(__dirname, 'src/pages/app/app.html'),
                record: resolve(__dirname, 'src/pages/record/record.html'),
            },
            output: {
                entryFileNames: 'pages/[name]/[name].js',
                chunkFileNames: 'chunks/[name].js',
                assetFileNames: assetInfo => {
                    if (assetInfo.name?.endsWith('.css')) {
                        return '[name].[ext]';
                    }
                    return 'assets/[name].[ext]';
                },
                format: 'es',
            },
        },
    },
});
