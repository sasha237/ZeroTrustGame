import { afterEach, describe, expect, it } from 'vitest';
import { getInitialState, resolveTurn, rulesetV1_3, serializeState, validateOrders } from '@bot/engine';
import type { Orders } from '@bot/engine';
import { GameService, ServiceError } from '../src/game.service.js';
import { WsHub } from '../src/ws.js';
import { createMemoryRepository } from '../src/repo.memory.js';
import type { UserRow } from '../src/types.js';

function makeService() {
  const repo = createMemoryRepository();
  const hub = new WsHub();
  const service = new GameService(repo, hub);
  return { repo, hub, service };
}

async function makeUser(repo: ReturnType<typeof createMemoryRepository>, email: string): Promise<UserRow> {
  return repo.createUser(email, 'scrypt$16384$8$1$ab$cd', null);
}

const stateOrders = (changes: Orders['changes']): Orders => ({ changes });
const STATE_MOVE: Orders = { changes: [{ policy: 'intelligence', delta: 1 }] };
const TERRORIST_MOVE: Orders = { changes: [{ policy: 'recruitment', delta: 1 }] };

describe('game service', () => {
  const disposables: WsHub[] = [];
  afterEach(() => {
    for (const hub of disposables) hub.closeAll();
    disposables.length = 0;
  });

  function svc() {
    const s = makeService();
    disposables.push(s.hub);
    return s;
  }

  it('create assigns the chosen side; join assigns the remaining side and starts the game', async () => {
    const { repo, service } = svc();
    const creator = await makeUser(repo, 'a@x.com');
    const joiner = await makeUser(repo, 'b@x.com');

    const created = await service.createGame(creator, 'state');
    expect(created.status).toBe('open');
    expect(created.inviteCode).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(created.you?.side).toBe('state');
    expect(created.state).toBeNull();

    const joined = await service.joinGame(joiner, created.inviteCode!);
    expect(joined.status).toBe('active');
    expect(joined.you?.side).toBe('terrorist');
    expect(joined.state).not.toBeNull();
    expect(joined.turn).toBe(1);
    expect(joined.players).toHaveLength(2);

    const players = await repo.getGamePlayers(created.id);
    expect(players.map((p) => p.side).sort()).toEqual(['state', 'terrorist']);
  });

  it('rejects joining twice, joining a full game, and non-players submitting orders', async () => {
    const { repo, service } = svc();
    const creator = await makeUser(repo, 'a@x.com');
    const joiner = await makeUser(repo, 'b@x.com');
    const outsider = await makeUser(repo, 'c@x.com');

    const created = await service.createGame(creator, 'terrorist');
    await service.joinGame(joiner, created.inviteCode!);

    await expect(service.joinGame(outsider, created.inviteCode!)).rejects.toMatchObject({
      statusCode: 409,
    });
    await expect(service.joinGame(joiner, created.inviteCode!)).rejects.toMatchObject({
      statusCode: 409,
    });
    await expect(service.submitOrders(outsider, created.id, { changes: [] })).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('rejects invalid orders with 422 and does NOT trigger resolution', async () => {
    const { repo, service } = svc();
    const creator = await makeUser(repo, 'a@x.com');
    const joiner = await makeUser(repo, 'b@x.com');
    const created = await service.createGame(creator, 'state');
    const gameId = created.id;
    await service.joinGame(joiner, created.inviteCode!);

    // Unknown policy for the side.
    await expect(
      service.submitOrders(creator, gameId, { changes: [{ policy: 'recruitment', delta: 1 }] }),
    ).rejects.toMatchObject({ statusCode: 422 });

    // Too many changes.
    const tooMany: Orders = {
      changes: [
        { policy: 'intelligence', delta: 1 },
        { policy: 'policing', delta: 1 },
        { policy: 'reforms', delta: 1 },
        { policy: 'taxes', delta: 1 },
      ],
    };
    await expect(service.submitOrders(creator, gameId, tooMany)).rejects.toMatchObject({ statusCode: 422 });

    const row = await repo.getCurrentTurn(gameId);
    expect(row?.stateOrders).toBeNull();
    expect(row?.terroristOrders).toBeNull();
    expect(row?.resolvedAt).toBeNull();
  });

  it('resolves when both sides submitted and matches the engine exactly', async () => {
    const { repo, service } = svc();
    const creator = await makeUser(repo, 'a@x.com');
    const joiner = await makeUser(repo, 'b@x.com');
    const created = await service.createGame(creator, 'state');
    const gameId = created.id;
    await service.joinGame(joiner, created.inviteCode!);

    await service.submitOrders(creator, gameId, STATE_MOVE);
    const rowBefore = await repo.getCurrentTurn(gameId);
    expect(rowBefore?.resolvedAt).toBeNull();

    await service.submitOrders(joiner, gameId, TERRORIST_MOVE);

    const row = await repo.getCurrentTurn(gameId);
    // Resolution advanced to turn 2: the current row is the fresh, unresolved one.
    expect(row?.turn).toBe(2);
    expect(row?.stateOrders).toBeNull();
    expect(row?.resolvedAt).toBeNull();

    const turn1 = await repo.getTurn(gameId, 1);
    expect(turn1?.resolvedAt).not.toBeNull();
    expect(turn1?.stateOrders).toEqual(STATE_MOVE);
    expect(turn1?.terroristOrders).toEqual(TERRORIST_MOVE);

    // The stored summary must equal what the engine produces standalone.
    const initial = getInitialState(rulesetV1_3);
    const expected = resolveTurn(rulesetV1_3, initial, STATE_MOVE, TERRORIST_MOVE);
    expect(turn1?.summary?.log).toEqual(expected.log);
    expect(turn1?.summary?.economy).toEqual(expected.economy);
    expect(turn1?.summary?.events).toEqual(expected.events);
    expect(turn1?.stateAfter).toBe(serializeState(expected.state));

    // The new turn validates orders against the post-resolution state.
    expect(row?.stateAfter).toBe(serializeState(expected.state));
  });

  it('mutates indicators correctly across a full 2-turn happy path', async () => {
    const { repo, service } = svc();
    const s = await repo.createUser('s@x.com', 'h', null);
    const t = await repo.createUser('t@x.com', 'h', null);
    const created = await service.createGame(s, 'state');
    await service.joinGame(t, created.inviteCode!);

    await service.submitOrders(s, created.id, STATE_MOVE);
    await service.submitOrders(t, created.id, TERRORIST_MOVE);

    // Turn 2: hold both sides. Compare the final position against the engine.
    await service.submitOrders(s, created.id, stateOrders([]));
    const view = await service.submitOrders(t, created.id, stateOrders([]));

    const initial = getInitialState(rulesetV1_3);
    const after1 = resolveTurn(rulesetV1_3, initial, STATE_MOVE, TERRORIST_MOVE).state;
    const after2 = resolveTurn(rulesetV1_3, after1, { changes: [] }, { changes: [] }).state;
    expect(view.state?.indicators).toEqual(after2.indicators);
    expect(view.state?.levels).toEqual(after2.levels);
    expect(view.state?.budget).toEqual(after2.budget);
    expect(view.state?.bank).toEqual(after2.bank);
    expect(view.turn).toBe(3);
    expect(view.history).toHaveLength(2);

    // Sanity: the chosen moves took effect once active (changes apply the NEXT turn).
    expect(after2.indicators.stability).not.toBe(initial.indicators.stability);
    expect(after2.indicators.mobilization).not.toBe(initial.indicators.mobilization);
  });

  it('rejects a second submit in the same turn and validates the next turn against the new state', async () => {
    const { repo, service } = svc();
    const creator = await makeUser(repo, 'a@x.com');
    const joiner = await makeUser(repo, 'b@x.com');
    const created = await service.createGame(creator, 'state');
    await service.joinGame(joiner, created.inviteCode!);

    await service.submitOrders(creator, created.id, STATE_MOVE);
    await expect(service.submitOrders(creator, created.id, STATE_MOVE)).rejects.toMatchObject({
      statusCode: 409,
    });

    await service.submitOrders(joiner, created.id, TERRORIST_MOVE);
    // Turn 2 row exists and its snapshot validates cleanly with empty orders.
    const row2 = await repo.getCurrentTurn(created.id);
    expect(row2?.turn).toBe(2);
    const state2 = JSON.parse(row2!.stateAfter);
    expect(validateOrders(rulesetV1_3, state2, 'state', { changes: [] })).toEqual([]);
  });
});
