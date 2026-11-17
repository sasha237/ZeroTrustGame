import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Root test config: discovers engine + client tests, and aliases @bot/engine to its
// raw TS source so vitest transforms it (no pre-bundled node_modules copy).
export default defineConfig({
  resolve: {
    alias: {
      '@bot/engine': fileURLToPath(new URL('./packages/engine/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
  },
});
