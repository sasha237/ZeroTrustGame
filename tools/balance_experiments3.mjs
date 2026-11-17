// Balance experiments, round 3: R2-D is the near-balanced core (55.4/44.6 decisive).
// Remaining problem: ~78% draws. Test (a) longer turn limit, (b) mutual defense trim,
// (c) a JUDGED ENDING — when the turn limit is reached, the side whose own danger
// indicators sit further from the danger bands wins (draw only on exact tie).
// Usage: node tools/balance_experiments3.mjs [games] [seed]
import {
  rulesetV1,
  getInitialState,
  resolveTurn,
  validateOrders,
} from '../packages/engine/dist/index.js';
import { runSimulation } from '../packages/sim/dist/runner.js';
import { proposeOrders } from '../packages/sim/dist/bots.js';
import { mulberry32 } from '../packages/sim/dist/prng.js';
import { assertTurnInvariants } from '../packages/sim/dist/invariants.js';
import { writeFileSync } from 'node:fs';

const GAMES = Number(process.argv[2] ?? 2500);
const SEED = Number(process.argv[3] ?? 42);

function clone() { return structuredClone(rulesetV1); }
function policy(rs, side, id) {
  const p = rs.policies[side].find((x) => x.id === id);
  if (!p) throw new Error(`no policy ${side}/${id}`);
  return p;
}
function tweak(rs, tweaks) {
  for (const [side, id, level, target, delta] of tweaks) {
    const e = policy(rs, side, id).effects[level]?.find((x) => x.target === target);
    if (!e) throw new Error(`no effect ${side}/${id}@${level} -> ${target}`);
    e.delta = delta;
  }
  return rs;
}

// The R2-D core: mobilization start 35, state sec-attack nerf, attacks upkeep -20%.
const CORE_TWEAKS = [
  ['state', 'killCapture', 1, 'security', -10],
  ['state', 'killCapture', 2, 'security', -30],
  ['state', 'killCapture', 3, 'security', -45],
  ['state', 'emergencyLegislation', 1, 'security', -10],
  ['state', 'emergencyLegislation', 2, 'security', -20],
  ['terrorist', 'attacks', 1, 'terroristBudget', -8],
  ['terrorist', 'attacks', 2, 'terroristBudget', -20],
  ['terrorist', 'attacks', 3, 'terroristBudget', -36],
  ['terrorist', 'attacks', 4, 'terroristBudget', -56],
  ['terrorist', 'attacks', 5, 'terroristBudget', -80],
];
const core = (rs) => {
  rs.initial.indicators.mobilization = 35;
  return tweak(rs, CORE_TWEAKS);
};

// Mutual defense trim: Operational Security 25/50/75/100 -> 20/40/60/80,
// Intelligence stability 20/40/60 -> 15/30/45, Counter-Narrative leg 10/20/30 -> 8/16/24,
// Policing stability 20/50/80 -> 15/40/65.
const DEFENSE_TRIM = [
  ['terrorist', 'operationalSecurity', 1, 'security', 20],
  ['terrorist', 'operationalSecurity', 2, 'security', 40],
  ['terrorist', 'operationalSecurity', 3, 'security', 60],
  ['terrorist', 'operationalSecurity', 4, 'security', 80],
  ['state', 'intelligence', 1, 'stability', 15],
  ['state', 'intelligence', 2, 'stability', 30],
  ['state', 'intelligence', 3, 'stability', 45],
  ['state', 'counterNarrative', 1, 'legitimacy', 8],
  ['state', 'counterNarrative', 2, 'legitimacy', 16],
  ['state', 'counterNarrative', 3, 'legitimacy', 24],
  ['state', 'policing', 1, 'stability', 15],
  ['state', 'policing', 2, 'stability', 40],
  ['state', 'policing', 3, 'stability', 65],
];

/**
 * Run with a judged ending: games that hit the turn limit without a decisive result
 * are scored by danger-indicator margin — side with the higher sum of its OWN danger
 * indicators wins; exact tie stays a draw. Returns {wins, dec, avgLen, judged}.
 */
