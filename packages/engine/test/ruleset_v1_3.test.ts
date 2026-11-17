import { describe, expect, it } from 'vitest';
import {
  getInitialState,
  resolveTurn,
  rulesetV1,
  rulesetV1_3,
  type Orders,
  type Ruleset,
} from '../src/index.js';

const EMPTY: Orders = { changes: [] };

/** v1.3 with a short turn limit so judged endings are reachable in a test. */
function shortLimit(extra?: (rs: Ruleset) => void): Ruleset {
  const rs = structuredClone(rulesetV1_3);
  rs.turnLimit = 1;
  extra?.(rs);
  return rs;
}

describe('ruleset v1.3.0 data', () => {
  it('is versioned and carries the balance delta over v1.2.0', () => {
    expect(rulesetV1_3.version).toBe('1.3.0');
    expect(rulesetV1.version).toBe('1.2.0'); // frozen, still exported
    expect(rulesetV1_3.turnLimitJudge).toBe('danger-indicator-margin');
    expect(rulesetV1_3.initial.indicators.mobilization).toBe(35);
    expect(rulesetV1.initial.indicators.mobilization).toBe(0);

    const eff = (side: 'state' | 'terrorist', id: string, level: number, target: string) =>
      rulesetV1_3.policies[side].find((p) => p.id === id)!.effects[level]!.find((e) => e.target === target)!.delta;
    // state security-attack moderation
    expect(eff('state', 'killCapture', 1, 'security')).toBe(-10);
    expect(eff('state', 'killCapture', 2, 'security')).toBe(-30);
    expect(eff('state', 'killCapture', 3, 'security')).toBe(-45);
    expect(eff('state', 'emergencyLegislation', 1, 'security')).toBe(-10);
    expect(eff('state', 'emergencyLegislation', 2, 'security')).toBe(-20);
    // attacks upkeep discount + damage softening
    expect(eff('terrorist', 'attacks', 1, 'terroristBudget')).toBe(-8);
    expect(eff('terrorist', 'attacks', 5, 'terroristBudget')).toBe(-80);
    expect(eff('terrorist', 'attacks', 1, 'stability')).toBe(-25);
    expect(eff('terrorist', 'attacks', 5, 'stability')).toBe(-110);
    expect(eff('terrorist', 'attacks', 5, 'legitimacy')).toBe(-20);
  });

  it('differs from v1.2.0 only in the changelog deltas', () => {
    const revert: [side: 'state' | 'terrorist', id: string, level: number, target: string, delta: number][] = [
      ['state', 'killCapture', 1, 'security', -15],
      ['state', 'killCapture', 2, 'security', -40],
      ['state', 'killCapture', 3, 'security', -60],
      ['state', 'emergencyLegislation', 1, 'security', -15],
      ['state', 'emergencyLegislation', 2, 'security', -30],
      ['terrorist', 'attacks', 1, 'terroristBudget', -10],
      ['terrorist', 'attacks', 2, 'terroristBudget', -25],
      ['terrorist', 'attacks', 3, 'terroristBudget', -45],
      ['terrorist', 'attacks', 4, 'terroristBudget', -70],
      ['terrorist', 'attacks', 5, 'terroristBudget', -100],
      ['terrorist', 'attacks', 1, 'stability', -30],
      ['terrorist', 'attacks', 2, 'stability', -45],
      ['terrorist', 'attacks', 3, 'stability', -60],
      ['terrorist', 'attacks', 4, 'stability', -120],
      ['terrorist', 'attacks', 5, 'stability', -145],
      ['terrorist', 'attacks', 1, 'legitimacy', -5],
      ['terrorist', 'attacks', 2, 'legitimacy', -10],
      ['terrorist', 'attacks', 3, 'legitimacy', -15],
      ['terrorist', 'attacks', 4, 'legitimacy', -20],
      ['terrorist', 'attacks', 5, 'legitimacy', -25],
    ];
    const stripped = (rs: Ruleset) => {
      const clone = structuredClone(rs) as Partial<Ruleset>;
      delete clone.version;
      delete clone.turnLimitJudge;
      delete clone.effectsTiming;
      delete clone.notes;
      clone.initial!.indicators.mobilization = 0;
      return clone;
    };
    const v13 = structuredClone(rulesetV1_3);
    for (const [side, id, level, target, delta] of revert) {
      const effect = v13.policies[side].find((p) => p.id === id)!.effects[level]!.find((e) => e.target === target)!;
      effect.delta = delta;
    }
    expect(stripped(v13)).toEqual(stripped(rulesetV1));
  });
});

