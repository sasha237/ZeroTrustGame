import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { ServerMessage } from '../src/types.js';
import { authed, buildTestApp, registerUser, type TestContext, type TestUser } from './helpers.js';

const STATE_MOVE = { changes: [{ policy: 'intelligence', delta: 1 }] };
const TERRORIST_MOVE = { changes: [{ policy: 'recruitment', delta: 1 }] };

describe('observer links (A-19)', () => {
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

  it('401 anonymous, 403 non-player, 200 player; repeat returns the same token', async () => {
    const { state, terrorist, gameId } = await setup();
    const url = `/games/${gameId}/observer-link`;

    const anon = await ctx.app.inject({ method: 'POST', url });
    expect(anon.statusCode).toBe(401);

    const outsider = await registerUser(ctx.app, 'out@x.com');
    const forbidden = await ctx.app.inject({ method: 'POST', url, headers: authed(outsider) });
    expect(forbidden.statusCode).toBe(403);

    const first = await ctx.app.inject({ method: 'POST', url, headers: authed(state) });
    expect(first.statusCode).toBe(200);
    const token = (first.json() as { token: string }).token;
    expect(token).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);

    const again = await ctx.app.inject({ method: 'POST', url, headers: authed(terrorist) });
    expect((again.json() as { token: string }).token).toBe(token);
  });

  it('GET /observe/:token serves the public view without login', async () => {
    const { state, gameId } = await setup();
    const token = await ctx.app
      .inject({ method: 'POST', url: `/games/${gameId}/observer-link`, headers: authed(state) })
      .then((r) => (r.json() as { token: string }).token);

    const res = await ctx.app.inject({ method: 'GET', url: `/observe/${token}` });
    expect(res.statusCode).toBe(200);
    const view = res.json().game;
    expect(view.id).toBe(gameId);
    expect(view.you).toBeNull();
    expect(view.opponent).toBeNull();
    expect(view.inviteCode).toBeNull();
    expect(view.turn).toBe(1);

    const wrong = await ctx.app.inject({ method: 'GET', url: '/observe/ZZZZZZZZ' });
    expect(wrong.statusCode).toBe(404);
  });

  it('observer history access via token: resolved turns only', async () => {
    const { state, terrorist, gameId } = await setup();
    const token = await ctx.app
      .inject({ method: 'POST', url: `/games/${gameId}/observer-link`, headers: authed(state) })
      .then((r) => (r.json() as { token: string }).token);

    const denied = await ctx.app.inject({ method: 'GET', url: `/games/${gameId}/history` });
    expect(denied.statusCode).toBe(401);

    const empty = await ctx.app.inject({ method: 'GET', url: `/games/${gameId}/history?token=${token}` });
    expect(empty.statusCode).toBe(200);
    expect(empty.json().turns).toEqual([]);

    await ctx.app.inject({ method: 'POST', url: `/games/${gameId}/orders`, headers: authed(state), payload: STATE_MOVE });
    await ctx.app.inject({ method: 'POST', url: `/games/${gameId}/orders`, headers: authed(terrorist), payload: TERRORIST_MOVE });

    const after = await ctx.app.inject({ method: 'GET', url: `/games/${gameId}/history?token=${token}` });
    expect(after.json().turns).toHaveLength(1);

    // Token of another game must not unlock this one.
    const other = await ctx.app
      .inject({ method: 'POST', url: '/games', headers: authed(state), payload: { side: 'terrorist' } })
      .then((r) => r.json() as { game: { id: string } });
    const otherToken = await ctx.app
      .inject({ method: 'POST', url: `/games/${other.game.id}/observer-link`, headers: authed(state) })
      .then((r) => (r.json() as { token: string }).token);
    const cross = await ctx.app.inject({ method: 'GET', url: `/games/${gameId}/history?token=${otherToken}` });
    expect(cross.statusCode).toBe(401);
  });

  it('leaks no trace of pending orders to the observer (REST + WS), then reveals', async () => {
    const { state, terrorist, gameId } = await setup();
    const token = await ctx.app
      .inject({ method: 'POST', url: `/games/${gameId}/observer-link`, headers: authed(state) })
      .then((r) => (r.json() as { token: string }).token);

    const address = await ctx.app.listen({ host: '127.0.0.1', port: 0 });
    const wsBase = address.replace('http://', 'ws://');

    const messages: ServerMessage[] = [];
    const socket = new WebSocket(`${wsBase}/ws?observe=${token}`);
    socket.on('message', (data) => messages.push(JSON.parse(data.toString()) as ServerMessage));
    await new Promise<void>((resolve) => socket.on('open', () => resolve()));

    // Hello view: nothing hidden.
    const hello = messages.find((m) => m.type === 'game') as Extract<ServerMessage, { type: 'game' }>;
    expect(hello).toBeTruthy();
    expect(JSON.stringify(hello.game)).not.toContain('"delta":1');
    expect(hello.game.you).toBeNull();
    expect(hello.game.history).toEqual([]);

    // State submits; observer learns THAT but not WHAT.
    await ctx.app.inject({ method: 'POST', url: `/games/${gameId}/orders`, headers: authed(state), payload: STATE_MOVE });
    await new Promise((r) => setTimeout(r, 100));
    const notice = messages.find((m) => m.type === 'orders-submitted') as Extract<ServerMessage, { type: 'orders-submitted' }>;
    expect(notice).toBeTruthy();
    expect(notice.side).toBe('state');
    expect(JSON.stringify(notice)).not.toContain('intelligence');
    for (const m of messages) {
      expect(JSON.stringify(m)).not.toContain('"delta":1');
      expect(JSON.stringify(m)).not.toContain('"changes":[{"policy"');
    }

    // REST observe endpoint agrees.
    const observe = await ctx.app.inject({ method: 'GET', url: `/observe/${token}` });
    expect(JSON.stringify(observe.json().game)).not.toContain('"delta":1');

    // Both submit -> observer receives the reveal.
    await ctx.app.inject({ method: 'POST', url: `/games/${gameId}/orders`, headers: authed(terrorist), payload: TERRORIST_MOVE });
    await new Promise((r) => setTimeout(r, 100));
    const reveal = messages.find((m) => m.type === 'reveal') as Extract<ServerMessage, { type: 'reveal' }>;
    expect(reveal).toBeTruthy();
    expect(reveal.turn).toBe(1);
    const finalView = messages[messages.length - 1] as Extract<ServerMessage, { type: 'game' }>;
    expect(finalView.game.history).toHaveLength(1);

    socket.close();
  });

  it('rejects observer WS connections with a bad token', async () => {
    const { state, gameId } = await setup();
    await ctx.app.inject({ method: 'POST', url: `/games/${gameId}/observer-link`, headers: authed(state) });
    const address = await ctx.app.listen({ host: '127.0.0.1', port: 0 });
    const wsBase = address.replace('http://', 'ws://');
    const code = await new Promise<number>((resolve) => {
      const ws = new WebSocket(`${wsBase}/ws?observe=BADTOKEN1`);
      ws.on('close', (c) => resolve(c));
      ws.on('error', () => {});
    });
    expect(code).toBe(4404);
  });
});
