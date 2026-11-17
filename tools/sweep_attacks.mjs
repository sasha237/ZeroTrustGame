// Attacks-only sweep on the approved v1.3 config (everything else = frozen v1.2.0
// numbers). v1.2 attacks damage gives 33/67 terrorist-favored; the current softening
// gives 62.5/37.5 state-favored; find the ~50/50 point in between.
// Usage: node tools/sweep_attacks.mjs [games] [seed]
import { rulesetV1_3 } from '../packages/engine/dist/index.js';
import { runSimulation } from '../packages/sim/dist/runner.js';

const GAMES = Number(process.argv[2] ?? 2000);
const SEED = Number(process.argv[3] ?? 42);

const ST_V12 = [-30, -45, -60, -120, -145];
const ST_SOFT = [-25, -35, -45, -90, -110];
const LG_V12 = [-5, -10, -15, -20, -25];
const LG_SOFT = [-4, -8, -12, -16, -20];

function variant(f) {
  const rs = structuredClone(rulesetV1_3);
  for (let lv = 1; lv <= 5; lv++) {
    const stab = Math.round(ST_V12[lv - 1] + f * (ST_SOFT[lv - 1] - ST_V12[lv - 1]));
    const leg = Math.round(LG_V12[lv - 1] + f * (LG_SOFT[lv - 1] - LG_V12[lv - 1]));
    const effs = rs.policies.terrorist.find((p) => p.id === 'attacks').effects[lv];
    effs.find((e) => e.target === 'stability').delta = stab;
    effs.find((e) => e.target === 'legitimacy').delta = leg;
  }
  return rs;
}

console.log(`games=${GAMES} seed=${SEED}`);
for (const f of [0, 0.15, 0.3]) {
  const rs = variant(f);
  const stab = [1, 2, 3, 4, 5].map((lv) => rs.policies.terrorist.find((p) => p.id === 'attacks').effects[lv].find((e) => e.target === 'stability').delta);
  const t0 = Date.now();
  const result = runSimulation({ games: GAMES, seed: SEED, ruleset: rs });
  const wins = { state: 0, terrorist: 0, draw: 0 };
  for (const r of result.records) wins[r.winner]++;
  const dec = wins.state + wins.terrorist;
  console.log(
    `f=${f} stab ${stab.join('/')}: state ${(100 * wins.state / GAMES).toFixed(1)}% terrorist ${(100 * wins.terrorist / GAMES).toFixed(1)}% draw ${(100 * wins.draw / GAMES).toFixed(1)}% | decisive ${(100 * wins.state / dec).toFixed(1)}/${(100 * wins.terrorist / dec).toFixed(1)} | inv ${result.failures.length} [${((Date.now() - t0) / 1000).toFixed(0)}s]`,
  );
}
