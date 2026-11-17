import { afterEach, describe, expect, it } from 'vitest';
import { getInitialState, resolveTurn, rulesetV1_3, type Orders } from '@bot/engine';
import { csvEscape } from '../src/csv.js';
import { authed, buildTestApp, registerUser, type TestContext, type TestUser } from './helpers.js';

const STATE_MOVE: Orders = { changes: [{ policy: 'intelligence', delta: 1 }] };
const TERRORIST_MOVE: Orders = { changes: [{ policy: 'recruitment', delta: 1 }] };
const EMPTY: Orders = { changes: [] };

function esc(field: string): string {
  return csvEscape(field);
}

describe('CSV debrief export (A-20)', () => {
  let ctx: TestContext;
  let state: TestUser;
  let terrorist: TestUser;
  let outsider: TestUser;
  let gameId: string;
  let observerToken: string;
  afterEach(async () => {
    await ctx?.app.close();
  });

  async function setup() {
    ctx = await buildTestApp();
    state = await registerUser(ctx.app, 'state@x.com');
    terrorist = await registerUser(ctx.app, 'terrorist@x.com');
    outsider = await registerUser(ctx.app, 'out@x.com');
    const created = await ctx.app
      .inject({ method: 'POST', url: '/games', headers: authed(state), payload: { side: 'state' } })
      .then((r) => r.json() as { game: { id: string; inviteCode: string } });
    gameId = created.game.id;
    await ctx.app.inject({
      method: 'POST',
      url: '/games/join',
      headers: authed(terrorist),
      payload: { code: created.game.inviteCode },
    });
    observerToken = await ctx.app
      .inject({ method: 'POST', url: `/games/${gameId}/observer-link`, headers: authed(state) })
      .then((r) => (r.json() as { token: string }).token);

    // Scripted 2-turn game: both sides move in turn 1, both hold in turn 2.
    await ctx.app.inject({ method: 'POST', url: `/games/${gameId}/orders`, headers: authed(state), payload: STATE_MOVE });
    await ctx.app.inject({ method: 'POST', url: `/games/${gameId}/orders`, headers: authed(terrorist), payload: TERRORIST_MOVE });
    await ctx.app.inject({ method: 'POST', url: `/games/${gameId}/orders`, headers: authed(state), payload: EMPTY });
    await ctx.app.inject({ method: 'POST', url: `/games/${gameId}/orders`, headers: authed(terrorist), payload: EMPTY });
  }

  function expectedCsv(): string {
    // Independently derive every value from the engine.
    const initial = getInitialState(rulesetV1_3);
    const s1 = resolveTurn(rulesetV1_3, initial, STATE_MOVE, TERRORIST_MOVE);
    const s2 = resolveTurn(rulesetV1_3, s1.state, EMPTY, EMPTY);
    const turns = [
      { orders: { state: STATE_MOVE, terrorist: TERRORIST_MOVE }, summary: s1, state: s1.state },
      { orders: { state: EMPTY, terrorist: EMPTY }, summary: s2, state: s2.state },
    ];
    const lines = ['turn,side,orders,stability,legitimacy,security,mobilization,budget_after,bank_after,spend,income,events'];
    for (const [i, t] of turns.entries()) {
      const events = t.summary.events.join(' | ');
      for (const side of ['state', 'terrorist'] as const) {
        const econ = t.summary.economy.find((e) => e.side === side)!;
        const ordersLabel =
          side === 'state'
            ? i === 0
              ? 'Intelligence+1'
              : ''
            : i === 0
              ? 'Recruitment+1'
              : '';
        const ind = t.state.indicators;
        lines.push(
          [
            String(i + 1),
            side,
            esc(ordersLabel),
            String(ind.stability),
            String(ind.legitimacy),
            String(ind.security),
            String(ind.mobilization),
            String(t.state.budget[side]),
            String(t.state.bank[side]),
            String(econ.spend),
            String(econ.income),
            esc(events),
          ].join(','),
        );
      }
    }
    return lines.join('\r\n') + '\r\n';
  }

  it('exports byte-exact CSV for a scripted 2-turn game (player bearer)', async () => {
    await setup();
    const res = await ctx.app.inject({ method: 'GET', url: `/games/${gameId}/export.csv`, headers: authed(state) });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');

    const body = res.body;
    const lines = body.split('\r\n').filter((l: string) => l.length > 0);
    expect(lines).toHaveLength(5); // header + 2 turns x 2 sides
    expect(lines[0]).toBe('turn,side,orders,stability,legitimacy,security,mobilization,budget_after,bank_after,spend,income,events');

    // Spot-check the first two rows in detail.
    const row1 = lines[1]!.split(',');
    expect(row1[0]).toBe('1');
    expect(row1[1]).toBe('state');
    expect(row1[2]).toBe('Intelligence+1');
    const row2 = lines[2]!.split(',');
    expect(row2[1]).toBe('terrorist');
    expect(row2[2]).toBe('Recruitment+1');
    // Empty orders render as an empty field.
    const row3 = lines[3]!.split(',');
    expect(row3[2]).toBe('');
    // Events column is quoted (contains commas).
    expect(lines[1]!).toMatch(/"[^"]*Turn 1 resolved\."$/);

    expect(body).toBe(expectedCsv());
  });

  it('allows export via observer token, denies anonymous and non-players', async () => {
    await setup();
    const anon = await ctx.app.inject({ method: 'GET', url: `/games/${gameId}/export.csv` });
    expect(anon.statusCode).toBe(401);

    const forbidden = await ctx.app.inject({ method: 'GET', url: `/games/${gameId}/export.csv`, headers: authed(outsider) });
    expect(forbidden.statusCode).toBe(403);

    const viaToken = await ctx.app.inject({ method: 'GET', url: `/games/${gameId}/export.csv?token=${observerToken}` });
    expect(viaToken.statusCode).toBe(200);
    expect(viaToken.body).toBe(expectedCsv());

    const badToken = await ctx.app.inject({ method: 'GET', url: `/games/${gameId}/export.csv?token=ZZZZZZZZ` });
    expect(badToken.statusCode).toBe(401);
  });

  it('exports header only before any turn is resolved', async () => {
    ctx = await buildTestApp();
    const a = await registerUser(ctx.app, 'a@x.com');
    const b = await registerUser(ctx.app, 'b@x.com');
    const created = await ctx.app
      .inject({ method: 'POST', url: '/games', headers: authed(a), payload: { side: 'state' } })
      .then((r) => r.json() as { game: { id: string; inviteCode: string } });
    await ctx.app.inject({ method: 'POST', url: '/games/join', headers: authed(b), payload: { code: created.game.inviteCode } });
    const res = await ctx.app.inject({ method: 'GET', url: `/games/${created.game.id}/export.csv`, headers: authed(a) });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('turn,side,orders,stability,legitimacy,security,mobilization,budget_after,bank_after,spend,income,events\r\n');
  });
});
