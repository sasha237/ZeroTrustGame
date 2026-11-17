import { afterEach, describe, expect, it } from 'vitest';
import { authed, buildTestApp, registerUser, type TestContext } from './helpers.js';

describe('auth routes', () => {
  let ctx: TestContext;
  afterEach(async () => {
    await ctx?.app.close();
  });

  it('registers, logs in, and returns the current user', async () => {
    ctx = await buildTestApp();
    const user = await registerUser(ctx.app, 'alice@example.com');

    const me = await ctx.app.inject({ method: 'GET', url: '/auth/me', headers: authed(user) });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe('alice@example.com');

    const login = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'alice@example.com', password: 'password-123' },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().token).toBeTruthy();
  });

  it('rejects a wrong password with 401', async () => {
    ctx = await buildTestApp();
    await registerUser(ctx.app, 'bob@example.com');
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'bob@example.com', password: 'wrong-password' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBeTruthy();
  });

  it('rejects a duplicate email with 409', async () => {
    ctx = await buildTestApp();
    await registerUser(ctx.app, 'carol@example.com');
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'carol@example.com', password: 'password-123' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('rejects an invalid email shape with 400', async () => {
    ctx = await buildTestApp();
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'not-an-email', password: 'password-123' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a short password with 400', async () => {
    ctx = await buildTestApp();
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'dave@example.com', password: 'short' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('invalidates the token after logout', async () => {
    ctx = await buildTestApp();
    const user = await registerUser(ctx.app, 'erin@example.com');
    const out = await ctx.app.inject({ method: 'POST', url: '/auth/logout', headers: authed(user) });
    expect(out.statusCode).toBe(204);
    const me = await ctx.app.inject({ method: 'GET', url: '/auth/me', headers: authed(user) });
    expect(me.statusCode).toBe(401);
  });

  it('rejects requests without a token', async () => {
    ctx = await buildTestApp();
    const res = await ctx.app.inject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('stores passwords as scrypt modular strings, never plaintext', async () => {
    ctx = await buildTestApp();
    const user = await registerUser(ctx.app, 'frank@example.com');
    const row = await ctx.repo.findUserById(user.id);
    expect(row!.passwordHash.startsWith('scrypt$16384$8$1$')).toBe(true);
    expect(row!.passwordHash).not.toContain('password-123');
  });
});
