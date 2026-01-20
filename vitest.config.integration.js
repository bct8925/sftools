// vitest.config.integration.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: './tests/integration/setup.js',
    include: ['tests/integration/**/*.test.js'],
    testTimeout: 30000, // 30s for API calls
    hookTimeout: 10000, // 10s for cleanup
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Sequential to avoid rate limits
      },
    },
  },
});
