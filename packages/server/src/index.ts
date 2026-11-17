import { loadConfig, validateConfig } from './config.js';
import { createPool, migrate, assertDatabaseReady } from './db.js';
import { createPgRepository } from './repo.pg.js';
import { createMemoryRepository } from './repo.memory.js';
import { buildApp } from './app.js';
import type { Repository } from './repo.js';

async function main(): Promise<void> {
  const config = loadConfig();
  try {
    validateConfig(config); // A-25: fail fast with a clear FATAL
  } catch (err) {
    console.error(`[server] FATAL: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  let repo: Repository;
  let pool: ReturnType<typeof createPool> | null = null;
  let healthCheck: (() => Promise<boolean>) | undefined;

  if (config.repo === 'pg') {
    pool = createPool(config.databaseUrl!);
    try {
      await assertDatabaseReady(pool);
      await migrate(pool);
    } catch (err) {
      console.error(
        `[server] FATAL: cannot connect to or migrate the database (DATABASE_URL is set).\n` +
          `  ${err instanceof Error ? err.message : String(err)}\n` +
          `  Check that Postgres is running and DATABASE_URL is correct.`,
      );
      process.exit(1);
    }
    repo = createPgRepository(pool);
    healthCheck = async () => {
      try {
        await assertDatabaseReady(pool!);
        return true;
      } catch {
        return false;
      }
    };
    console.log('[server] using Postgres repository');
  } else {
    repo = createMemoryRepository();
    console.warn('[server] WARNING: REPO=memory — in-memory storage (data is lost on restart)');
  }

  const { app, hub } = await buildApp(repo, config, { healthCheck });
  try {
    await app.listen({ host: '0.0.0.0', port: config.port });
  } catch (err) {
    console.error(`[server] FATAL: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  console.log(`[server] Zero Trust M4 listening on http://0.0.0.0:${config.port}`);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] ${signal} received, shutting down`);
    hub.closeAll();
    await app.close(); // stop accepting, drain
    if (pool) await pool.end();
    console.log('[server] shutdown complete');
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[server] FATAL: unhandled bootstrap error', err);
  process.exit(1);
});
