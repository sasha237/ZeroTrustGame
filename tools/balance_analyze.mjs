// Analysis of an existing sim JSON report: conditional win splits and end-reason detail.
import { readFileSync } from 'node:fs';

const path = process.argv[2] ?? 'packages/sim/sim-report.json';
const data = JSON.parse(readFileSync(path, 'utf8'));
const records = data.records;
const n = records.length;

function pct(x) { return ((100 * x) / n).toFixed(1) + '%'; }
function count(pred) { return records.filter(pred).length; }

const wins = { state: 0, terrorist: 0, draw: 0 };
for (const r of records) wins[r.winner]++;

console.log(`games=${n} seed=${data.seed} | state ${wins.state} (${pct(wins.state)}) | terrorist ${wins.terrorist} (${pct(wins.terrorist)}) | draw ${wins.draw} (${pct(wins.draw)})`);
const decisive = wins.state + wins.terrorist;
console.log(`decisive-only: state ${((100 * wins.state) / decisive).toFixed(1)}% vs terrorist ${((100 * wins.terrorist) / decisive).toFixed(1)}%`);

// End reasons, raw (keep indicator names)
const reasonCounts = new Map();
for (const r of records) for (const reason of r.reasons) {
  reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
}
console.log('\n-- raw end reasons --');
for (const [reason, c] of [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`${String(c).padStart(5)}  ${pct(c)}  ${reason}`);
}

// Conditional: terrorist recruited turn 1 vs not
for (const [label, pred] of [
  ['recruited turn 1', (r) => r.terroristRecruitedTurn1],
  ['did NOT recruit turn 1', (r) => !r.terroristRecruitedTurn1],
]) {
  const subset = records.filter(pred);
  const m = subset.length;
  if (m === 0) continue;
  const w = { state: 0, terrorist: 0, draw: 0 };
  for (const r of subset) w[r.winner]++;
  const dec = w.state + w.terrorist;
  console.log(`\n[${label}] n=${m}`);
  console.log(`  state ${w.state} (${((100 * w.state) / m).toFixed(1)}%) | terrorist ${w.terrorist} (${((100 * w.terrorist) / m).toFixed(1)}%) | draw ${w.draw} (${((100 * w.draw) / m).toFixed(1)}%)`);
  if (dec > 0) console.log(`  decisive-only: state ${((100 * w.state) / dec).toFixed(1)}% vs terrorist ${((100 * w.terrorist) / dec).toFixed(1)}%`);
}

// Average length by winner
for (const winner of ['state', 'terrorist', 'draw']) {
  const subset = records.filter((r) => r.winner === winner);
  if (subset.length === 0) continue;
  const avg = subset.reduce((s, r) => s + r.turns, 0) / subset.length;
  console.log(`avg turns when ${winner} wins: ${avg.toFixed(1)}`);
}

// Short games: how do turn<=5 games end?
const short = records.filter((r) => r.turns <= 5);
console.log(`\n-- games ending in <=5 turns: ${short.length} (${pct(short.length)}) --`);
const shortReasons = new Map();
for (const r of short) for (const reason of r.reasons) {
  shortReasons.set(reason, (shortReasons.get(reason) ?? 0) + 1);
}
for (const [reason, c] of [...shortReasons.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`${String(c).padStart(5)}  ${reason}`);
}

// Turn-2 idle losses: raw reasons
const idle = records.filter((r) => r.terroristIdleTurn2);
console.log(`\n-- turn-2 idle terrorist losses: ${idle.length}; sample reasons: --`);
for (const r of idle.slice(0, 5)) console.log(`  game ${r.index}: ${r.reasons.join(' | ')}`);
