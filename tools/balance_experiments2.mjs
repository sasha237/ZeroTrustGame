// Balance experiments, round 2: build on the round-1 winner (mobilization start 35)
// and attack the two remaining state edges: the cheap security blitz and the
// terrorist's inability to afford high attack levels. Also tests income tweaks.
// Usage: node tools/balance_experiments2.mjs [games] [seed]
import { rulesetV1 } from '../packages/engine/dist/index.js';
import { runSimulation } from '../packages/sim/dist/runner.js';
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

const MOB35 = (rs) => { rs.initial.indicators.mobilization = 35; return rs; };

const variants = [
  // R2-A: nerf the State's cheap security attack (killCapture is -60 security for -40;
  //        Emergency Legislation is -30 security for ZERO budget cost).
  ['R2-A mob35 + state sec-attack nerf', (rs) => tweak(MOB35(rs), [
    ['state', 'killCapture', 1, 'security', -10],
    ['state', 'killCapture', 2, 'security', -30],
    ['state', 'killCapture', 3, 'security', -45],
    ['state', 'emergencyLegislation', 1, 'security', -10],
    ['state', 'emergencyLegislation', 2, 'security', -20],
  ])],
  // R2-B: discount Attacks upkeep so the terrorist can actually press high levels
  //        (-10/-25/-45/-70/-100 -> -8/-20/-36/-56/-80).
  ['R2-B mob35 + attacks upkeep -20%', (rs) => tweak(MOB35(rs), [
    ['terrorist', 'attacks', 1, 'terroristBudget', -8],
    ['terrorist', 'attacks', 2, 'terroristBudget', -20],
    ['terrorist', 'attacks', 3, 'terroristBudget', -36],
    ['terrorist', 'attacks', 4, 'terroristBudget', -56],
    ['terrorist', 'attacks', 5, 'terroristBudget', -80],
  ])],
  // R2-C: raise terrorist base income 100 -> 120 (state keeps 100 + Taxes edge).
  ['R2-C mob35 + terrorist income 120', (rs) => {
    MOB35(rs);
    rs.baseIncome.terrorist = 120;
    return rs;
  }],
  // R2-D: A+B combined.
  ['R2-D mob35 + sec-attack nerf + upkeep discount', (rs) => tweak(MOB35(rs), [
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
  ])],
  // R2-E: D + terrorist income 120 (maximal terrorist-favorable package).
  ['R2-E D + terrorist income 120', (rs) => {
    tweak(MOB35(rs), [
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
    ]);
    rs.baseIncome.terrorist = 120;
    return rs;
  }],
  // R2-F: D with a shorter turn limit (40) — checks whether more games resolve
  //        decisively instead of dragging to a draw (draws were ~77% in round 1).
  ['R2-F D + turnLimit 40', (rs) => {
    tweak(MOB35(rs), [
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
    ]);
    rs.turnLimit = 40;
    return rs;
  }],
];

console.log(`games=${GAMES} seed=${SEED} (paired PRNG streams)`);
console.log(''.padEnd(56) + ' state  terrorist   draw  | decisive split (S/T)  avgLen  flags(t2idle/pinned)');
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
  console.log(`${label.padEnd(54)} ${sPct}  ${tPct}  ${dPct}  | ${split.padStart(18)}  ${avgLen.toFixed(1).padStart(5)}  ${t2}/${pinned}  [${result.failures.length} inv failures, ${((Date.now() - t0) / 1000).toFixed(0)}s]`);
  rows.push({ label, wins, dec, avgLen, t2, pinned, failures: result.failures.length });
}

writeFileSync('balance-experiments2.json', JSON.stringify({ games: GAMES, seed: SEED, rows }, null, 2));
console.log('\nwrote balance-experiments2.json');
