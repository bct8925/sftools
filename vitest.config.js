// vitest.config.js
import { defineConfig } from 'vitest/config';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';

// Plugin to resolve .js imports to .ts files during incremental migration
function jsToTsResolver() {
  return {
    name: 'js-to-ts-resolver',
    resolveId(source, importer) {
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
    environment: 'jsdom',
    setupFiles: './tests/unit/setup.js',
    include: ['tests/unit/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**/*.js'],
      exclude: [],
    },
  },
});