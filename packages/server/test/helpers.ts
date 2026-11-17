import type { FastifyInstance } from 'fastify';
import type { Repository } from '../src/repo.js';
import { createMemoryRepository } from '../src/repo.memory.js';
import { buildApp, type BuiltApp } from '../src/app.js';
import { loadConfig, type Config } from '../src/config.js';

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    port: 0,
    databaseUrl: null,
    repo: 'memory',
    corsOrigins: ['http://localhost:5173'],
    tokenTtlHours: 24,
    logRequests: false,
    trustProxy: false,
    emailApiUrl: null,
    emailApiKey: null,
    emailFrom: 'no-reply@balanceofterror.local',
    clientUrl: 'http://localhost:5173',
    ...overrides,
  };
}

export interface TestContext {
  app: FastifyInstance;
  repo: Repository;
  built: BuiltApp;
}

export async function buildTestApp(overrides: Partial<Config> = {}): Promise<TestContext> {
  const repo = createMemoryRepository();
  const built = await buildApp(repo, testConfig(overrides));
  return { app: built.app, repo, built };
}

export interface TestUser {
  token: string;
  id: string;
  email: string;
}

export async function registerUser(app: FastifyInstance, email: string, password = 'password-123'): Promise<TestUser> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password, displayName: email.split('@')[0] },
  });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.statusCode} ${res.body}`);
  const body = res.json() as { token: string; user: { id: string } };
  return { token: body.token, id: body.user.id, email };
}

export function authed(user: TestUser) {
  return { authorization: `Bearer ${user.token}` };
}
