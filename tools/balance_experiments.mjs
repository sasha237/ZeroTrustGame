// Balance experiments: run the seeded sim against variant rulesets to see which
// single changes (and which combination) move the decisive-game split toward 50/50.
// Usage: node tools/balance_experiments.mjs [games] [seed]
import { rulesetV1 } from '../packages/engine/dist/index.js';
import { runSimulation } from '../packages/sim/dist/runner.js';

const GAMES = Number(process.argv[2] ?? 2000);
const SEED = Number(process.argv[3] ?? 42);

function clone() {
  return structuredClone(rulesetV1);
}

function policy(rs, side, id) {
  const p = rs.policies[side].find((x) => x.id === id);
  if (!p) throw new Error(`no policy ${side}/${id}`);
  return p;
}

/** Apply a list of [side, policyId, level, target, newDelta] tweaks. */
function tweak(rs, tweaks) {
  for (const [side, id, level, target, delta] of tweaks) {
    const eff = policy(rs, side, id).effects[level];
    const e = eff?.find((x) => x.target === target);
    if (!e) throw new Error(`no effect ${side}/${id}@${level} -> ${target}`);
    e.delta = delta;
  }
  return rs;
}

const variants = [
  ['V0 baseline (v1.2.0 as-is)', (rs) => rs],
  // Remove the turn-2 Mobilization cliff: terrorist starts with a buffer.
  ['V1 initial mobilization 0 -> 35', (rs) => {
    rs.initial.indicators.mobilization = 35;
    return rs;
  }],
  // Nerf the State's mobilization-killers (Reforms is the main one).
  ['V2 reforms mob -15/-40/-60 -> -10/-25/-40', (rs) => tweak(rs, [
    ['state', 'reforms', 1, 'mobilization', -10],
    ['state', 'reforms', 2, 'mobilization', -25],
    ['state', 'reforms', 3, 'mobilization', -40],
  ])],
  // Nerf the State's budget attacks on the terrorist economy.
  ['V3 counterFin -20->-10, counterNarr tb -5/-10/-15 -> -2/-5/-8', (rs) => tweak(rs, [
    ['state', 'counterFinances', 1, 'terroristBudget', -10],
    ['state', 'counterNarrative', 1, 'terroristBudget', -2],
    ['state', 'counterNarrative', 2, 'terroristBudget', -5],
    ['state', 'counterNarrative', 3, 'terroristBudget', -8],
  ])],
  // Buff the Terrorist's budget attack (Subversive Action is nearly useless at -3..-9).
  ['V4 subversiveAction stateBudget -3/-6/-9 -> -10/-20/-30', (rs) => tweak(rs, [
    ['terrorist', 'subversiveAction', 1, 'stateBudget', -10],
    ['terrorist', 'subversiveAction', 2, 'stateBudget', -20],
    ['terrorist', 'subversiveAction', 3, 'stateBudget', -30],
  ])],
  // Halve the Attacks policy's self-harm on the terrorist's own danger indicators.
  ['V5 attacks self-harm halved (security & mobilization)', (rs) => tweak(rs, [
    ['terrorist', 'attacks', 1, 'security', -2],
    ['terrorist', 'attacks', 2, 'security', -3],
    ['terrorist', 'attacks', 3, 'security', -5],
    ['terrorist', 'attacks', 4, 'security', -6],
    ['terrorist', 'attacks', 5, 'security', -8],
    ['terrorist', 'attacks', 3, 'mobilization', -3],
    ['terrorist', 'attacks', 4, 'mobilization', -5],
    ['terrorist', 'attacks', 5, 'mobilization', -10],
  ])],
  // Everything above combined.
  ['V6 combined (V1+V2+V3+V4+V5)', (rs) => {
    rs.initial.indicators.mobilization = 35;
    return tweak(rs, [
      ['state', 'reforms', 1, 'mobilization', -10],
      ['state', 'reforms', 2, 'mobilization', -25],
      ['state', 'reforms', 3, 'mobilization', -40],
      ['state', 'counterFinances', 1, 'terroristBudget', -10],
      ['state', 'counterNarrative', 1, 'terroristBudget', -2],
      ['state', 'counterNarrative', 2, 'terroristBudget', -5],
      ['state', 'counterNarrative', 3, 'terroristBudget', -8],
      ['terrorist', 'subversiveAction', 1, 'stateBudget', -10],
      ['terrorist', 'subversiveAction', 2, 'stateBudget', -20],
      ['terrorist', 'subversiveAction', 3, 'stateBudget', -30],
      ['terrorist', 'attacks', 1, 'security', -2],
      ['terrorist', 'attacks', 2, 'security', -3],
      ['terrorist', 'attacks', 3, 'security', -5],
      ['terrorist', 'attacks', 4, 'security', -6],
      ['terrorist', 'attacks', 5, 'security', -8],
      ['terrorist', 'attacks', 3, 'mobilization', -3],
      ['terrorist', 'attacks', 4, 'mobilization', -5],
      ['terrorist', 'attacks', 5, 'mobilization', -10],
    ]);
  }],
];

console.log(`games=${GAMES} seed=${SEED} (paired: same PRNG stream per game index across variants)`);
console.log(''.padEnd(64) + ' state  terrorist   draw  | decisive split (S/T)  avgLen  flags(t2idle/pinned)');
const rows = [];
for (const [label, apply] of variants) {
  const t0 = Date.now();
  const result = runSimulation({ games: GAMES, seed: SEED, ruleset: apply(clone()) });
  const wins = { state: 0, terrorist: 0, draw: 0 };
  for (const r of result.records) wins[r.winner]++;
  const dec = wins.state + wins.terrorist;
  const avgLen = result.records.reduce((s, r) => s + r.turns, 0) / GAMES;
  const t2 = result.records.filter((r) => r.terroristIdleTurn2).length;
  const pinned = result.records.filter((r) => r.pinned.length > 0).length;
  const sPct = ((100 * wins.state) / GAMES).toFixed(1).padStart(5);
  const tPct = ((100 * wins.terrorist) / GAMES).toFixed(1).padStart(5);
  const dPct = ((100 * wins.draw) / GAMES).toFixed(1).padStart(5);
  const split = dec === 0 ? 'n/a' : `${((100 * wins.state) / dec).toFixed(1)}% / ${((100 * wins.terrorist) / dec).toFixed(1)}%`;
  console.log(
    `${label.padEnd(62)} ${sPct}  ${tPct}  ${dPct}  | ${split.padStart(18)}  ${avgLen.toFixed(1).padStart(5)}  ${t2}/${pinned}  [${result.failures.length} inv failures, ${((Date.now() - t0) / 1000).toFixed(0)}s]`,
  );
  rows.push({ label, wins, dec, avgLen, t2, pinned, failures: result.failures.length });
}

import { writeFileSync } from 'node:fs';
writeFileSync('balance-experiments.json', JSON.stringify({ games: GAMES, seed: SEED, rows }, null, 2));
console.log('\nwrote balance-experiments.json');
