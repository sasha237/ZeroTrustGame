import { afterEach, describe, expect, it } from 'vitest';
import { authed, buildTestApp, registerUser, type TestContext } from './helpers.js';

describe('draw handling', () => {
  let ctx: TestContext;
  afterEach(async () => {
    await ctx?.app.close();
  });

  async function setup() {
    ctx = await buildTestApp();
    const state = await registerUser(ctx.app, 'state@x.com');
    const terrorist = await registerUser(ctx.app, 'terrorist@x.com');
    const created = await ctx.app
      .inject({ method: 'POST', url: '/games', headers: authed(state), payload: { side: 'state' } })
      .then((r) => r.json() as { game: { id: string; inviteCode: string } });
    await ctx.app.inject({
      method: 'POST',
      url: '/games/join',
      headers: authed(terrorist),
      payload: { code: created.game.inviteCode },
    });
    return { state, terrorist, gameId: created.game.id };
  }

  it('ends the game in a draw when BOTH sides agree', async () => {
    const { state, terrorist, gameId } = await setup();
    const r1 = await ctx.app.inject({
      method: 'POST',
      url: `/games/${gameId}/orders`,
      headers: authed(state),
      payload: { changes: [], agreeToDraw: true },
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().game.status).toBe('active'); // one-sided agreement does not end it

    const r2 = await ctx.app.inject({
      method: 'POST',
      url: `/games/${gameId}/orders`,
      headers: authed(terrorist),
      payload: { changes: [], agreeToDraw: true },
    });
    expect(r2.statusCode).toBe(200);
    expect(r2.json().game.status).toBe('finished');
    expect(r2.json().game.result.winner).toBe('draw');

    // A finished game rejects further orders.
    const r3 = await ctx.app.inject({
      method: 'POST',
      url: `/games/${gameId}/orders`,
      headers: authed(state),
      payload: { changes: [] },
    });
    expect(r3.statusCode).toBe(409);
  });

  it('resolves the turn normally when one side declines by submitting without the flag', async () => {
    const { state, terrorist, gameId } = await setup();
    await ctx.app.inject({
      method: 'POST',
      url: `/games/${gameId}/orders`,
      headers: authed(state),
      payload: { changes: [], agreeToDraw: true },
    });
    const r2 = await ctx.app.inject({
      method: 'POST',
      url: `/games/${gameId}/orders`,
      headers: authed(terrorist),
      payload: { changes: [{ policy: 'recruitment', delta: 1 }] },
    });
    expect(r2.statusCode).toBe(200);
    const game = r2.json().game;
    expect(game.status).toBe('active');
    expect(game.turn).toBe(2);
    expect(game.history).toHaveLength(1);
    expect(game.history[0].orders.state.agreeToDraw).toBe(true);
    expect(game.history[0].orders.terrorist.changes).toHaveLength(1);
  });
});
