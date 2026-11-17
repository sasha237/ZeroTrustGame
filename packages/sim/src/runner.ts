import {
  getInitialState,
  resolveTurn,
  rulesetV1_3,
  validateOrders,
  type GameResult,
  type Indicator,
  type Orders,
  type Ruleset,
  type Side,
} from '@bot/engine';
import { mulberry32, type Prng } from './prng.js';
import { proposeOrders } from './bots.js';
import { assertTurnInvariants, type InvariantFailure } from './invariants.js';

export interface GameRecord {
  index: number;
  seed: number;
  turns: number;
  winner: GameResult['winner'];
  reasons: string[];
  /** True when the terrorist failed to act in turn 1 and lost to the Mobilization gate on turn 2. */
  terroristIdleTurn2: boolean;
  /** Indicators pinned at the scale edge for >=5 consecutive end-of-turn values. */
  pinned: string[];
  /** True when the terrorist's turn-1 orders lifted Mobilization (the "recruit first" gate). */
  terroristRecruitedTurn1: boolean;
}

export interface SimulationResult {
  rulesetVersion: string;
  games: number;
  seed: number;
  records: GameRecord[];
  failures: InvariantFailure[];
  /** Bot-proposed orders rejected by validateOrders (must stay 0). */
  botRejections: number;
  wallMs: number;
}

const PIN_TURNS = 5;

function checkPinning(series: Map<string, number[]>, record: GameRecord): void {
  for (const [key, values] of series) {
    let run = 0;
    let maxRun = 0;
    for (const v of values) {
      run = v === 0 || v === 100 ? run + 1 : 0;
      maxRun = Math.max(maxRun, run);
    }
    if (maxRun >= PIN_TURNS) record.pinned.push(key);
  }
}

function mobilizationLift(ruleset: Ruleset, orders: Orders): boolean {
  for (const change of orders.changes) {
    const policy = ruleset.policies.terrorist.find((p) => p.id === change.policy);
    if (!policy) continue;
    const level = change.delta; // from 0 -> 1 on turn 1
    const effects = policy.effects[level] ?? [];
    if (effects.some((e) => e.target === 'mobilization' && e.delta > 0)) return true;
  }
  return false;
}

/**
 * Runs `n` full auto-games with seeded heuristic bots, asserting per-turn invariants.
 * Fully deterministic for a given (seed, n, ruleset): the PRNG stream is the only
 * entropy, and the engine itself is pure.
 */
export function runSimulation(options: { games: number; seed: number; ruleset?: Ruleset; onProgress?: (done: number) => void }): SimulationResult {
  const ruleset = options.ruleset ?? rulesetV1_3;
  const started = Date.now();
  const records: GameRecord[] = [];
  const failures: InvariantFailure[] = [];
  let botRejections = 0;

  for (let gameIndex = 0; gameIndex < options.games; gameIndex++) {
    const rng: Prng = mulberry32(options.seed + gameIndex * 0x9e3779b9);
    let state = getInitialState(ruleset);
    const indicatorSeries = new Map<string, number[]>();
    let terroristTurn1: Orders | null = null;

    const record: GameRecord = {
      index: gameIndex,
      seed: options.seed,
      turns: 0,
      winner: 'draw',
      reasons: [],
      terroristIdleTurn2: false,
      pinned: [],
      terroristRecruitedTurn1: false,
    };

    while (state.status === 'active') {
      const stateOrders = proposeOrders(ruleset, state, 'state', rng);
      const terroristOrders = proposeOrders(ruleset, state, 'terrorist', rng);
      if (state.turn === 1) {
        terroristTurn1 = terroristOrders;
        record.terroristRecruitedTurn1 = mobilizationLift(ruleset, terroristOrders);
      }
      for (const [side, orders] of [['state', stateOrders], ['terrorist', terroristOrders]] as [Side, Orders][]) {
        const errors = validateOrders(ruleset, state, side, orders);
        if (errors.length > 0) {
          botRejections += 1;
          failures.push({ game: gameIndex, turn: state.turn, seed: options.seed, check: 'bot-orders-rejected', detail: `${side}: ${errors.join('; ')}` });
        }
      }

      const summary = resolveTurn(ruleset, state, stateOrders, terroristOrders);
      const check = assertTurnInvariants(ruleset, state, summary, summary.state, {
        game: gameIndex,
        turn: state.turn,
        seed: options.seed,
      });
      if (!check.ok) failures.push(...check.failures);

      for (const ind of ['stability', 'legitimacy', 'security', 'mobilization'] as Indicator[]) {
        const key = ind;
        const list = indicatorSeries.get(key) ?? [];
        list.push(summary.state.indicators[ind]);
        indicatorSeries.set(key, list);
      }
      state = summary.state;
    }

    record.turns = state.turn;
    record.winner = state.result?.winner ?? 'draw';
    record.reasons = state.result?.reasons ?? [];
    record.terroristIdleTurn2 =
      record.turns === 2 &&
      record.winner === 'state' &&
      record.reasons.some((r) => r.startsWith('terrorist mobilization')) &&
      !record.terroristRecruitedTurn1;
    checkPinning(indicatorSeries, record);
    records.push(record);
    options.onProgress?.(gameIndex + 1);
  }

  return {
    rulesetVersion: ruleset.version,
    games: options.games,
    seed: options.seed,
    records,
    failures,
    botRejections,
    wallMs: Date.now() - started,
  };
}
