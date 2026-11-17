import { describe, expect, it } from 'vitest';
import {
  deserializeState,
  getInitialState,
  previewOrders,
  previewTurn,
  replay,
  resolveTurn,
  rulesetV1,
  serializeState,
  validateOrders,
  type GameState,
  type Orders,
} from '../src/index.js';

const empty: Orders = { changes: [] };

function initial(): GameState {
  return getInitialState(rulesetV1);
}

/** Deep-clone the initial state and force policy levels (setup for scenario tests). */
function withLevels(side: 'state' | 'terrorist', levels: Record<string, number>): GameState {
  const s = structuredClone(initial());
  Object.assign(s.levels[side], levels);
  return s;
}

/** Keep the terrorist out of the danger bands for scenario tests. */
function withMob(s: GameState, value: number): GameState {
  s.indicators.mobilization = value;
  return s;
}

describe('initial state (owner answers: budget 100, bank 100)', () => {
  it('matches the frozen v1.2 starting position', () => {
    const s = initial();
    expect(s.turn).toBe(1);
    expect(s.indicators).toEqual({ stability: 75, legitimacy: 75, security: 100, mobilization: 0 });
    expect(s.budget).toEqual({ state: 100, terrorist: 100 });
    expect(s.bank).toEqual({ state: 100, terrorist: 100 });
    expect(s.danger.terrorist.mobilization).toEqual({ critical: -1, sustained: -1 });
    expect(Object.values(s.levels.state).every((l) => l === 0)).toBe(true);
    expect(Object.values(s.levels.terrorist).every((l) => l === 0)).toBe(true);
    expect(s.status).toBe('active');
    expect(s.result).toBeNull();
  });

  it('F-5: starting Mobilization 0 gets grace 0 on turn 1; persisting loses on turn 2', () => {
    const r1 = resolveTurn(rulesetV1, initial(), empty, empty);
    expect(r1.state.status).toBe('active'); // grace: first hit = counter 0
    expect(r1.state.danger.terrorist.mobilization.critical).toBe(0);
    const r2 = resolveTurn(rulesetV1, r1.state, empty, empty);
    expect(r2.state.status).toBe('finished');
    expect(r2.state.result?.winner).toBe('state');
    expect(r2.state.result?.reasons.join(' ')).toMatch(/terrorist mobilization 0 <= 10/);
  });
});

describe('F-5 grace counters (ANSWERS3)', () => {
  it('critical band (1): first hit survives, second consecutive hit loses', () => {
    const s = withMob(withLevels('terrorist', { attacks: 5 }), 35); // stability -> 0, mob survives
    s.turn = 2;
    const r1 = resolveTurn(rulesetV1, s, empty, empty);
    expect(r1.state.indicators.stability).toBe(0);
    expect(r1.state.status).toBe('active'); // grace 0
    expect(r1.state.danger.state.stability.critical).toBe(0);
    const r2 = resolveTurn(rulesetV1, r1.state, empty, empty);
    expect(r2.state.status).toBe('finished');
    expect(r2.state.result?.winner).toBe('terrorist');
    expect(r2.state.result?.reasons.join(' ')).toMatch(/state stability 0 <= 10/);
  });

  it('sustained band (3): counters 0,1,2 then loss on the 4th consecutive hit turn', () => {
    let s = withMob(initial(), 35);
    s.indicators.stability = 28;
    s = resolveTurn(rulesetV1, s, empty, empty).state;
    expect(s.status).toBe('active');
    expect(s.danger.state.stability.sustained).toBe(0);
    s = resolveTurn(rulesetV1, s, empty, empty).state;
    expect(s.danger.state.stability.sustained).toBe(1);
    s = resolveTurn(rulesetV1, s, empty, empty).state;
    expect(s.status).toBe('active');
    expect(s.danger.state.stability.sustained).toBe(2);
    s = resolveTurn(rulesetV1, s, empty, empty).state;
    expect(s.status).toBe('finished');
    expect(s.result?.winner).toBe('terrorist');
    expect(s.result?.reasons.join(' ')).toMatch(/persisted 3 counted turns/);
  });

  it('recovering above a band resets its counter to -1 (owner example 3)', () => {
    let s = withMob(initial(), 35);
    s.turn = 2;
    // hit at turn 2 -> 0
    s.indicators.stability = 28;
    s = resolveTurn(rulesetV1, s, empty, empty).state;
    expect(s.danger.state.stability.sustained).toBe(0);
    // recovered at turn 3 -> -1
    s.indicators.stability = 50;
    s = resolveTurn(rulesetV1, s, empty, empty).state;
    expect(s.danger.state.stability.sustained).toBe(-1);
    // re-hit at turn 4 -> grace 0 again (not 1)
    s.indicators.stability = 28;
    s = resolveTurn(rulesetV1, s, empty, empty).state;
    expect(s.danger.state.stability.sustained).toBe(0);
    expect(s.status).toBe('active');
  });

  it('recovering above the band via active policies resets the counter', () => {
    const s = withMob(withLevels('state', { intelligence: 1 }), 35); // active: +20 stability
    s.turn = 2;
    s.indicators.stability = 28;
    s.danger.state.stability = { critical: -1, sustained: 2 };
    const r = resolveTurn(rulesetV1, s, empty, empty);
    expect(r.state.indicators.stability).toBe(48);
    expect(r.state.danger.state.stability).toEqual({ critical: -1, sustained: -1 });
    expect(r.state.status).toBe('active');
  });
});

