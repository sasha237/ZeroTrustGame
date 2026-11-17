import type { SimulationResult } from './runner.js';

function pct(part: number, whole: number): string {
  return whole === 0 ? '0.0%' : `${((part / whole) * 100).toFixed(1)}%`;
}

function categorizeReasons(reasons: string[]): string[] {
  const out: string[] = [];
  for (const r of reasons) {
    if (/bankrupt/.test(r)) out.push(r.startsWith('state') ? 'state bankruptcy' : 'terrorist bankruptcy');
    else if (/critical, persisted/.test(r)) out.push(r.startsWith('state') ? 'state critical band' : 'terrorist critical band');
    else if (/counted turns/.test(r)) out.push(r.startsWith('state') ? 'state sustained band' : 'terrorist sustained band');
    else if (/turn limit/.test(r)) out.push('turn limit (draw or judged)');
    else if (/mutual agreement/.test(r)) out.push('mutual draw');
    else out.push(`other: ${r}`);
  }
  return out;
}

/** Length histogram in buckets of 5 turns, as aligned text lines. */
export function lengthHistogram(records: SimulationResult['records']): string[] {
  const maxTurn = records.reduce((m, r) => Math.max(m, r.turns), 0);
  const buckets = new Map<string, number>();
  for (let lo = 1; lo <= maxTurn; lo += 5) {
    buckets.set(`${lo}-${Math.min(lo + 4, maxTurn)}`, 0);
  }
  for (const r of records) {
    const bucket = `${Math.floor((r.turns - 1) / 5) * 5 + 1}-${Math.min(Math.floor((r.turns - 1) / 5) * 5 + 5, maxTurn)}`;
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }
  const peak = Math.max(1, ...buckets.values());
  const lines: string[] = [];
  for (const [label, count] of buckets) {
    const bar = '█'.repeat(Math.max(1, Math.round((count / peak) * 40)));
    lines.push(`${label.padStart(6)} | ${bar} ${count} (${pct(count, records.length)})`);
  }
  return lines;
}

export function buildReport(result: SimulationResult): string {
  const n = result.records.length;
  const lines: string[] = [];

  lines.push('# Balance of Terror — Simulation Report');
  lines.push('');
  lines.push(`- Ruleset: **v${result.rulesetVersion}**`);
  lines.push(`- Games: **${n}** · Seed: **${result.seed}** · Wall time: **${(result.wallMs / 1000).toFixed(1)}s**`);
  lines.push(`- Invariant failures: **${result.failures.length}** · Bot order rejections: **${result.botRejections}**`);
  lines.push('');
  if (result.failures.length > 0) {
    lines.push('## ⚠ Invariant failures (first 20)');
    lines.push('');
    for (const f of result.failures.slice(0, 20)) {
      lines.push(`- game ${f.game} turn ${f.turn} [${f.check}] ${f.detail}`);
    }
    lines.push('');
  }

  lines.push('## Win distribution');
  lines.push('');
  lines.push('| Winner | Games | Share |');
  lines.push('|---|---|---|');
  for (const winner of ['state', 'terrorist', 'draw'] as const) {
    const count = result.records.filter((r) => r.winner === winner).length;
    lines.push(`| ${winner} | ${count} | ${pct(count, n)} |`);
  }
  lines.push('');

  lines.push('## End reasons');
  lines.push('');
  lines.push('| Reason | Games | Share |');
  lines.push('|---|---|---|');
  const reasonCounts = new Map<string, number>();
  for (const r of result.records) {
    for (const cat of categorizeReasons(r.reasons)) reasonCounts.set(cat, (reasonCounts.get(cat) ?? 0) + 1);
  }
  for (const [reason, count] of [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${reason} | ${count} | ${pct(count, n)} |`);
  }
  lines.push('');

  lines.push('## Game length (turns)');
  lines.push('');
  lines.push('```text');
  lines.push(...lengthHistogram(result.records));
  lines.push('```');
  lines.push('');

  lines.push('## Degenerate-pattern flags');
  lines.push('');
  const idle = result.records.filter((r) => r.terroristIdleTurn2).length;
  const recruited = result.records.filter((r) => r.terroristRecruitedTurn1).length;
  const pinnedGames = result.records.filter((r) => r.pinned.length > 0).length;
  lines.push(`- **Turn-2 idle-Terrorist losses** (Mobilization gate): ${idle} (${pct(idle, n)})`);
  lines.push(`- **Terrorist recruited on turn 1** ("recruit first" gate handled): ${recruited} (${pct(recruited, n)})`);
  lines.push(`- **Games with an indicator pinned** at 0 or 100 for ≥${5} consecutive end-of-turn values: ${pinnedGames} (${pct(pinnedGames, n)})`);
  const pinDetails = new Map<string, number>();
  for (const r of result.records) for (const p of r.pinned) pinDetails.set(p, (pinDetails.get(p) ?? 0) + 1);
  for (const [ind, count] of pinDetails) {
    lines.push(`  - ${ind}: ${count} games`);
  }
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push('- The ruleset is frozen by decision; degenerate patterns above are flagged, not fixed.');
  lines.push('- Bots are heuristic (danger-band lifting, attacking opponent weakness, solvency); they are');
  lines.push('  measurement instruments, not strong players — win rates describe the ruleset, not optimal play.');
  lines.push('');
  return lines.join('\n');
}

export function buildReportJson(result: SimulationResult): string {
  const n = result.records.length;
  const winners = { state: 0, terrorist: 0, draw: 0 };
  for (const r of result.records) winners[r.winner] += 1;
  return JSON.stringify(
    {
      rulesetVersion: result.rulesetVersion,
      games: n,
      seed: result.seed,
      wallMs: result.wallMs,
      invariantFailures: result.failures.length,
      botRejections: result.botRejections,
      winners,
      flags: {
        terroristIdleTurn2: result.records.filter((r) => r.terroristIdleTurn2).length,
        terroristRecruitedTurn1: result.records.filter((r) => r.terroristRecruitedTurn1).length,
        gamesWithPinning: result.records.filter((r) => r.pinned.length > 0).length,
      },
      records: result.records,
    },
    null,
    2,
  );
}
