// Turns a page from the vite webview build into HTML a VS Code webview can load.

import type { VsCodeBootstrap } from '../../src/platform/protocol';

/** Wraps HTML from the vite webview build so it runs inside a VS Code webview */
export function buildWebviewHtml(options: {
    html: string;
    baseUri: string;
    cspSource: string;
    nonce: string;
    bootstrap: VsCodeBootstrap;
}): string {
    const { baseUri, cspSource, nonce, bootstrap } = options;
    const csp = [
        "default-src 'none'",
        // wasm-unsafe-eval: the TextMate tokenizer (vscode-oniguruma) is WebAssembly
        `script-src ${cspSource} 'nonce-${nonce}' 'wasm-unsafe-eval'`,
        `style-src ${cspSource} 'unsafe-inline'`,
        `img-src ${cspSource} https: data:`,
        `font-src ${cspSource} data:`,
        `connect-src ${cspSource}`,
        `worker-src ${cspSource} blob:`,
    ].join('; ');
    // Escape "<" so the JSON can't close the script element
    const bootstrapJson = JSON.stringify(bootstrap).replace(/</g, '\\u003c');
    const head = [
        `<base href="${baseUri}">`,
        `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
        `<script nonce="${nonce}">window.__SFTOOLS_VSCODE__ = ${bootstrapJson};</script>`,
    ].join('\n        ');
    return options.html
        .replace(/\s+crossorigin(="[^"]*")?/g, '')
        .replace(/<link rel="icon"[^>]*>\s*/g, '')
        .replace(/<head>/i, `<head>\n        ${head}`);
}
