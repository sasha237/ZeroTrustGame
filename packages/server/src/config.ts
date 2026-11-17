export type RepoMode = 'memory' | 'pg';

export interface Config {
  port: number;
  /** When set, the server uses the Postgres repo and migrates on boot. */
  databaseUrl: string | null;
  /** Explicit repo selection; 'pg' requires DATABASE_URL. */
  repo: RepoMode;
  /** Comma-separated list of allowed browser origins (REST CORS + WS origin check). */
  corsOrigins: string[];
  tokenTtlHours: number;
  logRequests: boolean;
  trustProxy: boolean;
  /** A-23 email provider. */
  emailApiUrl: string | null;
  emailApiKey: string | null;
  emailFrom: string;
  /** A-24: base URL baked into password-reset links. */
  clientUrl: string;
}

function list(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL?.trim() || null;
  const repo: RepoMode = env.REPO === 'memory' ? 'memory' : env.REPO === 'pg' ? 'pg' : databaseUrl ? 'pg' : 'memory';
  return {
    port: env.PORT === undefined ? 8080 : Number(env.PORT),
    databaseUrl,
    repo,
    corsOrigins: list(env.CORS_ORIGIN, ['http://localhost:5173', 'http://localhost:4173']),
    tokenTtlHours: env.TOKEN_TTL_HOURS === undefined ? 24 * 30 : Number(env.TOKEN_TTL_HOURS),
    logRequests: env.LOG_REQUESTS === '1',
    trustProxy: env.TRUST_PROXY === 'true' || env.TRUST_PROXY === '1',
    emailApiUrl: env.EMAIL_API_URL?.trim() || null,
    emailApiKey: env.EMAIL_API_KEY?.trim() || null,
    emailFrom: env.EMAIL_FROM?.trim() || 'no-reply@balanceofterror.local',
    clientUrl: (env.CLIENT_URL?.trim() || 'http://localhost:5173').replace(/\/$/, ''),
  };
}

/**
 * A-25 boot validation: fail fast with a clear FATAL listing the offending variables.
 */
export function validateConfig(config: Config): void {
  const problems: string[] = [];
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    problems.push(`PORT must be an integer in 1..65535 (got ${config.port})`);
  }
  if (config.repo === 'pg' && !config.databaseUrl) {
    problems.push('REPO=pg requires DATABASE_URL to be set');
  }
  if (config.databaseUrl && !/^postgres(ql)?:\/\//.test(config.databaseUrl)) {
    problems.push('DATABASE_URL must start with postgres:// or postgresql://');
  }
  if (!(config.tokenTtlHours > 0)) {
    problems.push(`TOKEN_TTL_HOURS must be positive (got ${config.tokenTtlHours})`);
  }
  if (problems.length > 0) {
    throw new Error(`invalid configuration:\n  - ${problems.join('\n  - ')}`);
  }
}
