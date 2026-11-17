import { describe, expect, it } from 'vitest';
import { INDICATORS, rulesetV1, type EffectTarget } from '../src/index.js';

const VALID_TARGETS: readonly EffectTarget[] = [...INDICATORS, 'stateBudget', 'terroristBudget'];

const EXPECTED_MAX_LEVELS: Record<'state' | 'terrorist', Record<string, number>> = {
  state: {
    counterFinances: 1,
    counterNarrative: 3,
    emergencyLegislation: 2,
    intelligence: 3,
    killCapture: 3,
    leadershipTargeting: 2,
    internationalPartners: 2,
    policing: 3,
    reforms: 3,
    taxes: 3,
  },
  terrorist: {
    attacks: 5,
    fundraising: 3,
    operationalSecurity: 4,
    propaganda: 3,
    recruitment: 2,
    safeHavens: 2,
    socialServices: 2,
    subversiveAction: 3,
    training: 2,
  },
};

describe('ruleset v1.2 shape (owner-verified tables)', () => {
  it('has 10 State and 9 Terrorist policies with unique ids and titles', () => {
    for (const side of ['state', 'terrorist'] as const) {
      const policies = rulesetV1.policies[side];
      expect(policies).toHaveLength(side === 'state' ? 10 : 9);
      const ids = policies.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      const titles = policies.map((p) => p.title);
      expect(new Set(titles).size).toBe(titles.length);
    }
  });

  it('max levels match the cheat-sheet tables exactly', () => {
    for (const side of ['state', 'terrorist'] as const) {
      for (const policy of rulesetV1.policies[side]) {
        expect(policy.maxLevel).toBe(EXPECTED_MAX_LEVELS[side][policy.id]);
      }
    }
  });

  it('explicit level 0 with no effects on every policy (ANSWERS.md G-01)', () => {
    for (const side of ['state', 'terrorist'] as const) {
      for (const policy of rulesetV1.policies[side]) {
        expect(policy.effects[0], `${policy.id} L0`).toBeDefined();
        expect(policy.effects[0]).toEqual([]);
      }
    }
  });

  it('levels 1..maxLevel are defined with integer, non-zero, well-targeted effects', () => {
    for (const side of ['state', 'terrorist'] as const) {
      const ownBudget: EffectTarget = side === 'state' ? 'stateBudget' : 'terroristBudget';
      for (const policy of rulesetV1.policies[side]) {
        for (let level = 1; level <= policy.maxLevel; level++) {
          const effects = policy.effects[level];
          expect(effects, `${policy.id} L${level}`).toBeDefined();
          expect(effects.length).toBeGreaterThan(0);
          for (const effect of effects) {
            expect(Number.isInteger(effect.delta)).toBe(true);
            expect(effect.delta).not.toBe(0);
            expect(VALID_TARGETS).toContain(effect.target);
          }
        }
      }
    }
  });

  it('indicator deltas may exceed the scale (values are clamped, deltas are not)', () => {
    // Attacks L4/L5 stability deltas are -120/-145 per the verified table; the
    // INDICATOR VALUE clamps at 0, individual deltas are never capped.
    const attacks = rulesetV1.policies.terrorist.find((p) => p.id === 'attacks')!;
    const l5 = attacks.effects[5].find((e) => e.target === 'stability')!;
    expect(l5.delta).toBe(-145);
  });

  it('exactly one policy carries no own-budget effect: Emergency Legislation (verified quirk)', () => {
    for (const side of ['state', 'terrorist'] as const) {
      const ownBudget: EffectTarget = side === 'state' ? 'stateBudget' : 'terroristBudget';
      const withoutBudget = rulesetV1.policies[side]
        .filter((policy) =>
          Object.values(policy.effects)
            .flat()
            .every((e) => e.target !== ownBudget),
        )
        .map((p) => p.id);
      if (side === 'state') {
        expect(withoutBudget).toEqual(['emergencyLegislation']);
      } else {
        expect(withoutBudget).toEqual([]);
      }
    }
  });

  it('economy, initial state, and thresholds match the owner answers', () => {
    expect(rulesetV1.version).toBe('1.2.0');
    expect(rulesetV1.baseIncome).toEqual({ state: 100, terrorist: 100 });
    expect(rulesetV1.initial.indicators).toEqual({ stability: 75, legitimacy: 75, security: 100, mobilization: 0 });
    expect(rulesetV1.initial.budget).toEqual({ state: 100, terrorist: 100 });
    expect(rulesetV1.initial.bank).toEqual({ state: 100, terrorist: 100 });
    expect(rulesetV1.maxPolicyChangesPerTurn).toBe(3);
    expect(rulesetV1.indicatorScale).toEqual({ min: 0, max: 100 });
    expect(rulesetV1.turnLimit).toBe(50);
    for (const side of ['state', 'terrorist'] as const) {
      expect(rulesetV1.danger[side]).toMatchObject({
        criticalValue: 10,
        criticalTurns: 1,
        sustainedValue: 30,
        sustainedTurns: 3,
      });
    }
    expect(rulesetV1.danger.state.indicators).toEqual(['stability', 'legitimacy']);
    expect(rulesetV1.danger.terrorist.indicators).toEqual(['security', 'mobilization']);
  });

  it('carries traceability notes for the owner answers it encodes', () => {
    const notes = rulesetV1.notes.join('\n');
    expect(notes).toMatch(/G-03/);
    expect(notes).toMatch(/G-08/);
    expect(notes).toMatch(/starting budget = 100/);
  });
});
