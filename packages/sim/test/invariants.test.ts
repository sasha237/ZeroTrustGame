import { describe, expect, it } from 'vitest';
import { getInitialState, rulesetV1, rulesetV1_3, type GameState, type TurnSummary } from '@bot/engine';
import { assertTurnInvariants } from '../src/invariants.js';
import { lengthHistogram } from '../src/report.js';
import type { GameRecord } from '../src/runner.js';

const ruleset = rulesetV1;
const base = getInitialState(ruleset);

function summaryOf(state: GameState): TurnSummary {
  return { state, log: [], economy: [], events: [] };
}

function check(after: GameState, before: GameState = { ...base, turn: base.turn - 1 }, summary: TurnSummary = summaryOf(after)) {
  return assertTurnInvariants(ruleset, before, summary, after, { game: 0, turn: 1, seed: 1 });
}

describe('turn invariants (A-22)', () => {
  /** A post-resolution state: danger counters already evaluated (mobilization 0 is in-band → 0). */
  function consistentState(): GameState {
    const s: GameState = structuredClone(base);
    s.danger.terrorist.mobilization = { critical: 0, sustained: 0 };
    return s;
  }

  it('passes a real resolved state', () => {
    expect(check(consistentState())).toEqual({ ok: true });
  });

  it('catches out-of-range and non-integer indicators', () => {
    const bad: GameState = { ...base, indicators: { ...base.indicators, stability: 101 } };
    expect(check(bad).ok).toBe(false);
    const bad2: GameState = { ...base, indicators: { ...base.indicators, mobilization: 10.5 } };
    const result = check(bad2);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failures.map((f) => f.check)).toContain('indicator-integer');
  });

  it('catches NaN money and out-of-range policy levels', () => {
    const nanMoney: GameState = { ...base, budget: { ...base.budget, state: NaN } };
    expect(check(nanMoney).ok).toBe(false);
    const badLevel: GameState = structuredClone(base);
    badLevel.levels.state.intelligence = 99;
    const result = check(badLevel);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failures.map((f) => f.check)).toContain('level-range');
  });

  it('catches danger-counter/band mismatches (ANSWERS3 F-5)', () => {
    const good = consistentState();
    expect(check(good).ok).toBe(true);
    const bad: GameState = structuredClone(good);
    // mobilization 0 is inside the critical band, so the counter must be >= 0, not -1.
    bad.danger.terrorist.mobilization = { critical: -1, sustained: -1 };
    const result = check(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failures.map((f) => f.check)).toContain('danger-critical-counter');
      expect(result.failures.map((f) => f.check)).toContain('danger-sustained-counter');
    }
  });

  it('catches broken bank math and wrong finish reasons', () => {
    const good = consistentState();
    const summary: TurnSummary = {
      state: good,
      log: [],
      economy: [
        { side: 'state', spend: 10, income: 100, budgetAfter: 100, bankAfter: 90, insolvent: false },
      ],
      events: [],
    };
    // bankAfter should be bank(100) + budget(100) - spend(10) = 190.
    const result = check(good, base, summary);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failures.map((f) => f.check)).toContain('bank-math');

    const finished: GameState = {
      ...consistentState(),
      status: 'finished',
      result: { winner: 'state', reasons: ['something unknown happened'] },
    };
    const r2 = check(finished);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.failures.map((f) => f.check)).toContain('reason-unknown');

    const limit: GameState = {
      ...consistentState(),
      status: 'finished',
      result: { winner: 'state', reasons: ['turn limit 50 reached'] },
    };
    const r3 = check(limit);
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.failures.map((f) => f.check)).toContain('turn-limit-draw');

    // But a simultaneous decisive loss takes precedence over the turn cap (frozen behavior).
    const limitWithLoss: GameState = {
      ...consistentState(),
      status: 'finished',
      result: {
        winner: 'terrorist',
        reasons: ['state bankrupt (spend 120 > budget 0 + bank 100)', 'turn limit 50 reached'],
      },
    };
    expect(check(limitWithLoss).ok).toBe(true);
  });
});

describe('turn-limit judge invariants (ruleset v1.3)', () => {
  const rs13 = rulesetV1_3;
  const before13 = getInitialState(rs13);
  const ctx = { game: 0, turn: 1, seed: 1 };
  // initial margins: state 75+75=150 vs terrorist 100+35=135.
  function judgedState(winner: 'state' | 'terrorist' | 'draw'): GameState {
    return {
      ...structuredClone(before13),
      status: 'finished',
      result: { winner, reasons: ['turn limit 50 reached (danger-indicator margin 150 vs 135)'] },
    };
  }

  it('accepts a judge result that matches the recomputed margin', () => {
    const after = judgedState('state');
    expect(assertTurnInvariants(rs13, before13, summaryOf(after), after, ctx)).toEqual({ ok: true });
  });

  it('rejects a judge result that contradicts the margin', () => {
    const after = judgedState('terrorist');
    const result = assertTurnInvariants(rs13, before13, summaryOf(after), after, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failures.map((f) => f.check)).toContain('judge-mismatch');
  });
});

describe('report histogram', () => {  it('buckets lengths and scales the bar', () => {
    const records = [
      { turns: 1 }, { turns: 2 }, { turns: 3 }, { turns: 7 }, { turns: 50 },
    ] as GameRecord[];
    const lines = lengthHistogram(records);
    expect(lines[0]).toContain('1-5');
    expect(lines[0]).toContain('3 (60.0%)');
    expect(lines[1]).toContain('6-10');
    expect(lines[1]).toContain('1 (20.0%)');
    expect(lines[lines.length - 1]).toContain('46-50');
  });
});
