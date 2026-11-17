export type Side = 'state' | 'terrorist';

export type StateIndicator = 'stability' | 'legitimacy';
export type TerroristIndicator = 'security' | 'mobilization';
export type Indicator = StateIndicator | TerroristIndicator;

/** Everything a policy effect can move. Budget targets are per-turn money flows. */
export type EffectTarget = Indicator | 'stateBudget' | 'terroristBudget';

export const INDICATORS: readonly Indicator[] = ['stability', 'legitimacy', 'security', 'mobilization'];

export function isIndicator(target: EffectTarget): target is Indicator {
  return (INDICATORS as readonly string[]).includes(target);
}

export interface Effect {
  target: EffectTarget;
  delta: number;
}

export interface Policy {
  id: string;
  title: string;
  /** One-line functional description (from the cheat sheets). */
  blurb: string;
  maxLevel: number;
  /**
   * effects[level] = total per-turn effects while the policy is HELD at that level.
   * Totals, not increments (A-01). Level 0 is always present and always empty
   * (ANSWERS.md G-01: all parameters equal 0 at L0).
   */
  effects: Record<number, Effect[]>;
}

export interface DangerThresholds {
  /** End-of-turn value <= criticalValue => immediate loss (criticalTurns is informational: 1). */
  criticalValue: number;
  criticalTurns: number;
  /** End-of-turn value <= sustainedValue for sustainedTurns counted turns => loss. */
  sustainedValue: number;
  sustainedTurns: number;
}

export interface SideDangerConfig extends DangerThresholds {
  indicators: Indicator[];
}

export interface Ruleset {
  version: string;
  baseIncome: Record<Side, number>;
  initial: {
    indicators: Record<Indicator, number>;
    /** Money available to spend in turn 1 (ANSWERS2/C-1: 100 for both sides). */
    budget: Record<Side, number>;
    /** Starting reserves (ANSWERS2/C-1: 100 for both sides). */
    bank: Record<Side, number>;
  };
  maxPolicyChangesPerTurn: number;
  indicatorScale: { min: number; max: number };
  /** Hard game length (ANSWERS.md G-07); reaching it ends the game — a draw, unless turnLimitJudge decides it. */
  turnLimit: number | null;
  /**
   * Optional tiebreak for games that reach the turn limit with no decisive loss
   * (ruleset v1.3). 'danger-indicator-margin': the side whose OWN danger indicators
   * sum higher (state: stability+legitimacy; terrorist: security+mobilization) wins;
   * an exact tie stays a draw. A simultaneous decisive loss still takes precedence.
   */
  turnLimitJudge?: 'danger-indicator-margin';
  /**
   * When submitted policy changes start to perform (effects AND upkeep):
   * 'next-turn' (default, v1.2.0 G-09): the turn after they are submitted, so a turn
   * with no prior changes has no policy effects/upkeep; 'same-turn' (v1.3.0): changes
   * become active during the very resolution they are submitted in — a new level's
   * effects and upkeep apply at the end of that same turn.
   */
  effectsTiming?: 'next-turn' | 'same-turn';
  danger: Record<Side, SideDangerConfig>;
  policies: Record<Side, Policy[]>;
  /** Traceability notes for decisions taken from GAPS.md/ANSWERS.md. */
  notes: string[];
}

export interface PolicyChange {
  policy: string;
  /** Exactly one level step per change (+1 or -1). */
  delta: 1 | -1;
}

export interface Orders {
  changes: PolicyChange[];
  /** If BOTH sides set this, the game ends in a draw. */
  agreeToDraw?: boolean;
}

export type GameStatus = 'active' | 'finished';
export type Winner = Side | 'draw';

export interface GameResult {
  winner: Winner;
  /** Losing-side-prefixed reasons (e.g. "state bankrupt ...") or neutral reasons for draws. */
  reasons: string[];
}

/**
 * Grace counter per threshold band (ANSWERS3.md F-5):
 *  -1 = not in danger (value above the band last end-of-turn);
 *   0 = threshold first hit this turn (grace — no loss);
 *   N = situation persisted for N turns after the hit.
 * Loss when the counter reaches the band's turn count (critical: 2nd consecutive hit turn;
 * sustained: 4th consecutive hit turn).
 */
export interface BandCounters {
  critical: number;
  sustained: number;
}

export interface DangerCounters {
  state: Record<StateIndicator, BandCounters>;
  terrorist: Record<TerroristIndicator, BandCounters>;
}

export interface GameState {
  rulesetVersion: string;
  turn: number;
  indicators: Record<Indicator, number>;
  /**
   * Policy levels ACTIVE during the upcoming resolution. Changes submitted in a turn are
   * applied after resolution and become active next turn (ANSWERS.md G-09).
   */
  levels: Record<Side, Record<string, number>>;
  /** This turn's spendable money (last turn's earnings). Not clamped. */
  budget: Record<Side, number>;
  /** Reserves; unspent budget consolidates here. Not clamped. */
  bank: Record<Side, number>;
  danger: DangerCounters;
  status: GameStatus;
  result: GameResult | null;
}

export interface EffectLogEntry {
  turn: number;
  actor: Side;
  policy: string;
  target: EffectTarget;
  delta: number;
  /** Final (clamped) indicator value after the full turn's net delta; null for budget targets. */
  resultingValue: number | null;
}

export interface EconomyLine {
  side: Side;
  /** Total money leaving the side this turn: own upkeep + opponent budget attacks. */
  spend: number;
  /** Income earned for next turn (base + positive budget effects). 0 if insolvent. */
  income: number;
  /** Next turn's spendable money (unchanged if insolvent — the game is over). */
  budgetAfter: number;
  bankAfter: number;
  /** True when spend exceeded budget+bank -> bankruptcy. */
  insolvent: boolean;
}

export interface TurnSummary {
  state: GameState;
  log: EffectLogEntry[];
  economy: EconomyLine[];
  events: string[];
}

export interface OrdersValidation {
  valid: boolean;
  errors: string[];
}

/** What one resolution will do to money and indicators, without mutating anything. */
export interface TurnProjection {
  indicators: Record<Indicator, number>;
  /** Total outflow: own upkeep + opponent budget attacks. */
  spend: number;
  /** Income earned for next turn if solvent. */
  income: number;
  budgetAfter: number;
  bankAfter: number;
  /** false -> this projection ends in bankruptcy. */
  solvent: boolean;
}

/** Forecast for a side's resulting levels once they become active (next turn). */
export interface OrdersPreview {
  errors: string[];
  levels: Record<string, number>;
  projection: TurnProjection;
}
