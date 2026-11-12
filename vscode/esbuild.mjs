// Bundles the extension host (src/extension.ts) into dist/extension.js.
// The streaming code and its dependencies come from ../sftools-proxy.
import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const production = process.env.SFTOOLS_PRODUCTION === 'true';

await build({
    entryPoints: [resolve(here, 'src/extension.ts')],
    outfile: resolve(here, 'dist/extension.js'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    external: ['vscode'],
    // Resolve the proxy's packages from its own node_modules
    nodePaths: [resolve(here, '../sftools-proxy/node_modules'), resolve(here, 'node_modules')],
    sourcemap: !production,
    minify: production,
    logLevel: 'info',
    define: { __SFTOOLS_DEBUG__: String(!production) },
});

// The Pub/Sub API client loads its .proto at runtime
mkdirSync(resolve(here, 'dist/proto'), { recursive: true });
copyFileSync(
    resolve(here, '../sftools-proxy/proto/pubsub_api.proto'),
    resolve(here, 'dist/proto/pubsub_api.proto')
);
