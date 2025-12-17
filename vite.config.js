import { defineConfig } from 'vite';
import { resolve } from 'path';
import monacoEditorPlugin from 'vite-plugin-monaco-editor';

export default defineConfig({
  // Crucial for Chrome Extensions: ensures assets load from relative paths
  base: './', 
  
  plugins: [
    // Automatically handles copying Monaco worker files to dist
    monacoEditorPlugin({
      // Only load the languages you need to keep bundle size down
      languageWorkers: ['json', 'editorWorkerService'], 
      publicPath: './' // Ensures workers are found relative to the app
    })
  ],

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: resolve(__dirname, 'src/app.js')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        // 'es' is preferred for Extensions using modern libraries like Monaco.
        // Ensure your HTML script tag has type="module".
        format: 'es' 
      }
    }
  },
  
  worker: {
    format: 'es'
  }
});