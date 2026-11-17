import { describe, expect, it } from 'vitest';
import { getInitialState, rulesetV1_3, type GameState, type TurnSummary } from '@bot/engine';
import { buildStoreState, derivePhase, emptyDraft } from '../src/online/store';
import type { GameView, ResolvedTurn } from '../src/online/types';

const gameState: GameState = getInitialState(rulesetV1_3);

function resolvedTurn(turn: number): ResolvedTurn {
  const summary: TurnSummary = { state: gameState, log: [], economy: [], events: [`Turn ${turn} resolved.`] };
  return {
    turn,
    orders: { state: { changes: [] }, terrorist: { changes: [] } },
    summary,
    stateAfter: gameState,
  };
}

function makeView(overrides: Partial<GameView>): GameView {
  return {
    id: 'g1',
    rulesetVersion: rulesetV1_3.version,
    status: 'active',
    inviteCode: null,
    result: null,
    turn: 1,
    players: [],
    you: { userId: 'u1', side: 'state', submitted: false, orders: null },
    opponent: null,
    state: gameState,
    history: [],
    ...overrides,
  };
}

describe('online store derivation', () => {
  it('maps view states to phases', () => {
    expect(derivePhase(null, 0).kind).toBe('loading');
    expect(derivePhase(makeView({ status: 'open', state: null }), 0).kind).toBe('open');
    expect(derivePhase(makeView({ status: 'finished' }), 0).kind).toBe('gameover');

    const withHistory = makeView({ history: [resolvedTurn(1)] });
    expect(derivePhase(withHistory, 0).kind).toBe('reveal'); // unacked
    expect(derivePhase(withHistory, 1).kind).toBe('planning'); // acked

    const submitted = makeView({ you: { userId: 'u1', side: 'state', submitted: true, orders: { changes: [] } } });
    expect(derivePhase(submitted, 0).kind).toBe('waiting');
  });

  it('builds a planning StoreState shaped like the hot-seat store', () => {
    const store = buildStoreState(makeView({}), { changes: [{ policy: 'intelligence', delta: 1 }] })!;
    expect(store.phase).toEqual({ kind: 'planning', side: 'state' });
    expect(store.game).toBe(gameState);
    expect(store.draft.changes).toHaveLength(1);
    expect(store.pendingFirstOrders).toBeNull();
    expect(store.revealedOrders).toBeNull();
    expect(store.initialSnapshot.indicators).toEqual(gameState.indicators);
    expect(store.history).toEqual([]);
  });

  it('builds a reveal StoreState with both sides orders', () => {
    const view = makeView({
      history: [
        {
          turn: 1,
          orders: { state: { changes: [{ policy: 'intelligence', delta: 1 }] }, terrorist: { changes: [] } },
          summary: { state: gameState, log: [], economy: [], events: [] },
          stateAfter: gameState,
        },
      ],
    });
    const store = buildStoreState(view, emptyDraft())!;
    expect(store.phase.kind).toBe('reveal');
    expect(store.revealedOrders?.state.changes).toHaveLength(1);
    expect(store.revealedOrders?.terrorist.changes).toHaveLength(0);
    expect(store.history).toHaveLength(1);
    expect(store.draft.changes).toEqual([]);
  });

  it('builds a gameover StoreState with the final result', () => {
    const store = buildStoreState(
      makeView({
        status: 'finished',
        result: { winner: 'draw', reasons: ['mutual agreement to draw'] },
      }),
      emptyDraft(),
    )!;
    expect(store.phase.kind).toBe('gameover');
    expect(store.game.status).toBe('active'); // view.state carries the position; result comes from the view
  });

  it('returns null while the game is still open', () => {
    expect(buildStoreState(makeView({ status: 'open', state: null }), emptyDraft())).toBeNull();
  });
});
