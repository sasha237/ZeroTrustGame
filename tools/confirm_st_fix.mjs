// Confirmation of the recommended same-turn balance fix: soften attacks damage.
// Runs 10k seed 42 + 3k seeds 7 and 1234 on the variant.
import { rulesetV1_3 } from '../packages/engine/dist/index.js';
import { runSimulation } from '../packages/sim/dist/runner.js';

const variant = (rs) => {
  const set = (side, id, level, target, delta) => {
    const e = rs.policies[side].find((p) => p.id === id).effects[level].find((x) => x.target === target);
    e.delta = delta;
  };
  set('terrorist', 'attacks', 1, 'stability', -25);
  set('terrorist', 'attacks', 2, 'stability', -35);
  set('terrorist', 'attacks', 3, 'stability', -45);
  set('terrorist', 'attacks', 4, 'stability', -90);
  set('terrorist', 'attacks', 5, 'stability', -110);
  set('terrorist', 'attacks', 1, 'legitimacy', -4);
  set('terrorist', 'attacks', 2, 'legitimacy', -8);
  set('terrorist', 'attacks', 3, 'legitimacy', -12);
  set('terrorist', 'attacks', 4, 'legitimacy', -16);
  set('terrorist', 'attacks', 5, 'legitimacy', -20);
  return rs;
};

for (const [games, seed] of [[10000, 42], [3000, 7], [3000, 1234]]) {
  const t0 = Date.now();
  const result = runSimulation({ games, seed, ruleset: variant(structuredClone(rulesetV1_3)) });
  const wins = { state: 0, terrorist: 0, draw: 0 };
  for (const r of result.records) wins[r.winner]++;
  const dec = wins.state + wins.terrorist;
  console.log(
    `n=${games} seed=${seed}: state ${(100 * wins.state / games).toFixed(1)}% terrorist ${(100 * wins.terrorist / games).toFixed(1)}% draw ${(100 * wins.draw / games).toFixed(1)}% | decisive ${(100 * wins.state / dec).toFixed(1)}/${(100 * wins.terrorist / dec).toFixed(1)} | inv ${result.failures.length} [${((Date.now() - t0) / 1000).toFixed(0)}s]`,
  );
}