describe('turn lifecycle (ANSWERS2)', () => {
  it('G-09: changes activate NEXT turn — turn 1 has no effects, income only', () => {
    const r1 = resolveTurn(
      rulesetV1,
      initial(),
      { changes: [{ policy: 'intelligence', delta: 1 }] },
      { changes: [{ policy: 'recruitment', delta: 1 }] },
    );
    expect(r1.state.indicators.stability).toBe(75); // not active yet
    expect(r1.state.levels.state.intelligence).toBe(1); // active next turn
    expect(r1.state.bank.state).toBe(200); // unspent budget 100 consolidated
    expect(r1.state.budget.state).toBe(100); // income budgeted for next turn
    expect(r1.state.turn).toBe(2);

    const r2 = resolveTurn(rulesetV1, r1.state, empty, empty);
    expect(r2.state.status).toBe('active');
    expect(r2.state.turn).toBe(3);
    expect(r2.state.indicators.stability).toBe(95); // intelligence L1 performs
    expect(r2.state.indicators.security).toBe(80); // 100 -10 intelligence -10 recruitment
    expect(r2.state.indicators.mobilization).toBe(20); // recruitment L1 performs
    expect(r2.state.bank.state).toBe(285); // 200 + 100 - 15
    expect(r2.state.bank.terrorist).toBe(290); // 200 + 100 - 10
    expect(r2.state.budget.state).toBe(100);
  });

  it('G-06: bankruptcy is checked BEFORE income — funds are not rescued', () => {
    const s = withLevels('state', { counterNarrative: 3, killCapture: 3, policing: 3 }); // spend 110
    s.budget.state = 0;
    s.bank.state = 100;
    const r = resolveTurn(rulesetV1, s, empty, empty);
    expect(r.state.bank.state).toBe(100); // unchanged: income never arrived
    expect(r.state.budget.state).toBe(0);
    expect(r.state.status).toBe('finished');
    expect(r.state.result?.winner).toBe('terrorist');
    expect(r.state.result?.reasons.join(' ')).toMatch(/state bankrupt/);
    expect(r.economy[0]).toMatchObject({ side: 'state', insolvent: true, income: 0 });
  });

  it('G-07: reaching the turn limit ends the game in a draw', () => {
    const short = { ...rulesetV1, turnLimit: 3 };
    let s = getInitialState(short);
    s.indicators.mobilization = 35; // clear of both danger bands
    s = resolveTurn(short, s, empty, empty).state;
    expect(s.status).toBe('active');
    s = resolveTurn(short, s, empty, empty).state;
    expect(s.status).toBe('active');
    const r = resolveTurn(short, s, empty, empty);
    expect(r.state.status).toBe('finished');
    expect(r.state.result?.winner).toBe('draw');
    expect(r.state.result?.reasons.join(' ')).toMatch(/turn limit 3 reached/);
    expect(r.state.turn).toBe(3);
  });
});

