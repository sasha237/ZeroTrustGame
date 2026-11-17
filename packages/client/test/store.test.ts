import { describe, expect, it } from 'vitest';
import type { Orders, PolicyChange, Side } from '@bot/engine';
import {
  initStore,
  reducer,
  selectDraft,
  selectIndicatorHistory,
  selectPreview,
  selectRevealedOrders,
  type StoreState,
} from '../src/game/store';

const up = (policy: string): PolicyChange => ({ policy, delta: 1 });

/** Play one full hot-seat turn through the phase machine. */
function playTurn(
  store: StoreState,
  stateChanges: PolicyChange[],
  terroristChanges: PolicyChange[],
  opts: { stateDraw?: boolean; terroristDraw?: boolean } = {},
): StoreState {
  expect(store.phase.kind).toBe('planning');
  expect((store.phase as { side: Side }).side).toBe('state');
  let s = store;
  for (const c of stateChanges) s = reducer(s, { type: 'addChange', change: c });
  if (opts.stateDraw) s = reducer(s, { type: 'toggleDraw' });
  s = reducer(s, { type: 'submit' });
  expect(s.phase.kind).toBe('handoff');

  s = reducer(s, { type: 'confirmHandoff' });
  expect(s.phase.kind).toBe('planning');
  expect((s.phase as { side: Side }).side).toBe('terrorist');

  for (const c of terroristChanges) s = reducer(s, { type: 'addChange', change: c });
  if (opts.terroristDraw) s = reducer(s, { type: 'toggleDraw' });
  s = reducer(s, { type: 'submit' });
  expect(s.phase.kind).toBe('reveal');
  return s;
}

/** Complete the reveal and return to the next turn's planning (or gameover). */
function finishTurn(s: StoreState): StoreState {
  expect(s.phase.kind).toBe('reveal');
  return reducer(s, { type: 'finishReveal' });
}

function playFullTurn(store: StoreState, sc: PolicyChange[], tc: PolicyChange[]): StoreState {
  return finishTurn(playTurn(store, sc, tc));
}

describe('hot-seat phase machine + order privacy (FR-17)', () => {
  it('walks planning → handoff → planning(other) → reveal → planning(next turn)', () => {
    let s = initStore();
    expect(s.phase).toEqual({ kind: 'planning', side: 'state' });

    s = reducer(s, { type: 'addChange', change: up('policing') });
    const draft = selectDraft(s, 'state');
    expect(draft?.changes).toEqual([up('policing')]);

    // First side submits → handoff. Orders must not leak to selectors.
    s = reducer(s, { type: 'submit' });
    expect(s.phase.kind).toBe('handoff');
    expect(selectRevealedOrders(s)).toBeNull();
    expect(selectDraft(s, 'state')).toBeNull(); // state no longer acting

    s = reducer(s, { type: 'confirmHandoff' });
    expect(s.phase).toEqual({ kind: 'planning', side: 'terrorist' });
    // Privacy: while the terrorist plans, the state's locked-in orders are
    // unreachable — the only order-shaped data exposed is the terrorist's own draft.
    expect(selectDraft(s, 'state')).toBeNull();
    expect(selectRevealedOrders(s)).toBeNull();
    expect(selectDraft(s, 'terrorist')?.changes).toEqual([]);

    s = reducer(s, { type: 'addChange', change: up('propaganda') });
    s = reducer(s, { type: 'submit' });
    expect(s.phase.kind).toBe('reveal');
    const revealed = selectRevealedOrders(s);
    expect(revealed?.state.changes).toEqual([up('policing')]);
    expect(revealed?.terrorist.changes).toEqual([up('propaganda')]);

    s = reducer(s, { type: 'finishReveal' });
    expect(s.phase).toEqual({ kind: 'planning', side: 'state' });
    expect(s.game.turn).toBe(2);
    expect(s.game.levels.state.policing).toBe(1);
    expect(s.game.levels.terrorist.propaganda).toBe(1);
  });

  it('keeps a draft private per side and drops it after submit', () => {
    let s = initStore();
    s = reducer(s, { type: 'addChange', change: up('counterNarrative') });
    s = reducer(s, { type: 'submit' });
    // During the handoff nobody is planning; the fresh draft appears when the
    // terrorist's planning phase opens.
    expect(selectDraft(s, 'terrorist')).toBeNull();
    s = reducer(s, { type: 'confirmHandoff' });
    expect(selectDraft(s, 'terrorist')?.changes).toEqual([]);
    expect(s.draft.changes).toEqual([]);
  });

  it('rejects actions outside their phase', () => {
    let s = initStore();
    s = reducer(s, { type: 'confirmHandoff' });
    expect(s.phase.kind).toBe('planning'); // no-op
    s = reducer(s, { type: 'finishReveal' });
    expect(s.phase.kind).toBe('planning'); // no-op
  });
});

