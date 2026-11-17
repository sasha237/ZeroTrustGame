import {
  INDICATORS,
  isIndicator,
  type EconomyLine,
  type EffectLogEntry,
  type EffectTarget,
  type GameState,
  type GameResult,
  type Indicator,
  type Orders,
  type OrdersPreview,
  type Policy,
  type Ruleset,
  type Side,
  type TurnProjection,
  type TurnSummary,
  type Winner,
} from './types.js';

const SIDES: readonly Side[] = ['state', 'terrorist'];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function ownBudgetTarget(side: Side): EffectTarget {
  return side === 'state' ? 'stateBudget' : 'terroristBudget';
}

function ownIndicators(side: Side): readonly Indicator[] {
  return side === 'state' ? ['stability', 'legitimacy'] : ['security', 'mobilization'];
}

function initialBandCounters(): { critical: number; sustained: number } {
  return { critical: -1, sustained: -1 };
}

export function getInitialState(ruleset: Ruleset): GameState {
  return {
    rulesetVersion: ruleset.version,
    turn: 1,
    indicators: { ...ruleset.initial.indicators },
    levels: {
      state: Object.fromEntries(ruleset.policies.state.map((p) => [p.id, 0])),
      terrorist: Object.fromEntries(ruleset.policies.terrorist.map((p) => [p.id, 0])),
    },
    budget: { ...ruleset.initial.budget },
    bank: { ...ruleset.initial.bank },
    danger: {
      state: { stability: initialBandCounters(), legitimacy: initialBandCounters() },
      terrorist: { security: initialBandCounters(), mobilization: initialBandCounters() },
    },
    status: 'active',
    result: null,
  };
}

interface AppliedEffect {
  actor: Side;
  policy: string;
  target: EffectTarget;
  delta: number;
}

/**
 * Sums per-turn effects of the given policy levels.
 * Effects are TOTALS at held level (A-01) and summed per target before application,
 * so resolution cannot depend on iteration order (G-08).
 */
function collectEffects(ruleset: Ruleset, levels: GameState['levels']): {
  totals: Map<EffectTarget, number>;
  applied: AppliedEffect[];
} {
  const totals = new Map<EffectTarget, number>();
  const applied: AppliedEffect[] = [];
  for (const side of SIDES) {
    for (const policy of ruleset.policies[side]) {
      const level = levels[side][policy.id] ?? 0;
      if (level === 0) continue;
      for (const effect of policy.effects[level] ?? []) {
        totals.set(effect.target, (totals.get(effect.target) ?? 0) + effect.delta);
        applied.push({ actor: side, policy: policy.id, target: effect.target, delta: effect.delta });
      }
    }
  }
  return { totals, applied };
}

/** Sums effects of ONE side's policies only (used for the G-04 own-indicator floor). */
function collectSideEffects(ruleset: Ruleset, side: Side, levelsSide: Record<string, number>): Map<EffectTarget, number> {
  const totals = new Map<EffectTarget, number>();
  for (const policy of ruleset.policies[side]) {
    const level = levelsSide[policy.id] ?? 0;
    if (level === 0) continue;
    for (const effect of policy.effects[level] ?? []) {
      totals.set(effect.target, (totals.get(effect.target) ?? 0) + effect.delta);
    }
  }
  return totals;
}

/** Total money leaving a side per turn at the given levels (own upkeep + opponent budget attacks). */
function spendOf(ruleset: Ruleset, levels: GameState['levels'], side: Side): number {
  const { totals } = collectEffects(ruleset, levels);
  return Math.max(0, -(totals.get(ownBudgetTarget(side)) ?? 0));
}

