import {
  validateOrders,
  type GameState,
  type Indicator,
  type Orders,
  type PolicyChange,
  type Ruleset,
  type Side,
} from '@bot/engine';
import type { Prng } from './prng.js';

const OTHER: Record<Side, Side> = { state: 'terrorist', terrorist: 'state' };

const W_DANGER_OWN = 3; // own danger indicators: linear in value (lifting 0→20 beats staying at 0)
const W_CRITICAL_OWN = 4; // extra urgency while at/below the critical band
const W_ATTACK = 3; // pushing opponent indicators into danger bands
const W_CRITICAL_ATTACK = 4; // extra reward for pushing opponents into the critical band
const W_ECON = 0.4; // prefer solvent, higher net income
const W_BASELINE = 0.05; // mild preference for keeping own indicators high

interface Candidate {
  change: PolicyChange;
  score: number;
}

function ownIndicators(side: Side): readonly Indicator[] {
  return side === 'state' ? ['stability', 'legitimacy'] : ['security', 'mobilization'];
}

/**
 * Score a complete order set for `side` from its projection (opponent holds current
 * levels). Own danger indicators are MONOTONE INCREASING in the projected value — a
 * utility that rewards "being below the band" would prefer staying at 0 over lifting
 * to 20, which is exactly the turn-2 Mobilization-loss trap.
 */
function scoreOrders(
  ruleset: Ruleset,
  side: Side,
  projection: { indicators: Record<Indicator, number>; spend: number; income: number; solvent: boolean },
  heldLevels: number,
): number {
  const opp = OTHER[side];
  let score = W_ECON * (projection.income - projection.spend) + 0.5 * heldLevels;
  for (const ind of ownIndicators(side)) {
    const cfg = ruleset.danger[side];
    if (cfg.indicators.includes(ind)) {
      const v = projection.indicators[ind];
      score += W_DANGER_OWN * (v - cfg.sustainedValue);
      if (v <= cfg.criticalValue) score -= W_CRITICAL_OWN * (cfg.criticalValue - v);
    }
    score += W_BASELINE * (projection.indicators[ind] - 50);
  }
  for (const ind of ruleset.danger[opp].indicators) {
    const cfg = ruleset.danger[opp];
    const v = projection.indicators[ind];
    if (v <= cfg.sustainedValue) score += W_ATTACK * (cfg.sustainedValue - v);
    if (v <= cfg.criticalValue) score += W_CRITICAL_ATTACK * (cfg.criticalValue - v);
  }
  return score;
}

/**
 * Heuristic bot: greedily build up to the per-turn cap of single-step changes. Each
 * candidate is validated with the engine (candidates that fail G-04 are dropped), scored
 * by a simple utility (danger bands, attacking the opponent's weakness, solvency,
 * keeping held policies leveled), then picked weighted-random among the top-k so seeded
 * runs diverge. The same utility drives both sides via side-specific indicator maps.
 */
export function proposeOrders(ruleset: Ruleset, state: GameState, side: Side, rng: Prng): Orders {
  const policies = ruleset.policies[side];
  const changes: PolicyChange[] = [];

  for (let step = 0; step < ruleset.maxPolicyChangesPerTurn; step++) {
    const candidates: Candidate[] = [];
    const touched = new Set(changes.map((c) => c.policy));
    for (const policy of policies) {
      if (touched.has(policy.id)) continue; // one step per policy per turn
      const level = state.levels[side][policy.id] ?? 0;
      for (const delta of [1, -1] as const) {
        const next = level + delta;
        if (next < 0 || next > policy.maxLevel) continue;
        const trial: Orders = { changes: [...changes, { policy: policy.id, delta }] };
        if (validateOrders(ruleset, state, side, trial).length > 0) continue;
        const projection = project(ruleset, state, side, trial);
        if (!projection.solvent && step === 0) continue; // never volunteer for bankruptcy
        const held = policies.filter((p) => (state.levels[side][p.id] ?? 0) > 0).length;
        candidates.push({ change: { policy: policy.id, delta }, score: scoreOrders(ruleset, side, projection, held) });
      }
    }
    if (candidates.length === 0) break;
    candidates.sort((a, b) => b.score - a.score);
    const top = candidates.slice(0, 3);
    // Weighted random among the top-k; allow stopping early for variety.
    const stopWeight = step === 0 ? 0.15 : 0.35;
    if (rng() < stopWeight) break;
    const weights = top.map((c, i) => Math.max(0.05, c.score + 3) / (i + 1));
    const total = weights.reduce((s, w) => s + w, 0);
    let roll = rng() * total;
    let pick = top[0]!;
    for (let i = 0; i < top.length; i++) {
      roll -= weights[i]!;
      if (roll <= 0) {
        pick = top[i]!;
        break;
      }
    }
    changes.push(pick.change);
  }
  return { changes };
}

/** Local projection of `orders` for `side` (opponent holds current levels). */
function project(
  ruleset: Ruleset,
  state: GameState,
  side: Side,
  orders: Orders,
): { indicators: Record<Indicator, number>; spend: number; income: number; solvent: boolean } {
  const levels = { ...state.levels[side] };
  for (const c of orders.changes) levels[c.policy] = (levels[c.policy] ?? 0) + c.delta;
  const totals = new Map<string, number>();
  const add = (target: string, delta: number) => totals.set(target, (totals.get(target) ?? 0) + delta);
  for (const s of ['state', 'terrorist'] as Side[]) {
    const sideLevels = s === side ? levels : state.levels[s];
    for (const policy of ruleset.policies[s]) {
      const lvl = sideLevels[policy.id] ?? 0;
      if (lvl === 0) continue;
      for (const eff of policy.effects[lvl] ?? []) add(eff.target, eff.delta);
    }
  }
  const { min, max } = ruleset.indicatorScale;
  const indicators = Object.fromEntries(
    (['stability', 'legitimacy', 'security', 'mobilization'] as Indicator[]).map((ind) => [
      ind,
      Math.min(max, Math.max(min, state.indicators[ind] + (totals.get(ind) ?? 0))),
    ]),
  ) as Record<Indicator, number>;
  const budgetTarget = side === 'state' ? 'stateBudget' : 'terroristBudget';
  const net = totals.get(budgetTarget) ?? 0;
  const spend = Math.max(0, -net);
  const income = ruleset.baseIncome[side] + Math.max(0, net);
  return { indicators, spend, income, solvent: spend <= state.budget[side] + state.bank[side] };
}
