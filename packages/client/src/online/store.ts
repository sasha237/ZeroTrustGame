import { getInitialState, rulesetV1_3, type Orders, type Side } from '@bot/engine';
import type { StoreState, TurnRecord } from '../game/store';
import type { GameView, ResolvedTurn } from './types';

export const RULESET = rulesetV1_3;

/** Which screen the online game should show, derived from the server view. */
export type OnlinePhase =
  | { kind: 'loading' }
  | { kind: 'open' } // waiting for an opponent to join
  | { kind: 'planning' }
  | { kind: 'waiting' } // orders submitted, opponent still planning
  | { kind: 'reveal' }
  | { kind: 'gameover' };

/**
 * Derives the UI phase. `ackedTurn` is the last resolved turn the local player has
 * dismissed through the reveal screen; anything newer resolves to 'reveal'.
 */
export function derivePhase(view: GameView | null, ackedTurn: number): OnlinePhase {
  if (!view) return { kind: 'loading' };
  if (view.status === 'open') return { kind: 'open' };
  if (view.status === 'finished') return { kind: 'gameover' };
  const lastResolved = view.history.length > 0 ? view.history[view.history.length - 1]!.turn : 0;
  if (lastResolved > ackedTurn) return { kind: 'reveal' };
  if (view.you?.submitted) return { kind: 'waiting' };
  return { kind: 'planning' };
}

export function toTurnRecord(resolved: ResolvedTurn): TurnRecord {
  return {
    turn: resolved.turn,
    indicators: { ...resolved.stateAfter.indicators },
    budget: { ...resolved.stateAfter.budget },
    bank: { ...resolved.stateAfter.bank },
    log: resolved.summary.log,
    events: resolved.summary.events,
    economy: resolved.summary.economy,
  };
}

function initialSnapshot(): TurnRecord {
  const game = getInitialState(RULESET);
  return {
    turn: 1,
    indicators: { ...game.indicators },
    budget: { ...game.budget },
    bank: { ...game.bank },
    log: [],
    events: [],
    economy: [],
  };
}

/**
 * Builds the hot-seat StoreState shape from the server view so existing components
 * (Graph, Rail, BottomPanel, RevealScreen, GameOverScreen) consume it unchanged.
 * Returns null while the game has not started (status 'open').
 */
export function buildStoreState(view: GameView, draft: Orders): StoreState | null {
  if (!view.state) return null;
  const history = view.history.map(toTurnRecord);
  const last = history[history.length - 1] ?? null;
  const base = {
    game: view.state,
    pendingFirstOrders: null,
    initialSnapshot: initialSnapshot(),
    history,
  };
  if (view.status === 'finished') {
    return { ...base, phase: { kind: 'gameover' }, draft: emptyDraft(), revealedOrders: null };
  }
  if (last) {
    const resolved = view.history[view.history.length - 1]!;
    return {
      ...base,
      phase: { kind: 'reveal', summary: resolved.summary },
      draft: emptyDraft(),
      revealedOrders: resolved.orders,
    };
  }
  const side: Side = view.you?.side ?? 'state';
  return {
    ...base,
    phase: { kind: 'planning', side },
    draft,
    revealedOrders: null,
  };
}

export function emptyDraft(): Orders {
  return { changes: [] };
}

/**
 * Replay (A-21): the store as of end-of-turn `turn`. History is sliced to that turn
 * (Rail sparklines/feed show the position through T), the game is the resolved
 * state_after, and both sides' revealed orders for T are attached. Read-only phase.
 */
export function buildReplayStoreState(view: GameView, turn: number): StoreState | null {
  const resolved = view.history.find((h) => h.turn === turn);
  if (!resolved) return null;
  const history = view.history.filter((h) => h.turn <= turn).map(toTurnRecord);
  return {
    phase: { kind: 'readonly' },
    game: resolved.stateAfter,
    draft: emptyDraft(),
    pendingFirstOrders: null,
    revealedOrders: resolved.orders,
    initialSnapshot: initialSnapshot(),
    history,
  };
}

/** The latest resolved turn number, or 0 when no turn has resolved yet. */
export function lastResolvedTurn(view: GameView): number {
  return view.history.length > 0 ? view.history[view.history.length - 1]!.turn : 0;
}