/**
 * Validation is pure: returns human-readable errors (empty = valid).
 *
 * ANSWERS.md G-04 + ANSWERS2: an order is rejected when the RESULTING configuration
 *  - is unaffordable: spend exceeds base income + budget + bank + own positive budget effects,
 *    AND the order increases the shortfall (decreases that shrink an existing shortfall are
 *    always allowed so a player in a hole can always dig out), or
 *  - would drive any of the side's OWN indicators below 0 by the side's OWN policies, and
 *    makes it WORSE than the current configuration (F-1: own side, own policies; a config
 *    already in a hole may always be kept or improved so the player can dig out).
 *    Opponent effects on the side's indicators are out of the side's control and never block.
 */
export function validateOrders(ruleset: Ruleset, state: GameState, side: Side, orders: Orders): string[] {
  const errors: string[] = [];
  if (state.status !== 'active') {
    errors.push('game is already finished');
  }
  if (orders.changes.length > ruleset.maxPolicyChangesPerTurn) {
    errors.push(`too many changes: ${orders.changes.length} > ${ruleset.maxPolicyChangesPerTurn} allowed`);
  }
  const byId = new Map<string, Policy>(ruleset.policies[side].map((p) => [p.id, p]));
  const resulting = { ...state.levels[side] };
  for (const change of orders.changes) {
    const policy = byId.get(change.policy);
    if (!policy) {
      errors.push(`unknown policy '${change.policy}' for side '${side}'`);
      continue;
    }
    if (change.delta !== 1 && change.delta !== -1) {
      errors.push(`change on '${change.policy}' must be a single step (+1 or -1)`);
      continue;
    }
    resulting[change.policy] = (resulting[change.policy] ?? 0) + change.delta;
  }
  for (const [id, level] of Object.entries(resulting)) {
    const policy = byId.get(id);
    if (policy && (level < 0 || level > policy.maxLevel)) {
      errors.push(`policy '${id}' would be level ${level}, outside [0, ${policy.maxLevel}]`);
    }
  }
  if (errors.length > 0) return errors;

  const hypothetical: GameState['levels'] = {
    state: { ...state.levels.state },
    terrorist: { ...state.levels.terrorist },
  };
  hypothetical[side] = resulting;
  const { totals } = collectEffects(ruleset, hypothetical);
  const net = totals.get(ownBudgetTarget(side)) ?? 0;
  const spendNew = Math.max(0, -net);
  const funds = state.budget[side] + state.bank[side] + ruleset.baseIncome[side] + Math.max(0, net);
  const spendCurrent = spendOf(ruleset, state.levels, side);
  if (spendNew > funds && spendNew > spendCurrent) {
    errors.push(
      `cannot afford upkeep ${spendNew} with funds ${funds} (budget ${state.budget[side]} + bank ${state.bank[side]} + income ${ruleset.baseIncome[side]}); reduce other policies first`,
    );
  }

  const ownNew = collectSideEffects(ruleset, side, resulting);
  const ownCurrent = collectSideEffects(ruleset, side, state.levels[side]);
  for (const indicator of ownIndicators(side)) {
    const newValue = state.indicators[indicator] + (ownNew.get(indicator) ?? 0);
    const currentValue = state.indicators[indicator] + (ownCurrent.get(indicator) ?? 0);
    if (newValue < 0 && newValue < currentValue) {
      errors.push(`not enough ${indicator}: own policies would take it to ${newValue} (minimum 0)`);
    }
  }
  return errors;
}

/**
 * Danger thresholds with grace counters (ANSWERS3.md F-5):
 * the turn a band is first hit, its counter is set to 0 (grace — no loss); each following
 * turn the value stays in the band, the counter increments; the side loses when the counter
 * reaches the band's turn count. So the critical band (1) loses on the 2nd consecutive hit
 * turn, and the sustained band (3) loses on the 4th consecutive hit turn. Recovering above
 * the band resets the counter to -1; a later re-hit starts again at 0.
 */
