import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup.html'),
        main: resolve(__dirname, 'src/main.html'),
        callback: resolve(__dirname, 'src/callback.html'),
        app: resolve(__dirname, 'src/app.html'),
        'salesfaux-app': resolve(__dirname, 'src/salesfaux-app.js'),
        'popup-script': resolve(__dirname, 'src/popup.js'),
        'main-script': resolve(__dirname, 'src/main.js'),
        'callback-script': resolve(__dirname, 'src/callback.js'),
        background: resolve(__dirname, 'src/background.js')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        format: 'iife',
        inlineDynamicImports: true
      }
    }
  },
  worker: {
    format: 'iife'
  }
});