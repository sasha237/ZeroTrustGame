// Check: FULL v1.2 policy values under v1.3 structure (mobilization 35,
// same-turn timing, turn-limit judge). Also the exact current-v1.3 baseline for reference.
import { rulesetV1, rulesetV1_3 } from '../packages/engine/dist/index.js';
import { runSimulation } from '../packages/sim/dist/runner.js';

const v12UnderV13Timing = (() => {
  const rs = structuredClone(rulesetV1);
  rs.initial.indicators.mobilization = 35;
  rs.effectsTiming = 'same-turn';
  rs.turnLimitJudge = 'danger-indicator-margin';
  return rs;
})();

const variants = [
  ['current v1.3 (KC/EL nerfed, attacks upkeep -20%, attacks damage = v1.2)', structuredClone(rulesetV1_3)],
  ['FULL v1.2 policy values + v1.3 timing (mob35, same-turn, judge)', v12UnderV13Timing],
];

for (const [label, rs] of variants) {
  for (const [games, seed] of [[10000, 42], [3000, 7]]) {
    const t0 = Date.now();
    const result = runSimulation({ games, seed, ruleset: rs });
    const wins = { state: 0, terrorist: 0, draw: 0 };
    for (const r of result.records) wins[r.winner]++;
    const dec = wins.state + wins.terrorist;
    console.log(
      `${label} | n=${games} seed=${seed}: state ${(100 * wins.state / games).toFixed(1)}% terrorist ${(100 * wins.terrorist / games).toFixed(1)}% draw ${(100 * wins.draw / games).toFixed(1)}% | decisive ${(100 * wins.state / dec).toFixed(1)}/${(100 * wins.terrorist / dec).toFixed(1)} | inv ${result.failures.length} [${((Date.now() - t0) / 1000).toFixed(0)}s]`,
    );
  }
}
