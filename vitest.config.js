// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __SFTOOLS_DEBUG__: false,
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