import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// @bot/engine exports raw TS; alias it to the source entry so both the dev server
// and the bundler transform it through the pipeline instead of pre-bundling.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@bot/engine': fileURLToPath(new URL('../engine/src/index.ts', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['@bot/engine'],
  },
  server: {
    proxy: {
      '/auth': 'http://localhost:8080',
      '/games': 'http://localhost:8080',
      '/observe': 'http://localhost:8080',
      '/ws': { target: 'ws://localhost:8080', ws: true },
    },
  },
  // vite preview (used by E2E) proxies the same routes to the API server.
  preview: {
    port: 4173,
    proxy: {
      '/auth': 'http://localhost:8080',
      '/games': 'http://localhost:8080',
      '/observe': 'http://localhost:8080',
      '/ws': { target: 'ws://localhost:8080', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
