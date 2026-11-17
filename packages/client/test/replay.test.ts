import { describe, expect, it } from 'vitest';
import { getInitialState, rulesetV1_3, type GameState, type TurnSummary } from '@bot/engine';
import { buildReplayStoreState, lastResolvedTurn } from '../src/online/store';
import { observeHash, parseHash } from '../src/online/route';
import type { GameView, ResolvedTurn } from '../src/online/types';

const state: GameState = getInitialState(rulesetV1_3);

function turn(turnNo: number, stability: number): ResolvedTurn {
  const stateAfter: GameState = { ...state, turn: turnNo + 1, indicators: { ...state.indicators, stability } };
  const summary: TurnSummary = { state: stateAfter, log: [], economy: [], events: [`Turn ${turnNo} resolved.`] };
  return {
    turn: turnNo,
    orders: {
      state: { changes: turnNo === 1 ? [{ policy: 'intelligence', delta: 1 }] : [] },
      terrorist: { changes: [] },
    },
    summary,
    stateAfter,
  };
}

function view(history: ResolvedTurn[]): GameView {
  return {
    id: 'g1',
    rulesetVersion: rulesetV1_3.version,
    status: 'active',
    inviteCode: null,
    result: null,
    turn: history.length + 1,
    players: [],
    you: null,
    opponent: null,
    state: history.length > 0 ? history[history.length - 1]!.stateAfter : state,
    history,
  };
}

describe('hash routing', () => {
  it('parses observer and reset routes and falls back to home', () => {
    expect(parseHash('#/observe/ABCD2345')).toEqual({ kind: 'observe', token: 'ABCD2345' });
    expect(parseHash('#/reset/RSTTOKEN1')).toEqual({ kind: 'reset', token: 'RSTTOKEN1' });
    expect(parseHash('')).toEqual({ kind: 'home' });
    expect(parseHash('#/whatever')).toEqual({ kind: 'home' });
    expect(parseHash('#/observe/')).toEqual({ kind: 'home' });
    expect(observeHash('ABCD2345')).toBe('#/observe/ABCD2345');
  });
});

describe('replay store (A-21)', () => {
  it('reports the last resolved turn', () => {
    expect(lastResolvedTurn(view([]))).toBe(0);
    expect(lastResolvedTurn(view([turn(1, 80), turn(2, 85)]))).toBe(2);
  });

  it('builds a read-only store positioned at the end of turn T', () => {
    const v = view([turn(1, 80), turn(2, 85)]);
    const store = buildReplayStoreState(v, 1)!;
    expect(store.phase).toEqual({ kind: 'readonly' });
    expect(store.game.turn).toBe(2); // state_after of turn 1 enters turn 2
    expect(store.game.indicators.stability).toBe(80);
    expect(store.history).toHaveLength(1);
    expect(store.revealedOrders!.state.changes).toHaveLength(1);
    expect(store.revealedOrders!.terrorist.changes).toHaveLength(0);
  });

  it('slices history and orders per scrubbed turn', () => {
    const v = view([turn(1, 80), turn(2, 85)]);
    const store = buildReplayStoreState(v, 2)!;
    expect(store.game.indicators.stability).toBe(85);
    expect(store.history).toHaveLength(2);
    expect(store.revealedOrders!.state.changes).toHaveLength(0);
  });

  it('returns null for a turn that has not resolved', () => {
    const v = view([turn(1, 80)]);
    expect(buildReplayStoreState(v, 2)).toBeNull();
    expect(buildReplayStoreState(v, 0)).toBeNull();
  });
});
