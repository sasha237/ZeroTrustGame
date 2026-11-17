import { afterEach, describe, expect, it } from 'vitest';
import { authed, buildTestApp, registerUser, type TestContext } from './helpers.js';

const STATE_MOVE = { changes: [{ policy: 'intelligence', delta: 1 }] };

describe('hidden-information invariant', () => {
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

  it('leaks no trace of pending orders into the opponent-visible view', async () => {
    const { state, terrorist, gameId } = await setup();

    // State submits a distinctive order.
    const submit = await ctx.app.inject({
      method: 'POST',
      url: `/games/${gameId}/orders`,
      headers: authed(state),
      payload: STATE_MOVE,
    });
    expect(submit.statusCode).toBe(200);

    // Opponent fetches the game: nothing about the pending order may appear anywhere.
    const res = await ctx.app.inject({ method: 'GET', url: `/games/${gameId}`, headers: authed(terrorist) });
    expect(res.statusCode).toBe(200);
    const view = res.json().game as Record<string, unknown>;
    expect(view.history).toEqual([]);
    const you = view.you as { side: string; submitted: boolean; orders: unknown };
    expect(you.side).toBe('terrorist');
    expect(you.submitted).toBe(false);
    expect(you.orders).toBeNull();

    const serialized = JSON.stringify(view);
    // The policy name appears only as a public level-map key (value still 0);
    // the pending ORDER content must not appear in any shape.
    expect((view.state as { levels: { state: Record<string, number> } }).levels.state.intelligence).toBe(0);
    expect(serialized).not.toContain('"changes":[{"policy":"intelligence","delta":1}]');
    expect(serialized).not.toContain('"delta":1');
    // Only the submitted flag is exposed.
    const opponent = view.opponent as { submitted: boolean };
    expect(opponent.submitted).toBe(true);

    // History endpoint has nothing unresolved either.
    const hist = await ctx.app.inject({ method: 'GET', url: `/games/${gameId}/history`, headers: authed(terrorist) });
    expect(hist.json().turns).toEqual([]);
  });

  it('keeps the submitter view limited to their own orders', async () => {
    const { state, gameId } = await setup();
    await ctx.app.inject({
      method: 'POST',
      url: `/games/${gameId}/orders`,
      headers: authed(state),
      payload: STATE_MOVE,
    });
    const res = await ctx.app.inject({ method: 'GET', url: `/games/${gameId}`, headers: authed(state) });
    const view = res.json().game;
    expect(view.you.orders).toEqual(STATE_MOVE);
    expect(view.you.submitted).toBe(true);
    expect(view.opponent.submitted).toBe(false);
    expect(view.opponent.orders).toBeUndefined();
  });

  it('reveals both sides orders only after resolution', async () => {
    const { state, terrorist, gameId } = await setup();
    await ctx.app.inject({ method: 'POST', url: `/games/${gameId}/orders`, headers: authed(state), payload: STATE_MOVE });
    await ctx.app.inject({
      method: 'POST',
      url: `/games/${gameId}/orders`,
      headers: authed(terrorist),
      payload: { changes: [{ policy: 'recruitment', delta: 1 }] },
    });
    const res = await ctx.app.inject({ method: 'GET', url: `/games/${gameId}`, headers: authed(terrorist) });
    const view = res.json().game;
    expect(view.turn).toBe(2);
    expect(view.history).toHaveLength(1);
    expect(view.history[0].orders.state).toEqual(STATE_MOVE);
    expect(view.you.orders).toBeNull();
  });
});