describe('validation via previewOrders (FR-11)', () => {
  it('reports errors for over-budget orders and blocks nothing at 3 changes', () => {
    let s = initStore();
    // reforms L3 upkeep 80 — affordable (funds 300).
    for (let i = 0; i < 3; i++) s = reducer(s, { type: 'addChange', change: up('reforms') });
    expect(selectPreview(s)?.errors).toEqual([]);
    // A 4th change exceeds the 3-change rule.
    s = reducer(s, { type: 'addChange', change: up('policing') });
    expect(selectPreview(s)?.errors.join(' ')).toMatch(/too many changes/);
  });
});

describe('full games through the store', () => {
  // Script: terrorist builds propaganda/safeHavens/attacks to L2 over two turns,
  // holding them. With v1.3 same-turn timing each level performs the turn it is
  // ordered: attacks L1 (stability -25) drops stability to 50 on turn 1, L2 (-35)
  // to 15 on turn 2, to 0 on turn 3 (critical grace), and the band persists into
  // turn 4 -> State loses.
  it('plays to a danger-band loss (state stability critical)', () => {
    let s = initStore();
    s = playFullTurn(s, [], [up('propaganda'), up('safeHavens'), up('attacks')]);
    expect(s.game.indicators.stability).toBe(50); // same-turn effect
    s = playFullTurn(s, [], [up('propaganda'), up('safeHavens'), up('attacks')]);
    expect(s.game.indicators.stability).toBe(15);
    s = playFullTurn(s, [], []);
    expect(s.phase.kind).toBe('planning');
    expect(s.game.indicators.stability).toBe(0); // critical grace

    s = playTurn(s, [], []);
    expect(s.game.status).toBe('finished');
    s = finishTurn(s);
    expect(s.phase.kind).toBe('gameover');
    expect(s.game.result?.winner).toBe('terrorist');
    expect(s.game.result?.reasons.join(' ')).toMatch(/state stability/);
  });

  // Script: state ramps counterNarrative/intelligence/policing to L3 (upkeep 115 >
  // income 100), then reforms to L3 on turn 4 (+80 upkeep, +20 legitimacy to offset
  // the terrorist's socialServices legitimacy decay). Total upkeep 195/turn drains
  // the bank within a few turns → bankruptcy long before any danger band fires.
  // Terrorist defends with socialServices/operationalSecurity L2 (mobilization and
  // security stay out of the danger bands) plus safeHavens L2; solvent throughout.
  it('plays to a bankruptcy loss (state)', () => {
    let s = initStore();
    const terrorSetup = [up('socialServices'), up('safeHavens'), up('operationalSecurity')];
    s = playFullTurn(s, [up('counterNarrative'), up('counterNarrative'), up('counterNarrative')], terrorSetup);
    s = playFullTurn(s, [up('intelligence'), up('intelligence'), up('intelligence')], terrorSetup);
    s = playFullTurn(s, [up('policing'), up('policing'), up('policing')], []);
    s = playFullTurn(s, [up('reforms'), up('reforms'), up('reforms')], []);
    let guard = 0;
    while (s.phase.kind !== 'gameover' && guard++ < 60) {
      s = playFullTurn(s, [], []);
    }
    expect(s.phase.kind).toBe('gameover');
    expect(s.game.result?.winner).toBe('terrorist');
    expect(s.game.result?.reasons.join(' ')).toMatch(/state bankrupt/);
    expect(s.game.result?.reasons.join(' ')).not.toMatch(/turn limit/);
  });

  it('ends in a draw when both sides propose it', () => {
    let s = initStore();
    s = playTurn(s, [], [], { stateDraw: true, terroristDraw: true });
    expect(s.game.status).toBe('finished');
    s = finishTurn(s);
    expect(s.phase.kind).toBe('gameover');
    expect(s.game.result?.winner).toBe('draw');
    expect(s.game.result?.reasons.join(' ')).toMatch(/mutual agreement/);
  });

  // Script: state counterNarrative L3 pins legitimacy at 100 against the terrorist's
  // propaganda; terrorist propaganda L3 lifts mobilization to 100. No indicator ever
  // reaches a danger band, so the game runs to the 50-turn limit, where the v1.3 judge
  // decides it: state 100+75=175 vs terrorist 100+100=200 -> judged terrorist win.
  it('ends with a judged terrorist win at the turn limit (50 turns)', () => {
    let s = initStore();
    s = playFullTurn(
      s,
      [up('counterNarrative'), up('counterNarrative'), up('counterNarrative')],
      [up('propaganda'), up('propaganda')],
    );
    s = playFullTurn(s, [], [up('propaganda')]);
    let guard = 0;
    while (s.phase.kind !== 'gameover' && guard++ < 60) {
      s = playFullTurn(s, [], []);
    }
    expect(s.phase.kind).toBe('gameover');
    expect(s.game.result?.winner).toBe('terrorist');
    expect(s.game.result?.reasons.join(' ')).toMatch(/turn limit 50/);
    expect(s.game.result?.reasons.join(' ')).toMatch(/danger-indicator margin 175 vs 200/);
    expect(s.game.turn).toBe(50);
  });

  it('supports a double-loss draw (both sides breach danger on the same turn)', () => {
    // Turn 1: state raises killCapture/emergencyLegislation to L1, terrorist raises
    // attacks to L1. Turn 2: both state policies -> L2. v1.3 same-turn timing: each
    // level performs the turn it is ordered (emergency legislation costs no budget).
    // Stability (attacks -25/-35 per turn): 50 (T1) -> 15 (T2) -> 0 (T3, critical
    //   grace) -> 0 (T4, 2nd hit -> loss).
    // Security (killCapture -10/-30 + emergency -10/-20 + attacks self-harm -3):
    //   77 (T1) -> 24 (T2) -> 0 (T3, grace) -> 0 (T4, 2nd hit -> loss).
    // Both sides' reasons fire in the same resolution -> winner 'draw'.
    let s = initStore();
    s = playFullTurn(s, [up('killCapture'), up('emergencyLegislation')], [up('attacks')]);
    s = playFullTurn(s, [up('killCapture'), up('emergencyLegislation')], []);
    s = playFullTurn(s, [], []);
    expect(s.phase.kind).toBe('planning');
    s = playTurn(s, [], []);
    expect(s.game.status).toBe('finished');
    s = finishTurn(s);
    expect(s.phase.kind).toBe('gameover');
    expect(s.game.result?.winner).toBe('draw');
    const reasons = s.game.result?.reasons.join(' ') ?? '';
    expect(reasons).toMatch(/state stability/);
    expect(reasons).toMatch(/terrorist security/);
  });
});

