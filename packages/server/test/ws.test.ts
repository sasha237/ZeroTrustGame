import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { ServerMessage } from '../src/types.js';
import { authed, buildTestApp, registerUser, type TestContext, type TestUser } from './helpers.js';

class WsClient {
  socket: WebSocket;
  messages: ServerMessage[] = [];
  closed = false;

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.on('message', (data) => {
      try {
        this.messages.push(JSON.parse(data.toString()) as ServerMessage);
      } catch {
        /* ignore malformed */
      }
    });
    socket.on('close', () => {
      this.closed = true;
    });
  }

  static connect(url: string): Promise<WsClient> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      const client = new WsClient(socket);
      socket.on('open', () => resolve(client));
      socket.on('error', reject);
    });
  }

  async waitFor(
    predicate: (m: ServerMessage) => boolean,
    timeoutMs = 3000,
    since = 0,
  ): Promise<ServerMessage> {
    const started = Date.now();
    for (;;) {
      const found = this.messages.slice(since).find(predicate);
      if (found) return found;
      if (this.closed) throw new Error('socket closed while waiting for a message');
      if (Date.now() - started > timeoutMs) {
        throw new Error(`timed out waiting for message; got ${JSON.stringify(this.messages)}`);
      }
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  close(): void {
    this.socket.close();
  }
}

describe('websocket integration', () => {
  let ctx: TestContext;
  let base: string;
  afterEach(async () => {
    await ctx?.app.close();
  });

  async function start() {
    ctx = await buildTestApp();
    const address = await ctx.app.listen({ host: '127.0.0.1', port: 0 });
    base = address.replace('http://', 'ws://');
    return ctx;
  }

  async function post(user: TestUser, url: string, payload: Record<string, unknown>): Promise<{ status: number; body: any }> {
    const res = await ctx.app.inject({ method: 'POST', url, headers: authed(user), payload });
    return { status: res.statusCode, body: res.json() };
  }

  it('runs create/join/submit over live sockets with reveal + game-over, and survives reconnect', async () => {
    await start();
    const stateUser = await registerUser(ctx.app, 'state@x.com');
    const terroristUser = await registerUser(ctx.app, 'terrorist@x.com');

    // Create (state side) and capture the invite code from the creator's WS hello.
    const created = await post(stateUser, '/games', { side: 'state' });
    expect(created.status).toBe(201);
    const gameId = created.body.game.id as string;

    const stateWs = await WsClient.connect(`${base}/ws/${gameId}?token=${stateUser.token}`);
    const hello = (await stateWs.waitFor((m) => m.type === 'game')) as Extract<ServerMessage, { type: 'game' }>;
    expect(hello.game.inviteCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
    const code = hello.game.inviteCode!;

    // Opponent joins via REST; creator is pushed the started game.
    const joined = await post(terroristUser, '/games/join', { code });
    expect(joined.status).toBe(200);
    const startedPush = (await stateWs.waitFor(
      (m) => m.type === 'game' && m.game.status === 'active',
    )) as Extract<ServerMessage, { type: 'game' }>;
    expect(startedPush.game.turn).toBe(1);

    const terroristWs = await WsClient.connect(`${base}/ws/${gameId}?token=${terroristUser.token}`);
    const hello2 = (await terroristWs.waitFor((m) => m.type === 'game')) as Extract<ServerMessage, { type: 'game' }>;
    expect(hello2.game.you?.side).toBe('terrorist');

    // State submits: terrorist only learns THAT, not WHAT.
    const s1 = await post(stateUser, `/games/${gameId}/orders`, { changes: [{ policy: 'intelligence', delta: 1 }] });
    expect(s1.status).toBe(200);
    const notice = (await terroristWs.waitFor(
      (m) => m.type === 'orders-submitted',
    )) as Extract<ServerMessage, { type: 'orders-submitted' }>;
    expect(notice.side).toBe('state');
    expect(notice.turn).toBe(1);
    const terrorView = (await terroristWs.waitFor(
      (m) => m.type === 'game' && m.game.turn === 1,
    )) as Extract<ServerMessage, { type: 'game' }>;
    expect(JSON.stringify(terrorView.game)).not.toContain('"delta":1');

    // Terrorist submits -> both get the reveal.
    await post(terroristUser, `/games/${gameId}/orders`, { changes: [{ policy: 'recruitment', delta: 1 }] });
    const reveal = (await stateWs.waitFor((m) => m.type === 'reveal')) as Extract<ServerMessage, { type: 'reveal' }>;
    expect(reveal.turn).toBe(1);
    expect(reveal.summary.events.length).toBeGreaterThan(0);
    await terroristWs.waitFor((m) => m.type === 'reveal');
    const turn2 = (await stateWs.waitFor(
      (m) => m.type === 'game' && m.game.turn === 2,
    )) as Extract<ServerMessage, { type: 'game' }>;
    expect(turn2.game.history).toHaveLength(1);

    // Reconnect simulation: terrorist drops; REST resumes full state.
    const mark = stateWs.messages.length;
    terroristWs.close();
    await new Promise((r) => setTimeout(r, 50));
    const resumed = await ctx.app.inject({ method: 'GET', url: `/games/${gameId}`, headers: authed(terroristUser) });
    expect(resumed.statusCode).toBe(200);
    const resumedGame = resumed.json().game;
    expect(resumedGame.turn).toBe(2);
    expect(resumedGame.history).toHaveLength(1);
    expect(resumedGame.state.indicators.stability).toBe(reveal.state.indicators.stability);

    // Presence: creator sees the opponent disconnect/reconnect.
    const presenceOff = (await stateWs.waitFor(
      (m) => m.type === 'presence' && !m.connected,
      3000,
      mark,
    )) as Extract<ServerMessage, { type: 'presence' }>;
    expect(presenceOff.side).toBe('terrorist');

    const terroristWs2 = await WsClient.connect(`${base}/ws/${gameId}?token=${terroristUser.token}`);
    const presenceOn = (await stateWs.waitFor(
      (m) => m.type === 'presence' && m.connected,
      3000,
      mark,
    )) as Extract<ServerMessage, { type: 'presence' }>;
    expect(presenceOn.side).toBe('terrorist');
    await terroristWs2.waitFor((m) => m.type === 'game');

    // Mutual draw on turn 2 ends the game for both.
    await post(stateUser, `/games/${gameId}/orders`, { changes: [], agreeToDraw: true });
    await post(terroristUser, `/games/${gameId}/orders`, { changes: [], agreeToDraw: true });
    const over = (await terroristWs2.waitFor((m) => m.type === 'game-over')) as Extract<
      ServerMessage,
      { type: 'game-over' }
    >;
    expect(over.result.winner).toBe('draw');
    await stateWs.waitFor((m) => m.type === 'game-over');

    stateWs.close();
    terroristWs2.close();
  });

  it('rejects a websocket connection with a bad token or from a non-player', async () => {
    await start();
    const a = await registerUser(ctx.app, 'a@x.com');
    const outsider = await registerUser(ctx.app, 'o@x.com');
    const created = await post(a, '/games', { side: 'state' });
    const gameId = created.body.game.id as string;

    const bad = await new Promise<number>((resolve) => {
      const ws = new WebSocket(`${base}/ws/${gameId}?token=not-a-token`);
      ws.on('close', (code) => resolve(code));
      ws.on('error', () => {});
    });
    expect(bad).toBe(4401);

    const forbidden = await new Promise<number>((resolve) => {
      const ws = new WebSocket(`${base}/ws/${gameId}?token=${outsider.token}`);
      ws.on('close', (code) => resolve(code));
      ws.on('error', () => {});
    });
    expect(forbidden).toBe(4403);
  });
});
