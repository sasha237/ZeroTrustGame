import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const { Pool } = pg;

/** Postgres connection pool. Boot fails fast (no retry loop) if the DB is unreachable. */
export function createPool(databaseUrl: string): pg.Pool {
  return new Pool({ connectionString: databaseUrl, max: 10 });
}

/**
 * Applies pending migrations from ./migrations in filename order, recording each in
 * schema_migrations. Throws on any failure so the caller can fail fast.
 */
export async function migrate(pool: pg.Pool): Promise<void> {
  const dir = fileURLToPath(new URL('../migrations', import.meta.url));
  await pool.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version int PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const file of files) {
      const version = Number(file.split('_')[0]);
      const { rows } = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
      if (rows.length > 0) continue;
      const sql = await readFile(path.join(dir, file), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Connect check used at boot so a bad DATABASE_URL kills the process with a clear message. */
export async function assertDatabaseReady(pool: pg.Pool): Promise<void> {
  await pool.query('SELECT 1');
}