describe('same-turn effect timing (v1.3)', () => {
  it('applies effects and upkeep at the end of the turn the change is ordered in', () => {
    const rs = structuredClone(rulesetV1_3);
    const summary = resolveTurn(rs, getInitialState(rs), EMPTY, { changes: [{ policy: 'recruitment', delta: 1 }] });
    const s = summary.state;
    expect(s.levels.terrorist.recruitment).toBe(1);
    expect(s.indicators.mobilization).toBe(55); // 35 + 20, same turn
    expect(s.indicators.security).toBe(90); // 100 - 10, same turn
    const eco = summary.economy.find((e) => e.side === 'terrorist')!;
    expect(eco.spend).toBe(10); // upkeep charged this turn
    expect(s.budget.terrorist).toBe(100); // income for next turn
    expect(s.bank.terrorist).toBe(190); // 100 + 100 - 10
    expect(summary.events.some((e) => e.includes('active immediately'))).toBe(true);
    expect(summary.events.some((e) => e.includes('active next turn'))).toBe(false);
  });

  it('matches the owner example: +10 security lands the turn it is ordered', () => {
    const rs = structuredClone(rulesetV1_3);
    const state = getInitialState(rs);
    state.indicators.security = 40;
    const summary = resolveTurn(rs, state, EMPTY, { changes: [{ policy: 'training', delta: 1 }] });
    expect(summary.state.indicators.security).toBe(50); // 40 + 10 at end of this turn
  });

  it('v1.2.0 keeps next-turn activation (frozen G-09)', () => {
    const rs: Ruleset = structuredClone(rulesetV1); // effectsTiming defaults to 'next-turn'
    expect(rs.effectsTiming).toBeUndefined();
    const summary = resolveTurn(rs, getInitialState(rs), EMPTY, { changes: [{ policy: 'recruitment', delta: 1 }] });
    const s = summary.state;
    expect(s.levels.terrorist.recruitment).toBe(1);
    expect(s.indicators.mobilization).toBe(0); // nothing performs until next turn
    const eco = summary.economy.find((e) => e.side === 'terrorist')!;
    expect(eco.spend).toBe(0); // no upkeep charged yet
    expect(s.bank.terrorist).toBe(200);
    expect(summary.events.some((e) => e.includes('active next turn'))).toBe(true);
  });
});

describe('turn-limit judge (v1.3)', () => {
  it('state wins the judge on a higher danger-indicator sum', () => {
    const rs = shortLimit();
    const summary = resolveTurn(rs, getInitialState(rs), EMPTY, EMPTY);
    expect(summary.state.status).toBe('finished');
    expect(summary.state.result?.winner).toBe('state'); // 150 vs 135
    expect(summary.state.result?.reasons.join(' ')).toMatch(/turn limit 1 reached \(danger-indicator margin 150 vs 135\)/);
  });

  it('terrorist wins the judge when its sum is higher', () => {
    const rs = shortLimit((r) => {
      r.initial.indicators.stability = 50;
      r.initial.indicators.legitimacy = 50;
    });
    const summary = resolveTurn(rs, getInitialState(rs), EMPTY, EMPTY);
    expect(summary.state.result?.winner).toBe('terrorist'); // 100 vs 135
  });

  it('an exact margin tie stays a draw', () => {
    const rs = shortLimit((r) => {
      r.initial.indicators.mobilization = 50; // 150 vs 150
    });
    const summary = resolveTurn(rs, getInitialState(rs), EMPTY, EMPTY);
    expect(summary.state.result?.winner).toBe('draw');
  });

  it('a decisive loss at the turn cap still takes precedence over the judge', () => {
    const rs = shortLimit((r) => {
      r.turnLimit = 2;
      r.initial.indicators.mobilization = 0; // back to the v1.2 cliff: T1 grace, T2 loss
    });
    let state = getInitialState(rs);
    state = resolveTurn(rs, state, EMPTY, EMPTY).state; // T1: grace, counter 0
    expect(state.status).toBe('active');
    const summary = resolveTurn(rs, state, EMPTY, EMPTY); // T2: critical persists -> loss
    expect(summary.state.result?.winner).toBe('state');
    const reasons = summary.state.result?.reasons.join(' ') ?? '';
    expect(reasons).toMatch(/terrorist mobilization/);
    expect(reasons).toMatch(/turn limit 2 reached/);
    expect(reasons).not.toMatch(/danger-indicator margin/);
  });

  it('v1.2.0 without a judge still draws unconditionally at the limit', () => {
    const rs = structuredClone(rulesetV1);
    rs.turnLimit = 1;
    const summary = resolveTurn(rs, getInitialState(rs), EMPTY, EMPTY);
    expect(summary.state.result?.winner).toBe('draw');
    expect(summary.state.result?.reasons).toEqual(['turn limit 1 reached']);
  });
});
