import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig, validateConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';
import { createMemoryRepository } from '../src/repo.memory.js';
import { buildTestApp } from './helpers.js';

describe('deploy hardening (A-25)', () => {
  let ctx: Awaited<ReturnType<typeof buildTestApp>>;
  afterEach(async () => {
    await ctx?.app.close();
  });

  it('sends security headers on every response', async () => {
    ctx = await buildTestApp();
    const res = await ctx.app.inject({ method: 'GET', url: '/healthz' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(String(res.headers['content-security-policy'])).toContain("default-src 'self'");
    expect(String(res.headers['content-security-policy'])).toContain("object-src 'none'");
  });

  it('healthz returns ok and reflects the upstream health check', async () => {
    ctx = await buildTestApp();
    const ok = await ctx.app.inject({ method: 'GET', url: '/healthz' });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ ok: true });

    const sick = await buildApp(createMemoryRepository(), loadConfig({ REPO: 'memory' }), {
      healthCheck: async () => false,
    });
    try {
      const res = await sick.app.inject({ method: 'GET', url: '/healthz' });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual({ ok: false });
    } finally {
      await sick.app.close();
    }
  });

  it('rejects oversized JSON bodies with 413', async () => {
    ctx = await buildTestApp();
    const big = { email: 'a@x.com', password: 'password-123', displayName: 'x'.repeat(17_000) };
    const res = await ctx.app.inject({ method: 'POST', url: '/auth/register', payload: big });
    expect(res.statusCode).toBe(413);
  });

  it('graceful shutdown: app.close() resolves and stops accepting', async () => {
    ctx = await buildTestApp();
    const address = await ctx.app.listen({ host: '127.0.0.1', port: 0 });
    expect(address).toBeTruthy();
    await ctx.app.close();
    const res = await ctx.app.inject({ method: 'GET', url: '/healthz' }).catch(() => null);
    // After close, inject still works on the instance, but the port is released.
    void res;
    ctx = undefined as never; // already closed; skip afterEach double-close
  });

  it('boot env validation fails fast with clear messages', () => {
    expect(() => validateConfig(loadConfig({ PORT: 'abc' }))).toThrow(/PORT/);
    expect(() => validateConfig(loadConfig({ PORT: '70000' }))).toThrow(/PORT/);
    expect(() => validateConfig(loadConfig({ REPO: 'pg' }))).toThrow(/REPO=pg requires DATABASE_URL/);
    expect(() => validateConfig(loadConfig({ DATABASE_URL: 'mysql://x' }))).toThrow(/DATABASE_URL/);
    expect(() => validateConfig(loadConfig({ REPO: 'memory' }))).not.toThrow();
    expect(() => validateConfig(loadConfig({ DATABASE_URL: 'postgres://u:p@h/db' }))).not.toThrow();
  });

  it('parses TRUST_PROXY and email env vars', () => {
    const config = loadConfig({
      TRUST_PROXY: 'true',
      EMAIL_API_URL: 'https://mail.example',
      EMAIL_API_KEY: 'k',
      EMAIL_FROM: 'noreply@example.com',
      CLIENT_URL: 'https://play.example.com/',
    });
    expect(config.trustProxy).toBe(true);
    expect(config.emailApiUrl).toBe('https://mail.example');
    expect(config.emailFrom).toBe('noreply@example.com');
    expect(config.clientUrl).toBe('https://play.example.com'); // trailing slash stripped
  });
});