function runWithJudge(ruleset, games, seed) {
  const wins = { state: 0, terrorist: 0, draw: 0 };
  let judged = 0;
  let turnsSum = 0;
  let failures = 0;
  for (let g = 0; g < games; g++) {
    const rng = mulberry32(seed + g * 0x9e3779b9);
    let state = getInitialState(ruleset);
    while (state.status === 'active') {
      const so = proposeOrders(ruleset, state, 'state', rng);
      const to = proposeOrders(ruleset, state, 'terrorist', rng);
      if (validateOrders(ruleset, state, 'state', so).length || validateOrders(ruleset, state, 'terrorist', to).length) failures++;
      const summary = resolveTurn(ruleset, state, so, to);
      const check = assertTurnInvariants(ruleset, state, summary, summary.state, { game: g, turn: state.turn, seed });
      if (!check.ok) failures += check.failures.length;
      state = summary.state;
    }
    turnsSum += state.turn;
    let winner = state.result?.winner ?? 'draw';
    if (winner === 'draw' && state.result?.reasons.some((r) => /turn limit/.test(r))) {
      judged++;
      const sScore = state.indicators.stability + state.indicators.legitimacy;
      const tScore = state.indicators.security + state.indicators.mobilization;
      winner = sScore === tScore ? 'draw' : sScore > tScore ? 'state' : 'terrorist';
    }
    wins[winner]++;
  }
  const dec = wins.state + wins.terrorist;
  return { wins, dec, avgLen: turnsSum / games, judged, failures };
}

const variants = [
  ['R3-A core + turnLimit 70', (rs) => { core(rs); rs.turnLimit = 70; return rs; }, false],
  ['R3-B core + judged ending @50', (rs) => core(rs), true],
  ['R3-C core + defense trim', (rs) => tweak(core(rs), DEFENSE_TRIM), false],
  ['R3-D core + defense trim + judged @50', (rs) => tweak(core(rs), DEFENSE_TRIM), true],
];

console.log(`games=${GAMES} seed=${SEED} (paired PRNG streams)`);
console.log(''.padEnd(50) + ' state  terrorist   draw  | decisive split (S/T)  avgLen  judged');
const rows = [];
for (const [label, apply, judged] of variants) {
  const t0 = Date.now();
  let stats;
  if (judged) {
    stats = runWithJudge(apply(clone()), GAMES, SEED);
  } else {
    const result = runSimulation({ games: GAMES, seed: SEED, ruleset: apply(clone()) });
    const wins = { state: 0, terrorist: 0, draw: 0 };
    for (const r of result.records) wins[r.winner]++;
    stats = {
      wins,
      dec: wins.state + wins.terrorist,
      avgLen: result.records.reduce((s, r) => s + r.turns, 0) / GAMES,
      judged: 0,
      failures: result.failures.length + result.botRejections,
    };
  }
  const { wins, dec, avgLen } = stats;
  const sPct = ((100 * wins.state) / GAMES).toFixed(1).padStart(5);
  const tPct = ((100 * wins.terrorist) / GAMES).toFixed(1).padStart(5);
  const dPct = ((100 * wins.draw) / GAMES).toFixed(1).padStart(5);
  const split = dec === 0 ? 'n/a' : `${((100 * wins.state) / dec).toFixed(1)}% / ${((100 * wins.terrorist) / dec).toFixed(1)}%`;
  console.log(`${label.padEnd(48)} ${sPct}  ${tPct}  ${dPct}  | ${split.padStart(18)}  ${avgLen.toFixed(1).padStart(5)}  ${stats.judged} judged  [${stats.failures} inv failures, ${((Date.now() - t0) / 1000).toFixed(0)}s]`);
  rows.push({ label, ...stats });
}

writeFileSync('balance-experiments3.json', JSON.stringify({ games: GAMES, seed: SEED, rows }, null, 2));
console.log('\nwrote balance-experiments3.json');
