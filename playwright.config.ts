import { defineConfig } from '@playwright/test';

/**
 * E2E config (debt closure from WORKING_PLAN §13). Uses the Chrome installed on this
 * box via channel 'chrome' — no browser download. Serves:
 *  - API:  dev server (tsx) with the M4 in-memory repo on :8080
 *  - client: `vite preview` of the built app on :4173 (preview.proxy forwards
 *    /auth, /games, /ws to the API, so the client's relative URLs work same-origin)
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: [
    // Neither npm nor node resolve on PATH in Playwright's spawned shell on this box —
    // use the absolute node.exe path.
    {
      command: '"C:\\Program Files\\nodejs\\node.exe" ./node_modules/tsx/dist/cli.mjs packages/server/src/index.ts',
      env: { REPO: 'memory', PORT: '8080' },
      url: 'http://localhost:8080/healthz',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: '"C:\\Program Files\\nodejs\\node.exe" ../../node_modules/vite/bin/vite.js preview',
      cwd: './packages/client',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
