import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashToken } from '../src/auth.js';
import { authed, buildTestApp, registerUser, type TestContext } from './helpers.js';

async function forgot(app: TestContext['app'], email: string) {
  return app.inject({ method: 'POST', url: '/auth/forgot', payload: { email } });
}

/** Registers a user, requests a reset, and extracts the raw token from the mocked provider. */
async function issueResetToken(ctx: TestContext, email: string, fetchMock: ReturnType<typeof vi.fn>): Promise<string> {
  await forgot(ctx.app, email);
  const sentText = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)).content[0].value as string;
  return /#\/reset\/([0-9A-HJKMNP-TV-Z]{8})/.exec(sentText)![1]!;
}

describe('password reset (A-24)', () => {
  let ctx: TestContext;
  afterEach(async () => {
    vi.unstubAllGlobals();
    await ctx?.app.close();
  });

  it('forgot always returns the identical 200 for known and unknown emails', async () => {
    ctx = await buildTestApp();
    await registerUser(ctx.app, 'known@x.com');
    const known = await forgot(ctx.app, 'known@x.com');
    const unknown = await forgot(ctx.app, 'ghost@x.com');
    expect(known.statusCode).toBe(200);
    expect(unknown.statusCode).toBe(200);
    expect(known.body).toBe(unknown.body);
    expect(known.json()).toEqual({ ok: true });
    const malformed = await forgot(ctx.app, 'not-an-email');
    expect(malformed.statusCode).toBe(200);
    expect(malformed.body).toBe(known.body);
  });

  it('stores only the SHA-256 of the reset token, 1h TTL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    vi.stubGlobal('fetch', fetchMock);
    ctx = await buildTestApp({ emailApiUrl: 'https://mail.example', emailApiKey: 'k' });
    await registerUser(ctx.app, 'known@x.com');
    await forgot(ctx.app, 'known@x.com');
    // The provider was called with the raw link; the repo must never contain the raw token.
    const sentText = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)).content[0].value as string;
    const raw = /#\/reset\/([0-9A-HJKMNP-TV-Z]{8})/.exec(sentText)![1]!;
    const row = await ctx.repo.findPasswordResetByTokenHash(hashToken(raw));
    expect(row).toBeTruthy();
    expect(row!.expiresAt.getTime() - row!.createdAt.getTime()).toBeLessThanOrEqual(3600_000 + 1000);
    expect(row!.expiresAt.getTime() - row!.createdAt.getTime()).toBeGreaterThan(3500_000);
  });

  it('full reset flow: password updated, sessions revoked, token single-use', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    vi.stubGlobal('fetch', fetchMock);
    ctx = await buildTestApp({ emailApiUrl: 'https://mail.example', emailApiKey: 'k' });
    const user = await registerUser(ctx.app, 'victim@x.com');

    await forgot(ctx.app, 'victim@x.com');
    const sentText = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)).content[0].value as string;
    const raw = /#\/reset\/([0-9A-HJKMNP-TV-Z]{8})/.exec(sentText)![1]!;

    const bad = await ctx.app.inject({
      method: 'POST',
      url: '/auth/reset',
      payload: { token: raw, password: 'short' },
    });
    expect(bad.statusCode).toBe(400);

    const reset = await ctx.app.inject({
      method: 'POST',
      url: '/auth/reset',
      payload: { token: raw, password: 'new-password-456' },
    });
    expect(reset.statusCode).toBe(200);
    expect(reset.json()).toEqual({ ok: true });

    // Old sessions revoked.
    const me = await ctx.app.inject({ method: 'GET', url: '/auth/me', headers: authed(user) });
    expect(me.statusCode).toBe(401);
    // New password works, old one does not.
    const oldLogin = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'victim@x.com', password: 'password-123' },
    });
    expect(oldLogin.statusCode).toBe(401);
    const newLogin = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'victim@x.com', password: 'new-password-456' },
    });
    expect(newLogin.statusCode).toBe(200);

    // Single use.
    const reuse = await ctx.app.inject({
      method: 'POST',
      url: '/auth/reset',
      payload: { token: raw, password: 'another-password' },
    });
    expect(reuse.statusCode).toBe(404);
  });

  it('revokes only the resetting user sessions', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    vi.stubGlobal('fetch', fetchMock);
    ctx = await buildTestApp({ emailApiUrl: 'https://mail.example', emailApiKey: 'k' });
    await registerUser(ctx.app, 'reset-me@x.com');
    const other = await registerUser(ctx.app, 'bystander@x.com');

    const raw = await issueResetToken(ctx, 'reset-me@x.com', fetchMock);
    const reset = await ctx.app.inject({
      method: 'POST',
      url: '/auth/reset',
      payload: { token: raw, password: 'brand-new-password' },
    });
    expect(reset.statusCode).toBe(200);

    const bystander = await ctx.app.inject({ method: 'GET', url: '/auth/me', headers: authed(other) });
    expect(bystander.statusCode).toBe(200);
  });

  it('unknown and expired tokens get the generic 404', async () => {
    ctx = await buildTestApp();
    const wrong = await ctx.app.inject({
      method: 'POST',
      url: '/auth/reset',
      payload: { token: 'ZZZZZZZZ', password: 'new-password-456' },
    });
    expect(wrong.statusCode).toBe(404);
    expect(wrong.json().error).toBe('invalid or expired token');

    const user = await registerUser(ctx.app, 'exp@x.com');
    await ctx.repo.createPasswordReset(
      '11111111-1111-1111-1111-111111111111',
      user.id,
      hashToken('EXPIRED1'),
      new Date(Date.now() - 1000),
    );
    const expired = await ctx.app.inject({
      method: 'POST',
      url: '/auth/reset',
      payload: { token: 'EXPIRED1', password: 'new-password-456' },
    });
    expect(expired.statusCode).toBe(404);
    expect(expired.json().error).toBe('invalid or expired token');
  });

  it('HTTP email provider sends the SendGrid-style payload when configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    vi.stubGlobal('fetch', fetchMock);
    ctx = await buildTestApp({
      emailApiUrl: 'https://api.mailprovider.example',
      emailApiKey: 'secret-key',
      emailFrom: 'game@example.com',
      clientUrl: 'https://play.example.com',
    });
    await registerUser(ctx.app, 'mail@x.com');
    await forgot(ctx.app, 'mail@x.com');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe('https://api.mailprovider.example/v3/mail/send');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer secret-key');
    const body = JSON.parse(String(init.body));
    expect(body.personalizations[0].to[0].email).toBe('mail@x.com');
    expect(body.from.email).toBe('game@example.com');
    expect(body.subject).toContain('password reset');
    expect(body.content[0].value).toContain('https://play.example.com/#/reset/');
  });

  it('log-only fallback: no fetch happens when unconfigured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    ctx = await buildTestApp();
    await registerUser(ctx.app, 'quiet@x.com');
    await forgot(ctx.app, 'quiet@x.com');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rate limits forgot+reset to 5/min/IP (429 afterwards)', async () => {
    ctx = await buildTestApp();
    await registerUser(ctx.app, 'rl@x.com');
    let last = 0;
    for (let i = 0; i < 6; i++) {
      const res = await forgot(ctx.app, 'rl@x.com');
      last = res.statusCode;
    }
    expect(last).toBe(429);
  });
});