function checkDanger(ruleset: Ruleset, next: GameState): string[] {
  const reasons: string[] = [];
  for (const side of SIDES) {
    const config = ruleset.danger[side];
    for (const indicator of config.indicators) {
      const value = next.indicators[indicator];
      const counters = (next.danger[side] as Record<Indicator, { critical: number; sustained: number }>)[indicator];
      if (value <= config.criticalValue) {
        counters.critical = counters.critical < 0 ? 0 : counters.critical + 1;
        if (counters.critical >= config.criticalTurns) {
          reasons.push(
            `${side} ${indicator} ${value} <= ${config.criticalValue} (critical, persisted ${counters.critical})`,
          );
        }
      } else {
        counters.critical = -1;
      }
      if (value <= config.sustainedValue) {
        counters.sustained = counters.sustained < 0 ? 0 : counters.sustained + 1;
        if (counters.sustained >= config.sustainedTurns) {
          reasons.push(
            `${side} ${indicator} <= ${config.sustainedValue}, persisted ${counters.sustained} counted turns`,
          );
        }
      } else {
        counters.sustained = -1;
      }
    }
  }
  return reasons;
}

function finishGame(next: GameState, reasons: string[]): void {
  const stateLost = reasons.some((r) => r.startsWith('state '));
  const terroristLost = reasons.some((r) => r.startsWith('terrorist '));
  next.status = 'finished';
  next.result = {
    winner: stateLost && terroristLost ? 'draw' : stateLost ? 'terrorist' : terroristLost ? 'state' : 'draw',
    reasons,
  };
}

/**
 * Turn-limit judge (ruleset v1.3): decides a game that reached the turn limit with no
 * decisive loss by comparing each side's OWN danger-indicator sums (state: stability +
 * legitimacy; terrorist: security + mobilization). Higher sum wins; exact tie is a draw.
 */
function judgeTurnLimit(ruleset: Ruleset, next: GameState): GameResult | null {
  if (ruleset.turnLimitJudge !== 'danger-indicator-margin') return null;
  const stateScore = next.indicators.stability + next.indicators.legitimacy;
  const terroristScore = next.indicators.security + next.indicators.mobilization;
  const winner: Winner = stateScore === terroristScore ? 'draw' : stateScore > terroristScore ? 'state' : 'terrorist';
  return {
    winner,
    reasons: [`turn limit ${ruleset.turnLimit} reached (danger-indicator margin ${stateScore} vs ${terroristScore})`],
  };
}

/**
 * Resolves one simultaneous turn. Throws if either side's orders are invalid.
 * The input state is not mutated; the returned summary contains the next state.
 *
 * Turn lifecycle (ANSWERS.md G-06/G-08, ANSWERS2 money model, ANSWERS3 F-5):
 *   1. both sides' orders are validated (G-04 checks included);
 *   2. if both set agreeToDraw, the game ends in a draw;
 *   3. when the ruleset's effectsTiming is 'same-turn' (v1.3.0), the submitted changes
 *      become active NOW and perform at the end of this same turn; with 'next-turn'
 *      (v1.2.0 G-09) they stay inactive until step 9;
 *   4. ACTIVE policies perform: indicator effects are net-summed per target and applied once,
 *      clamped to the indicator scale;
 *   5. each side SPENDS the money its active levels cost (own upkeep + opponent budget
 *      attacks) from its budget, dipping into the bank;
 *   6. solvency: spend > budget + bank => bankruptcy => loss. Income never rescues spend;
 *   7. solvent sides EARN income (base + active positive budget effects) — it becomes next
 *      turn's budget; unspent budget consolidates into the bank (bank += budget - spend);
 *   8. danger thresholds evaluated on end-of-turn values with grace counters (F-5);
 *   9. if the turn limit is reached the game ends — a draw, or a judged decision when
 *      the ruleset configures a turnLimitJudge and no decisive loss occurred this turn;
 *   10. under 'next-turn' timing the submitted changes become the new active levels;
 *      the turn advances.
 */
