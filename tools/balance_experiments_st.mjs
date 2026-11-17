// Balance re-tune under SAME-TURN timing: the timing change attacker-favored the
// terrorist (10k: 22/78 decisive). Find which lever(s) restore ~50/50.
// Usage: node tools/balance_experiments_st.mjs [games] [seed]
import { rulesetV1_3 } from '../packages/engine/dist/index.js';
import { runSimulation } from '../packages/sim/dist/runner.js';

const GAMES = Number(process.argv[2] ?? 2000);
const SEED = Number(process.argv[3] ?? 42);

function clone() { return structuredClone(rulesetV1_3); }
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

const variants = [
  ['ST-baseline (current v1.3 + same-turn)', (rs) => rs],
  // The state's security kill pressure was nerfed for the next-turn meta; restore it.
  ['ST + state sec-attack restored (v1.2 numbers)', (rs) => tweak(rs, [
    ['state', 'killCapture', 1, 'security', -15],
    ['state', 'killCapture', 2, 'security', -40],
    ['state', 'killCapture', 3, 'security', -60],
    ['state', 'emergencyLegislation', 1, 'security', -15],
    ['state', 'emergencyLegislation', 2, 'security', -30],
  ])],
  // Soften the terrorist's stability/legitimacy damage (the same-turn blitz weapon).
  ['ST + attacks damage softened', (rs) => tweak(rs, [
    ['terrorist', 'attacks', 1, 'stability', -25],
    ['terrorist', 'attacks', 2, 'stability', -35],
    ['terrorist', 'attacks', 3, 'stability', -45],
    ['terrorist', 'attacks', 4, 'stability', -90],
    ['terrorist', 'attacks', 5, 'stability', -110],
    ['terrorist', 'attacks', 1, 'legitimacy', -4],
    ['terrorist', 'attacks', 2, 'legitimacy', -8],
    ['terrorist', 'attacks', 3, 'legitimacy', -12],
    ['terrorist', 'attacks', 4, 'legitimacy', -16],
    ['terrorist', 'attacks', 5, 'legitimacy', -20],
  ])],
  ['ST + both (sec-attack restored + attacks softened)', (rs) => tweak(rs, [
    ['state', 'killCapture', 1, 'security', -15],
    ['state', 'killCapture', 2, 'security', -40],
    ['state', 'killCapture', 3, 'security', -60],
    ['state', 'emergencyLegislation', 1, 'security', -15],
    ['state', 'emergencyLegislation', 2, 'security', -30],
    ['terrorist', 'attacks', 1, 'stability', -25],
    ['terrorist', 'attacks', 2, 'stability', -35],
    ['terrorist', 'attacks', 3, 'stability', -45],
    ['terrorist', 'attacks', 4, 'stability', -90],
    ['terrorist', 'attacks', 5, 'stability', -110],
  ])],
  // State defensive boosts up instead (intelligence/policing stability).
  ['ST + state defense boosted', (rs) => tweak(rs, [
    ['state', 'intelligence', 1, 'stability', 25],
    ['state', 'intelligence', 2, 'stability', 50],
    ['state', 'intelligence', 3, 'stability', 75],
    ['state', 'policing', 1, 'stability', 25],
    ['state', 'policing', 2, 'stability', 60],
    ['state', 'policing', 3, 'stability', 95],
  ])],
];

console.log(`games=${GAMES} seed=${SEED} (same-turn timing; paired PRNG streams)`);
console.log(''.padEnd(56) + ' state  terrorist   draw  | decisive split (S/T)  avgLen');
for (const [label, apply] of variants) {
  const t0 = Date.now();
  const result = runSimulation({ games: GAMES, seed: SEED, ruleset: apply(clone()) });
  const wins = { state: 0, terrorist: 0, draw: 0 };
  for (const r of result.records) wins[r.winner]++;
  const dec = wins.state + wins.terrorist;
  const avgLen = result.records.reduce((s, r) => s + r.turns, 0) / GAMES;
  const sPct = ((100 * wins.state) / GAMES).toFixed(1).padStart(5);
  const tPct = ((100 * wins.terrorist) / GAMES).toFixed(1).padStart(5);
  const dPct = ((100 * wins.draw) / GAMES).toFixed(1).padStart(5);
  const split = dec === 0 ? 'n/a' : `${((100 * wins.state) / dec).toFixed(1)}% / ${((100 * wins.terrorist) / dec).toFixed(1)}%`;
  console.log(`${label.padEnd(54)} ${sPct}  ${tPct}  ${dPct}  | ${split.padStart(18)}  ${avgLen.toFixed(1).padStart(5)}  [${result.failures.length} inv, ${((Date.now() - t0) / 1000).toFixed(0)}s]`);
}
