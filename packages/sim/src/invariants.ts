import type { GameState, Indicator, Ruleset, Side, TurnSummary } from '@bot/engine';

export interface InvariantFailure {
  game: number;
  turn: number;
  seed: number;
  check: string;
  detail: string;
}

export type InvariantResult = { ok: true } | { ok: false; failures: InvariantFailure[] };

const INDICATORS: readonly Indicator[] = ['stability', 'legitimacy', 'security', 'mobilization'];
const SIDES: readonly Side[] = ['state', 'terrorist'];

const REASON_PATTERNS = [
  /bankrupt/,
  /critical, persisted/,
  /<=\s*\d+, persisted \d+ counted turns/,
  /turn limit \d+ reached/,
  /mutual agreement to draw/,
];

/**
 * Per-turn invariant assertions (A-22). Fails loud with game/turn/seed context.
 * `before` is the pre-resolution state; `summary`/`after` the resolution outputs.
 */
export function assertTurnInvariants(
  ruleset: Ruleset,
  before: GameState,
  summary: TurnSummary,
  after: GameState,
  ctx: { game: number; turn: number; seed: number },
): InvariantResult {
  const failures: InvariantFailure[] = [];
  const fail = (check: string, detail: string) => failures.push({ ...ctx, check, detail });

  // --- no NaN/undefined anywhere numeric ---
  for (const ind of INDICATORS) {
    const v = after.indicators[ind];
    if (typeof v !== 'number' || Number.isNaN(v)) fail('indicator-nan', `${ind}=${String(v)}`);
  }
  for (const side of SIDES) {
    for (const money of [after.budget[side], after.bank[side]]) {
      if (typeof money !== 'number' || Number.isNaN(money)) fail('money-nan', `${side} ${String(money)}`);
    }
  }

  // --- indicators: integers within the scale ---
  for (const ind of INDICATORS) {
    const v = after.indicators[ind];
    if (!Number.isInteger(v)) fail('indicator-integer', `${ind}=${v}`);
    if (v < ruleset.indicatorScale.min || v > ruleset.indicatorScale.max) {
      fail('indicator-range', `${ind}=${v} outside [${ruleset.indicatorScale.min},${ruleset.indicatorScale.max}]`);
    }
  }

  // --- policy levels: integers within [0, maxLevel] ---
  for (const side of SIDES) {
    for (const policy of ruleset.policies[side]) {
      const lvl = after.levels[side][policy.id] ?? 0;
      if (!Number.isInteger(lvl)) fail('level-integer', `${side}.${policy.id}=${lvl}`);
      if (lvl < 0 || lvl > policy.maxLevel) fail('level-range', `${side}.${policy.id}=${lvl} max ${policy.maxLevel}`);
    }
  }

  // --- danger counters consistent with band membership (ANSWERS3 F-5) ---
  for (const side of SIDES) {
    const cfg = ruleset.danger[side];
    for (const ind of cfg.indicators) {
      const counters = (after.danger[side] as Record<Indicator, { critical: number; sustained: number }>)[ind]!;
      const value = after.indicators[ind];
      if ((value > cfg.criticalValue) !== (counters.critical === -1)) {
        fail('danger-critical-counter', `${side}.${ind} v=${value} critical=${counters.critical}`);
      }
      if ((value > cfg.sustainedValue) !== (counters.sustained === -1)) {
        fail('danger-sustained-counter', `${side}.${ind} v=${value} sustained=${counters.sustained}`);
      }
      if (counters.critical < -1 || counters.sustained < -1) {
        fail('danger-counter-floor', `${side}.${ind} c=${counters.critical} s=${counters.sustained}`);
      }
    }
  }

  // --- money math vs the pre-resolution state ---
  for (const side of SIDES) {
    const line = summary.economy.find((e) => e.side === side);
    if (!line) continue; // mutual-draw path carries no economy lines
    const budgetBefore = before.budget[side];
    const bankBefore = before.bank[side];
    if (line.insolvent) {
      if (!(line.spend > budgetBefore + bankBefore)) {
        fail('solvency-rule', `${side} insolvent but spend ${line.spend} <= ${budgetBefore + bankBefore}`);
      }
      if (line.budgetAfter !== budgetBefore || line.bankAfter !== bankBefore) {
        fail('insolvent-money-frozen', `${side} money moved despite insolvency`);
      }
    } else {
      if (line.budgetAfter !== line.income) fail('budget-is-income', `${side} budgetAfter ${line.budgetAfter} != income ${line.income}`);
      if (line.bankAfter !== bankBefore + budgetBefore - line.spend) {
        fail('bank-math', `${side} bankAfter ${line.bankAfter} != ${bankBefore}+${budgetBefore}-${line.spend}`);
      }
      if (line.income < ruleset.baseIncome[side]) {
        fail('income-floor', `${side} income ${line.income} < base ${ruleset.baseIncome[side]}`);
      }
    }
  }

  // --- game end: known reasons only; turn limit never overrules a decisive loss ---
  if (after.status === 'finished') {
    if (!after.result) fail('result-missing', 'finished without result');
    else {
      if (!['state', 'terrorist', 'draw'].includes(after.result.winner)) fail('winner-range', after.result.winner);
      if (after.result.reasons.length === 0) fail('reasons-empty', 'finished without reasons');
      for (const reason of after.result.reasons) {
        if (!REASON_PATTERNS.some((re) => re.test(reason))) fail('reason-unknown', reason);
      }
      // The turn cap ends the game in a draw when nothing else has decided it — unless
      // the ruleset configures a turn-limit judge, in which case the winner must match
      // the recomputed danger-indicator margin. A simultaneous decisive loss
      // (bankruptcy / danger band) takes precedence either way (frozen behavior,
      // ANSWERS.md G-07 is silent on precedence).
      const hasTurnLimit = after.result.reasons.some((r) => /turn limit \d+ reached/.test(r));
      const hasDecisive = after.result.reasons.some((r) => /bankrupt|critical, persisted|counted turns/.test(r));
      if (hasTurnLimit && !hasDecisive && after.result.winner !== 'draw') {
        if (ruleset.turnLimitJudge === 'danger-indicator-margin') {
          const stateScore = after.indicators.stability + after.indicators.legitimacy;
          const terroristScore = after.indicators.security + after.indicators.mobilization;
          const expected = stateScore === terroristScore ? 'draw' : stateScore > terroristScore ? 'state' : 'terrorist';
          if (after.result.winner !== expected) {
            fail('judge-mismatch', `judge gave ${after.result.winner}, margin recomputes to ${expected} (${stateScore} vs ${terroristScore})`);
          }
        } else {
          fail('turn-limit-draw', `winner ${after.result.winner} on turn limit alone`);
        }
      }
    }
  } else if (after.turn !== before.turn + 1) {
    fail('turn-advance', `turn ${before.turn} -> ${after.turn}`);
  }

  return failures.length === 0 ? { ok: true } : { ok: false, failures };
}
