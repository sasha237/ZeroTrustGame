// Balance experiments, round 4: seed-stability check of the R3-B winner
// (R2-D core + judged ending @50) plus a turnLimit-60 variant to reduce draws.
// Usage: node tools/balance_experiments4.mjs [games] [seed]
import { rulesetV1, getInitialState, resolveTurn, validateOrders } from '../packages/engine/dist/index.js';
import { runSimulation } from '../packages/sim/dist/runner.js';
import { proposeOrders } from '../packages/sim/dist/bots.js';
import { mulberry32 } from '../packages/sim/dist/prng.js';
import { assertTurnInvariants } from '../packages/sim/dist/invariants.js';
import { writeFileSync } from 'node:fs';

const GAMES = Number(process.argv[2] ?? 3000);
const SEED = Number(process.argv[3] ?? 7);

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
  return { wins, dec: wins.state + wins.terrorist, avgLen: turnsSum / games, judged, failures };
}

function report(label, stats, games, t0) {
  const { wins, dec, avgLen } = stats;
  const sPct = ((100 * wins.state) / games).toFixed(1).padStart(5);
  const tPct = ((100 * wins.terrorist) / games).toFixed(1).padStart(5);
  const dPct = ((100 * wins.draw) / games).toFixed(1).padStart(5);
  const split = dec === 0 ? 'n/a' : `${((100 * wins.state) / dec).toFixed(1)}% / ${((100 * wins.terrorist) / dec).toFixed(1)}%`;
  console.log(`${label.padEnd(48)} ${sPct}  ${tPct}  ${dPct}  | ${split.padStart(18)}  ${avgLen.toFixed(1).padStart(5)}  ${stats.judged ?? 0} judged  [${stats.failures} inv failures, ${((Date.now() - t0) / 1000).toFixed(0)}s]`);
  return { label, ...stats };
}

console.log(`games=${GAMES} seed=${SEED}`);
console.log(''.padEnd(50) + ' state  terrorist   draw  | decisive split (S/T)  avgLen  judged');
const rows = [];

{
  const t0 = Date.now();
  const result = runSimulation({ games: GAMES, seed: SEED, ruleset: clone() });
  const wins = { state: 0, terrorist: 0, draw: 0 };
  for (const r of result.records) wins[r.winner]++;
  rows.push(report('baseline v1.2.0 (no judge)', {
    wins, dec: wins.state + wins.terrorist,
    avgLen: result.records.reduce((s, r) => s + r.turns, 0) / GAMES,
    judged: 0, failures: result.failures.length + result.botRejections,
  }, GAMES, t0));
}
{
  const t0 = Date.now();
  rows.push(report('core + judged @50 (seed check)', runWithJudge(core(clone()), GAMES, SEED), GAMES, t0));
}
{
  const t0 = Date.now();
  const rs = core(clone());
  rs.turnLimit = 60;
  rows.push(report('core + judged @60', runWithJudge(rs, GAMES, SEED), GAMES, t0));
}

writeFileSync(`balance-experiments4-seed${SEED}.json`, JSON.stringify({ games: GAMES, seed: SEED, rows }, null, 2));
console.log(`\nwrote balance-experiments4-seed${SEED}.json`);