export function resolveTurn(
  ruleset: Ruleset,
  state: GameState,
  stateOrders: Orders,
  terroristOrders: Orders,
): TurnSummary {
  const ordersBySide: Record<Side, Orders> = { state: stateOrders, terrorist: terroristOrders };
  for (const side of SIDES) {
    const errors = validateOrders(ruleset, state, side, ordersBySide[side]);
    if (errors.length > 0) {
      throw new Error(`invalid ${side} orders: ${errors.join('; ')}`);
    }
  }

  const next: GameState = structuredClone(state);
  const events: string[] = [];
  const log: EffectLogEntry[] = [];
  const economy: EconomyLine[] = [];

  if (stateOrders.agreeToDraw && terroristOrders.agreeToDraw) {
    finishGame(next, ['mutual agreement to draw']);
    events.push('Both sides agreed to end the game: draw.');
    return { state: next, log, economy, events };
  }

  // (3) same-turn timing (v1.3.0): submitted changes become active immediately and
  // perform at the end of this very turn.
  if (ruleset.effectsTiming === 'same-turn') {
    for (const side of SIDES) {
      for (const change of ordersBySide[side].changes) {
        next.levels[side][change.policy] += change.delta;
        events.push(
          `${side} sets ${change.policy} -> level ${next.levels[side][change.policy]} (active immediately)`,
        );
      }
    }
  }

  // (3) active policies perform
  const { totals, applied } = collectEffects(ruleset, next.levels);
  const { min, max } = ruleset.indicatorScale;
  for (const indicator of INDICATORS) {
    next.indicators[indicator] = clamp(next.indicators[indicator] + (totals.get(indicator) ?? 0), min, max);
  }
  for (const entry of applied) {
    log.push({
      turn: state.turn,
      actor: entry.actor,
      policy: entry.policy,
      target: entry.target,
      delta: entry.delta,
      resultingValue: isIndicator(entry.target) ? next.indicators[entry.target] : null,
    });
  }

  // (4)+(5)+(6) spend, solvency check, earn
  const reasons: string[] = [];
  for (const side of SIDES) {
    const net = totals.get(ownBudgetTarget(side)) ?? 0;
    const spend = Math.max(0, -net);
    const income = ruleset.baseIncome[side] + Math.max(0, net);
    const budgetBefore = next.budget[side];
    const bankBefore = next.bank[side];
    const insolvent = spend > budgetBefore + bankBefore;
    if (insolvent) {
      reasons.push(`${side} bankrupt (spend ${spend} > budget ${budgetBefore} + bank ${bankBefore})`);
      events.push(`${side} cannot cover ${spend} (budget ${budgetBefore}, bank ${bankBefore}): bankrupt`);
      economy.push({ side, spend, income: 0, budgetAfter: budgetBefore, bankAfter: bankBefore, insolvent });
    } else {
      // unspent budget consolidates into the bank; earned income becomes next turn's budget
      next.bank[side] = bankBefore + budgetBefore - spend;
      next.budget[side] = income;
      events.push(
        `${side}: spend ${spend} (budget ${budgetBefore} -> 0, bank ${bankBefore} -> ${next.bank[side]}), income ${income} budgeted for next turn`,
      );
      economy.push({ side, spend, income, budgetAfter: income, bankAfter: next.bank[side], insolvent });
    }
  }

  // (7) danger thresholds with grace counters (ANSWERS3 F-5)
  reasons.push(...checkDanger(ruleset, next));

  // (8) turn limit: judged decision when configured and nothing else decided the game
  if (ruleset.turnLimit !== null && state.turn >= ruleset.turnLimit) {
    if (reasons.length === 0) {
      const judged = judgeTurnLimit(ruleset, next);
      if (judged) {
        next.status = 'finished';
        next.result = judged;
        events.push(...judged.reasons);
        return { state: next, log, economy, events };
      }
    }
    reasons.push(`turn limit ${ruleset.turnLimit} reached`);
  }

  if (reasons.length > 0) {
    finishGame(next, reasons);
    events.push(...reasons);
    return { state: next, log, economy, events };
  }

  // (10) next-turn timing (v1.2.0 G-09): changes submitted this turn become active now
  // and perform from the next turn on. Under 'same-turn' timing they already performed.
  if (ruleset.effectsTiming !== 'same-turn') {
    for (const side of SIDES) {
      for (const change of ordersBySide[side].changes) {
        next.levels[side][change.policy] += change.delta;
        events.push(
          `${side} sets ${change.policy} -> level ${next.levels[side][change.policy]} (active next turn)`,
        );
      }
    }
  }
  next.turn += 1;
  events.push(`Turn ${state.turn} resolved.`);
  return { state: next, log, economy, events };
}

