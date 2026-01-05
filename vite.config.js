import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Use src as root so output paths are cleaner
  root: 'src',

  // Crucial for Chrome Extensions: ensures assets load from relative paths
  base: './',

  build: {
    // Output to dist at project root
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Main pages
        app: resolve(__dirname, 'src/pages/app/app.html'),
        popup: resolve(__dirname, 'src/pages/popup/popup.html'),
        callback: resolve(__dirname, 'src/pages/callback/callback.html'),
        options: resolve(__dirname, 'src/pages/options/options.html'),
        aura: resolve(__dirname, 'src/pages/aura/aura.html'),
        // Background service worker
        background: resolve(__dirname, 'src/background/background.js')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Keep background.js at root level for service worker
          if (chunkInfo.name === 'background') {
            return 'background.js';
          }
          // Output JS files to pages/ to match HTML structure
          return 'pages/[name]/[name].js';
        },
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: (assetInfo) => {
          // Keep CSS with their pages
          if (assetInfo.name?.endsWith('.css')) {
            return '[name].[ext]';
          }
          return 'assets/[name].[ext]';
        },
        format: 'es'
      }
    }
  },

  worker: {
    format: 'es'
  }
});
