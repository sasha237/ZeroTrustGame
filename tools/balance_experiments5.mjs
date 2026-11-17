// Round 5: judge with a money tiebreak — indicator-margin judge, then budget+bank
// on exact indicator-sum ties, else draw. Seed 42, 3000 games.
import { rulesetV1, getInitialState, resolveTurn, validateOrders } from '../packages/engine/dist/index.js';
import { proposeOrders } from '../packages/sim/dist/bots.js';
import { mulberry32 } from '../packages/sim/dist/prng.js';
import { assertTurnInvariants } from '../packages/sim/dist/invariants.js';

const GAMES = 3000;
const SEED = 42;

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
const rs = clone();
rs.initial.indicators.mobilization = 35;
tweak(rs, [
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

const wins = { state: 0, terrorist: 0, draw: 0 };
let judged = 0;
let moneyTies = 0;
let failures = 0;
const t0 = Date.now();
for (let g = 0; g < GAMES; g++) {
  const rng = mulberry32(SEED + g * 0x9e3779b9);
  let state = getInitialState(rs);
  while (state.status === 'active') {
    const so = proposeOrders(rs, state, 'state', rng);
    const to = proposeOrders(rs, state, 'terrorist', rng);
    if (validateOrders(rs, state, 'state', so).length || validateOrders(rs, state, 'terrorist', to).length) failures++;
    const summary = resolveTurn(rs, state, so, to);
    const check = assertTurnInvariants(rs, state, summary, summary.state, { game: g, turn: state.turn, seed: SEED });
    if (!check.ok) failures += check.failures.length;
    state = summary.state;
  }
  let winner = state.result?.winner ?? 'draw';
  if (winner === 'draw' && state.result?.reasons.some((r) => /turn limit/.test(r))) {
    judged++;
    const sScore = state.indicators.stability + state.indicators.legitimacy;
    const tScore = state.indicators.security + state.indicators.mobilization;
    if (sScore !== tScore) {
      winner = sScore > tScore ? 'state' : 'terrorist';
    } else {
      moneyTies++;
      const sMoney = state.budget.state + state.bank.state;
      const tMoney = state.budget.terrorist + state.bank.terrorist;
      if (sMoney !== tMoney) winner = sMoney > tMoney ? 'state' : 'terrorist';
    }
  }
  wins[winner]++;
}
const dec = wins.state + wins.terrorist;
console.log(`games=${GAMES} seed=${SEED} core + judge(indicators, money tiebreak) @50`);
console.log(`state ${(100 * wins.state / GAMES).toFixed(1)}%  terrorist ${(100 * wins.terrorist / GAMES).toFixed(1)}%  draw ${(100 * wins.draw / GAMES).toFixed(1)}%`);
console.log(`decisive split: ${(100 * wins.state / dec).toFixed(1)}% / ${(100 * wins.terrorist / dec).toFixed(1)}%  | judged=${judged} (money tiebreak used ${moneyTies})  inv failures=${failures}  [${((Date.now() - t0) / 1000).toFixed(0)}s]`);