function projectFromTotals(
  ruleset: Ruleset,
  indicators: Record<Indicator, number>,
  budget: number,
  bank: number,
  side: Side,
  totals: Map<EffectTarget, number>,
): TurnProjection {
  const net = totals.get(ownBudgetTarget(side)) ?? 0;
  const spend = Math.max(0, -net);
  const income = ruleset.baseIncome[side] + Math.max(0, net);
  const { min, max } = ruleset.indicatorScale;
  const projected = Object.fromEntries(
    INDICATORS.map((ind) => [ind, clamp(indicators[ind] + (totals.get(ind) ?? 0), min, max)]),
  ) as Record<Indicator, number>;
  const solvent = spend <= budget + bank;
  return {
    indicators: projected,
    spend,
    income: solvent ? income : 0,
    budgetAfter: solvent ? income : budget,
    bankAfter: solvent ? bank + budget - spend : bank,
    solvent,
  };
}

/**
 * Projection of the imminent resolution: what the currently ACTIVE levels will do this turn.
 */
export function previewTurn(
  ruleset: Ruleset,
  state: GameState,
): Record<Side, TurnProjection> {
  const { totals } = collectEffects(ruleset, state.levels);
  return {
    state: projectFromTotals(ruleset, state.indicators, state.budget.state, state.bank.state, 'state', totals),
    terrorist: projectFromTotals(ruleset, state.indicators, state.budget.terrorist, state.bank.terrorist, 'terrorist', totals),
  };
}

/**
 * Forecast for one side's submitted orders: the resulting levels and their projection.
 * With 'same-turn' timing (v1.3.0) this is the imminent resolution; with 'next-turn'
 * timing (v1.2.0) it is next turn's outlook. The opponent is assumed to hold current
 * levels and current indicators are used as the base, so it is an approximation by design.
 * Validation errors (G-04) are returned instead of thrown.
 */
export function previewOrders(ruleset: Ruleset, state: GameState, side: Side, orders: Orders): OrdersPreview {
  const errors = validateOrders(ruleset, state, side, orders);
  const levels = { ...state.levels[side] };
  for (const change of orders.changes) {
    if (levels[change.policy] !== undefined) levels[change.policy] += change.delta;
  }
  const hypothetical: GameState['levels'] = {
    state: { ...state.levels.state },
    terrorist: { ...state.levels.terrorist },
  };
  hypothetical[side] = levels;
  const { totals } = collectEffects(ruleset, hypothetical);
  const projection = projectFromTotals(ruleset, state.indicators, state.budget[side], state.bank[side], side, totals);
  return { errors, levels, projection };
}

export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeState(json: string): GameState {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('not a valid serialized GameState');
  }
  const candidate = parsed as GameState;
  for (const key of ['rulesetVersion', 'turn', 'indicators', 'levels', 'budget', 'bank', 'danger', 'status', 'result'] as const) {
    if (!(key in candidate)) {
      throw new Error(`serialized GameState is missing '${key}'`);
    }
  }
  return candidate;
}

/**
 * Deterministic replay: applies a recorded sequence of turn orders to an initial state.
 * Given the same inputs, always produces the same final state (engine determinism, FR-06/FR-07).
 */
export function replay(
  ruleset: Ruleset,
  initial: GameState,
  turns: ReadonlyArray<{ state: Orders; terrorist: Orders }>,
): GameState {
  let current = initial;
  for (const turn of turns) {
    current = resolveTurn(ruleset, current, turn.state, turn.terrorist).state;
  }
  return current;
}
