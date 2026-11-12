// Webview build for the VS Code extension (vscode/).
// Builds the same React pages as the Chrome extension, with two differences:
// - CodeEditor resolves to NativeCodeEditor, so editing happens in native VS Code
//   documents and Monaco is not bundled.
// - Only the pages a webview shows (app, record) are built; there is no background
//   worker or OAuth callback, because the extension host and the sf CLI handle those.
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const isProduction = process.env.SFTOOLS_PRODUCTION === 'true';

function nativeCodeEditor(): Plugin {
    return {
        name: 'sftools-native-code-editor',
        enforce: 'pre',
        async resolveId(source, importer, options) {
            if (!source.includes('CodeEditor') || source.includes('NativeCodeEditor')) {
                return null;
            }
            const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
            if (resolved && /[\\/]code-editor[\\/]CodeEditor\.tsx$/.test(resolved.id)) {
                return resolved.id.replace(/CodeEditor\.tsx$/, 'NativeCodeEditor.tsx');
            }
            return null;
        },
    };
}

function assertNoMonaco(): Plugin {
    return {
        name: 'sftools-assert-no-monaco',
        generateBundle(_options, bundle) {
            for (const chunk of Object.values(bundle)) {
                if (chunk.type !== 'chunk') continue;
                const monacoModule = Object.keys(chunk.modules).find(
                    id => id.includes('node_modules/monaco-editor') || id.includes('monaco-custom')
                );
                if (monacoModule) {
                    this.error(`Monaco must not be bundled for VS Code (found ${monacoModule})`);
                }
            }
        },
    };
}

export default defineConfig({
    root: 'src',
    base: './',
    plugins: [nativeCodeEditor(), react(), assertNoMonaco()],
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
