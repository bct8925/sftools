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
        app: resolve(__dirname, 'src/app.html'),
        aura: resolve(__dirname, 'src/aura/aura.html')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        format: 'es'
      }
    }
  },

  worker: {
    format: 'es'
  }
});