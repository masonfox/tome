import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./test-setup.ts'],
    env: {
      TZ: 'UTC', // Force UTC timezone for consistent date handling across all tests
    },
    coverage: {
      provider: 'istanbul',
      reporter: ['lcov', 'text'],
      reportsDirectory: './coverage',
    },
    // Enable parallel execution (this is what we want!)
    pool: 'threads',
    // Isolate tests in separate contexts
    isolate: true,
  },
  resolve: {
    alias: [
      {
        find: /^@\/(.*)$/,
        replacement: path.resolve(__dirname, './$1'),
      },
    ],
  },
  //  Externalize Bun built-in modules so they're not bundled by Vite
  ssr: {
    noExternal: true,
  },
});