describe('history accumulation (sparklines)', () => {
  it('records exactly one history entry per resolved turn', () => {
    let s = initStore();
    expect(s.history).toHaveLength(0);
    // Terrorist propaganda keeps mobilization out of the danger bands.
    s = playFullTurn(s, [], [up('propaganda'), up('propaganda')]);
    expect(s.history).toHaveLength(1);
    s = playFullTurn(s, [], [up('propaganda')]);
    s = playFullTurn(s, [], []);
    expect(s.history).toHaveLength(3);
    for (const ind of ['stability', 'legitimacy', 'security', 'mobilization'] as const) {
      // initial snapshot + one point per resolved turn
      expect(selectIndicatorHistory(s, ind)).toHaveLength(4);
    }
  });
});

describe('draft stepper semantics', () => {
  it('cancelling steps nets to zero; extra changes surface a validation error', () => {
    let s = initStore();
    const add = (c: PolicyChange) => (s = reducer(s, { type: 'addChange', change: c }));
    add(up('policing'));
    add(up('policing'));
    expect(selectDraft(s, 'state')?.changes).toHaveLength(2);
    add({ policy: 'policing', delta: -1 });
    expect(selectDraft(s, 'state')?.changes).toHaveLength(1);
    add({ policy: 'policing', delta: -1 });
    expect(selectDraft(s, 'state')?.changes).toHaveLength(0);
    add(up('policing'));
    add(up('intelligence'));
    add(up('reforms'));
    add(up('taxes')); // 4th change — kept, but the engine rejects it
    expect(selectDraft(s, 'state')?.changes).toHaveLength(4);
    expect(selectPreview(s)?.errors.join(' ')).toMatch(/too many changes/);
  });
});

// Type-level guard: Orders shape stays engine-compatible.
const _orders: Orders = { changes: [], agreeToDraw: true };
void _orders;