describe('policy effects (hand-computed from the verified cheat-sheet tables)', () => {
  it('State Intelligence L1 active: stability +20, security -10, upkeep 15', () => {
    const s = withMob(withLevels('state', { intelligence: 1 }), 20);
    const r = resolveTurn(rulesetV1, s, empty, empty);
    expect(r.state.status).toBe('active');
    expect(r.state.indicators.stability).toBe(95);
    expect(r.state.indicators.security).toBe(90);
    expect(r.state.bank.state).toBe(185); // 100 + (100 - 15)
    expect(r.state.budget.state).toBe(100);
    const entry = r.log.find((e) => e.policy === 'intelligence' && e.target === 'stability');
    expect(entry).toMatchObject({ actor: 'state', delta: 20, resultingValue: 95 });
  });

  it('Terrorist Attacks L1 active: stability -30, legitimacy -5, own security -3, cost 10', () => {
    const s = withMob(withLevels('terrorist', { attacks: 1 }), 20);
    const r = resolveTurn(rulesetV1, s, empty, empty);
    expect(r.state.indicators).toMatchObject({ stability: 45, legitimacy: 70, security: 97, mobilization: 20 });
    expect(r.state.bank.terrorist).toBe(190);
    expect(r.state.budget.terrorist).toBe(100);
  });

  it('State Taxes L3 active: income 120 next budget, legitimacy -15, terrorist mobilization +15', () => {
    const r = resolveTurn(rulesetV1, withLevels('state', { taxes: 3 }), empty, empty);
    expect(r.state.indicators.legitimacy).toBe(60);
    expect(r.state.indicators.mobilization).toBe(15);
    expect(r.state.bank.state).toBe(200); // spend 0, budget 100 -> bank
    expect(r.state.budget.state).toBe(120);
  });

  it('clamp: Fundraising L3 floors mobilization at 0 (only indicators clamp)', () => {
    const s = withLevels('terrorist', { fundraising: 3 });
    s.indicators.mobilization = 3;
    const r = resolveTurn(rulesetV1, s, empty, empty);
    expect(r.state.indicators.mobilization).toBe(0);
    expect(r.state.indicators.security).toBe(85);
    expect(r.state.budget.terrorist).toBe(120); // income not clamped
  });

  it('G-08: simultaneous effects net before clamping', () => {
    // Intelligence L3 (+60) vs Attacks L1 (-30): 75 + 60 - 30 = 105 -> 100 (net semantics).
    const s = withMob(withLevels('state', { intelligence: 3 }), 20);
    Object.assign(s.levels.terrorist, { attacks: 1 });
    const r = resolveTurn(rulesetV1, s, empty, empty);
    expect(r.state.indicators.stability).toBe(100);
  });
});

describe('order validation (G-04 / F-1 / F-2)', () => {
  it('rejects more than 3 changes', () => {
    const orders: Orders = {
      changes: [
        { policy: 'intelligence', delta: 1 },
        { policy: 'policing', delta: 1 },
        { policy: 'taxes', delta: 1 },
        { policy: 'reforms', delta: 1 },
      ],
    };
    expect(validateOrders(rulesetV1, initial(), 'state', orders).join(' ')).toMatch(/too many changes/);
  });

  it('rejects unknown policies, illegal steps, and out-of-range levels', () => {
    expect(
      validateOrders(rulesetV1, initial(), 'state', { changes: [{ policy: 'nonsense', delta: 1 }] }).join(' '),
    ).toMatch(/unknown policy/);
    expect(
      validateOrders(rulesetV1, initial(), 'state', {
        // @ts-expect-error runtime misuse on purpose
        changes: [{ policy: 'taxes', delta: 2 }],
      }).join(' '),
    ).toMatch(/single step/);
    const almostMax = withLevels('terrorist', { attacks: 3 });
    expect(
      validateOrders(rulesetV1, almostMax, 'terrorist', {
        changes: [
          { policy: 'attacks', delta: 1 },
          { policy: 'attacks', delta: 1 },
          { policy: 'attacks', delta: 1 },
        ],
      }).join(' '),
    ).toMatch(/outside \[0, 5\]/);
  });

  it('affordability: rejects increases that grow an unaffordable shortfall', () => {
    const s = withLevels('state', { reforms: 3 }); // spend 80 active
    s.budget.state = 0;
    s.bank.state = 0;
    // funds = 0 + 0 + 100 = 100; spend would become 80 + 45 = 125
    const orders: Orders = {
      changes: [
        { policy: 'intelligence', delta: 1 },
        { policy: 'intelligence', delta: 1 },
        { policy: 'intelligence', delta: 1 },
      ],
    };
    expect(validateOrders(rulesetV1, s, 'state', orders).join(' ')).toMatch(/cannot afford upkeep 125/);
  });

  it('F-2: reductions that shrink a shortfall are always allowed', () => {
    const s = withLevels('state', { reforms: 3, counterNarrative: 3 }); // spend 120
    s.budget.state = 0;
    s.bank.state = 0; // funds 100 < spend 120: already insolvent
    expect(validateOrders(rulesetV1, s, 'state', empty).join(' ')).not.toMatch(/cannot afford/);
    expect(
      validateOrders(rulesetV1, s, 'state', { changes: [{ policy: 'counterNarrative', delta: -1 }] }).join(' '),
    ).not.toMatch(/cannot afford/);
  });

  it('F-1: own indicators cannot be driven below 0 by own policies', () => {
    expect(
      validateOrders(rulesetV1, initial(), 'terrorist', { changes: [{ policy: 'fundraising', delta: 1 }] }).join(' '),
    ).toMatch(/not enough mobilization/);
    const lowSecurity = withLevels('terrorist', {});
    lowSecurity.indicators.security = 2;
    expect(
      validateOrders(rulesetV1, lowSecurity, 'terrorist', { changes: [{ policy: 'attacks', delta: 1 }] }).join(' '),
    ).toMatch(/not enough security/);
    const okSecurity = withLevels('terrorist', {});
    okSecurity.indicators.security = 5;
    expect(
      validateOrders(rulesetV1, okSecurity, 'terrorist', { changes: [{ policy: 'attacks', delta: 1 }] }),
    ).toEqual([]);
  });

  it('F-1: a configuration already in an indicator hole may be kept or improved', () => {
    // Fundraising L3 held while mobilization is 3: own policies already project to -12.
    // Empty orders (keep) and reductions (dig out) must not be blocked.
    const s = withLevels('terrorist', { fundraising: 3 });
    s.indicators.mobilization = 3;
    expect(validateOrders(rulesetV1, s, 'terrorist', empty)).toEqual([]);
    expect(
      validateOrders(rulesetV1, s, 'terrorist', { changes: [{ policy: 'fundraising', delta: -1 }] }),
    ).toEqual([]);
  });
});

