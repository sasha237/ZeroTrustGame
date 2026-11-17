import { afterEach, describe, expect, it } from 'vitest';
import { authed, buildTestApp, registerUser, type TestContext } from './helpers.js';
import { generateInviteCode } from '../src/game.service.js';

const CROCKFORD_RE = /^[0-9A-HJKMNP-TV-Z]{8}$/;

describe('invite codes', () => {
  let ctx: TestContext;
  afterEach(async () => {
    await ctx?.app.close();
  });

  it('generates 8-char Crockford base32 codes', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateInviteCode()).toMatch(CROCKFORD_RE);
    }
    // No ambiguous characters (I, L, O, U) by construction of the alphabet.
    expect('ILOU'.split('').some((ch) => CROCKFORD_RE.source.includes(ch))).toBe(false);
  });

  it('returns 404 for a wrong code', async () => {
    ctx = await buildTestApp();
    const user = await registerUser(ctx.app, 'a@x.com');
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/games/join',
      headers: authed(user),
      payload: { code: 'ZZZZZZZZ' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('accepts lowercase input by normalizing', async () => {
    ctx = await buildTestApp();
    const a = await registerUser(ctx.app, 'a@x.com');
    const b = await registerUser(ctx.app, 'b@x.com');
    const created = await ctx.app
      .inject({ method: 'POST', url: '/games', headers: authed(a), payload: { side: 'state' } })
      .then((r) => r.json() as { game: { inviteCode: string } });
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/games/join',
      headers: authed(b),
      payload: { code: created.game.inviteCode.toLowerCase() },
    });
    expect(res.statusCode).toBe(200);
  });

  it('rejects an invalid side at game creation', async () => {
    ctx = await buildTestApp();
    const a = await registerUser(ctx.app, 'a@x.com');
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/games',
      headers: authed(a),
      payload: { side: 'observer' },
    });
    expect(res.statusCode).toBe(400);
  });
});
