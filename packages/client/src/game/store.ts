import {
  getInitialState,
  previewOrders,
  resolveTurn,
  rulesetV1_3,
  type EconomyLine,
  type EffectLogEntry,
  type GameState,
  type Indicator,
  type Orders,
  type OrdersPreview,
  type PolicyChange,
  type Side,
  type TurnSummary,
} from '@bot/engine';

export const RULESET = rulesetV1_3;

export type Phase =
  | { kind: 'planning'; side: Side }
  | { kind: 'handoff'; nextSide: Side }
  | { kind: 'reveal'; summary: TurnSummary }
  | { kind: 'gameover' }
  /** Read-only rendering (observer mode / replay scrubbing); never produced by the hot-seat reducer. */
  | { kind: 'readonly' };

/** One resolved turn, accumulated for sparklines and the events feed. */
export interface TurnRecord {
  turn: number;
  indicators: Record<Indicator, number>;
  budget: Record<Side, number>;
  bank: Record<Side, number>;
  log: EffectLogEntry[];
  events: string[];
  economy: EconomyLine[];
}

export interface StoreState {
  phase: Phase;
  game: GameState;
  /** The acting side's in-progress orders (planning phase only). */
  draft: Orders;
  /**
   * Orders already locked in by the side that submitted first. Kept ONLY inside
   * this store (never passed to components) so the other side cannot see them
   * until the reveal phase. Null outside the window between first and second submit.
   */
  pendingFirstOrders: Orders | null;
  /** Both sides' orders, exposed only during the reveal phase. */
  revealedOrders: Record<Side, Orders> | null;
  /** Snapshot of the position before turn 1 (sparkline base point). */
  initialSnapshot: TurnRecord;
  /** One entry per resolved turn. */
  history: TurnRecord[];
}

function snapshotOf(
  turn: number,
  summary: Pick<TurnSummary, 'log' | 'events' | 'economy'>,
  game: GameState,
): TurnRecord {
  return {
    turn,
    indicators: { ...game.indicators },
    budget: { ...game.budget },
    bank: { ...game.bank },
    log: summary.log,
    events: summary.events,
    economy: summary.economy,
  };
}

function emptyDraft(): Orders {
  return { changes: [] };
}

export function initStore(): StoreState {
  const game = getInitialState(RULESET);
  return {
    phase: { kind: 'planning', side: 'state' },
    game,
    draft: emptyDraft(),
    pendingFirstOrders: null,
    revealedOrders: null,
    initialSnapshot: snapshotOf(1, { log: [], events: [], economy: [] }, game),
    history: [],
  };
}

/**
 * Stepper semantics for the draft: clicking the stepper for the opposite direction
 * cancels the most recent pending step on that policy (net-zero). Appends otherwise.
 * The draft may exceed the per-turn change cap — previewOrders then reports the
 * "too many changes" error and the UI disables submit (FR-11).
 */
export function draftWithChange(
  changes: PolicyChange[],
  change: PolicyChange,
  _maxChanges: number,
): PolicyChange[] {
  for (let i = changes.length - 1; i >= 0; i--) {
    if (changes[i].policy === change.policy) {
      if (changes[i].delta !== change.delta) {
        return [...changes.slice(0, i), ...changes.slice(i + 1)];
      }
      break;
    }
  }
  return [...changes, change];
}

/** Net pending delta per policy in a draft. */
export function pendingDeltas(orders: Orders): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of orders.changes) out[c.policy] = (out[c.policy] ?? 0) + c.delta;
  return out;
}

export type Action =
  | { type: 'reset' }
  | { type: 'addChange'; change: PolicyChange }
  | { type: 'toggleDraw' }
  | { type: 'submit' }
  | { type: 'confirmHandoff' }
  | { type: 'finishReveal' };

export function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case 'reset':
      return initStore();
    case 'addChange': {
      if (state.phase.kind !== 'planning') return state;
      return {
        ...state,
        draft: {
          ...state.draft,
          changes: draftWithChange(
            state.draft.changes,
            action.change,
            RULESET.maxPolicyChangesPerTurn,
          ),
        },
      };
    }
    case 'toggleDraw': {
      if (state.phase.kind !== 'planning') return state;
      return { ...state, draft: { ...state.draft, agreeToDraw: !state.draft.agreeToDraw } };
    }
    case 'submit': {
      if (state.phase.kind !== 'planning') return state;
      const side = state.phase.side;
      const orders: Orders = {
        changes: state.draft.changes,
        agreeToDraw: state.draft.agreeToDraw ? true : undefined,
      };
      if (side === 'state') {
        // Lock in; hide behind the handoff screen until the terrorist submits.
        return {
          ...state,
          pendingFirstOrders: orders,
          draft: emptyDraft(),
          phase: { kind: 'handoff', nextSide: 'terrorist' },
        };
      }
      const stateOrders = state.pendingFirstOrders ?? { changes: [] };
      const summary = resolveTurn(RULESET, state.game, stateOrders, orders);
      return {
        ...state,
        game: summary.state,
        history: [...state.history, snapshotOf(state.game.turn, summary, summary.state)],
        pendingFirstOrders: null,
        revealedOrders: { state: stateOrders, terrorist: orders },
        draft: emptyDraft(),
        phase: { kind: 'reveal', summary },
      };
    }
    case 'confirmHandoff': {
      if (state.phase.kind !== 'handoff') return state;
      return { ...state, phase: { kind: 'planning', side: state.phase.nextSide } };
    }
    case 'finishReveal': {
      if (state.phase.kind !== 'reveal') return state;
      if (state.game.status === 'finished') {
        return { ...state, phase: { kind: 'gameover' } };
      }
      return {
        ...state,
        phase: { kind: 'planning', side: 'state' },
        draft: emptyDraft(),
        revealedOrders: null,
      };
    }
    default:
      return state;
  }
}

// --- Selectors (the only data components may read) ---

export function selectActingSide(s: StoreState): Side | null {
  return s.phase.kind === 'planning' ? s.phase.side : null;
}

/** The side's own draft — only while that side is actively planning. */
export function selectDraft(s: StoreState, side: Side): Orders | null {
  return s.phase.kind === 'planning' && s.phase.side === side ? s.draft : null;
}

/**
 * Both sides' locked-in orders. Returns null until the reveal phase: this is the
 * privacy boundary — during the opponent's planning the first side's orders are
 * not reachable through any selector.
 */
export function selectRevealedOrders(s: StoreState): Record<Side, Orders> | null {
  return s.phase.kind === 'reveal' ? s.revealedOrders : null;
}

/** Live validation + projection for the acting side's draft (FR-11). */
export function selectPreview(s: StoreState): OrdersPreview | null {
  const side = selectActingSide(s);
  if (!side) return null;
  return previewOrders(RULESET, s.game, side, s.draft);
}

/** Full indicator series: initial snapshot + one point per resolved turn. */
export function selectIndicatorHistory(s: StoreState, indicator: Indicator): number[] {
  return [
    s.initialSnapshot.indicators[indicator],
    ...s.history.map((h) => h.indicators[indicator]),
  ];
}