describe('serialization, preview, replay', () => {
  it('serialize/deserialize round-trips; missing keys are rejected', () => {
    const s = initial();
    expect(deserializeState(serializeState(s))).toEqual(s);
    expect(() => deserializeState('{"nope": true}')).toThrow(/missing/);
  });

  it('previewTurn projects the imminent resolution', () => {
    const p0 = previewTurn(rulesetV1, initial());
    expect(p0.state).toMatchObject({ spend: 0, income: 100, bankAfter: 200, budgetAfter: 100, solvent: true });
    expect(p0.state.indicators.stability).toBe(75);

    const s = resolveTurn(rulesetV1, initial(), { changes: [{ policy: 'intelligence', delta: 1 }] }, empty).state;
    const p1 = previewTurn(rulesetV1, s);
    expect(p1.state).toMatchObject({ spend: 15, income: 100, bankAfter: 285, budgetAfter: 100, solvent: true });
    expect(p1.state.indicators.stability).toBe(95);
  });

  it('previewOrders forecasts the submitted configuration without mutating state', () => {
    const s = initial();
    const p = previewOrders(rulesetV1, s, 'state', { changes: [{ policy: 'intelligence', delta: 1 }] });
    expect(p.errors).toEqual([]);
    expect(p.levels.intelligence).toBe(1);
    expect(p.projection).toMatchObject({ spend: 15, income: 100, bankAfter: 185, budgetAfter: 100 });
    expect(p.projection.indicators.stability).toBe(95);
    expect(s.turn).toBe(1);
    expect(s.levels.state.intelligence).toBe(0);
    const bad = previewOrders(rulesetV1, s, 'terrorist', { changes: [{ policy: 'fundraising', delta: 1 }] });
    expect(bad.errors.join(' ')).toMatch(/not enough mobilization/);
  });

  it('replay of recorded orders reproduces the final state exactly', () => {
    const turns = [
      { state: { changes: [{ policy: 'intelligence', delta: 1 } as const] }, terrorist: { changes: [{ policy: 'recruitment', delta: 1 } as const] } },
      { state: { changes: [{ policy: 'policing', delta: 1 } as const] }, terrorist: { changes: [{ policy: 'fundraising', delta: 1 } as const] } },
      { state: { changes: [{ policy: 'counterNarrative', delta: 1 } as const] }, terrorist: { changes: [{ policy: 'operationalSecurity', delta: 1 } as const] } },
      { state: empty, terrorist: empty },
    ];
    let sequential = initial();
    for (const t of turns) {
      sequential = resolveTurn(rulesetV1, sequential, t.state, t.terrorist).state;
    }
    expect(sequential.status).toBe('active');
    const replayed = replay(rulesetV1, deserializeState(serializeState(initial())), turns);
    expect(replayed).toEqual(sequential);
    expect(replayed.turn).toBe(5);
  });
});
