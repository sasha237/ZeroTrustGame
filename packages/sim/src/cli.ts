import { writeFile } from 'node:fs/promises';
import { runSimulation } from './runner.js';
import { buildReport, buildReportJson } from './report.js';

export interface CliOptions {
  games: number;
  seed: number;
  out: string;
}

export function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { games: 1000, seed: 1, out: 'sim-report.md' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const next = () => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`missing value for ${arg}`);
      return value;
    };
    if (arg === '-n' || arg === '--games') opts.games = Number(next());
    else if (arg === '--seed') opts.seed = Number(next());
    else if (arg === '--out') opts.out = next();
    else if (arg === '-h' || arg === '--help') {
      console.log('Usage: npm run sim -- [-n 1000] [--seed 42] [--out sim-report.md]');
      process.exit(0);
    } else throw new Error(`unknown argument: ${arg}`);
  }
  if (!Number.isInteger(opts.games) || opts.games <= 0) throw new Error('-n must be a positive integer');
  if (!Number.isInteger(opts.seed)) throw new Error('--seed must be an integer');
  return opts;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  console.log(`[sim] running ${opts.games} games, seed ${opts.seed} …`);
  const result = runSimulation({
    games: opts.games,
    seed: opts.seed,
    onProgress: (done) => {
      if (done % Math.max(1, Math.floor(opts.games / 20)) === 0 || done === opts.games) {
        console.log(`[sim] ${done}/${opts.games}`);
      }
    },
  });

  const md = buildReport(result);
  await writeFile(opts.out, md, 'utf8');
  const jsonPath = opts.out.replace(/\.md$/, '.json');
  await writeFile(jsonPath, buildReportJson(result), 'utf8');

  console.log(`[sim] done in ${(result.wallMs / 1000).toFixed(1)}s — invariant failures: ${result.failures.length}, bot rejections: ${result.botRejections}`);
  console.log(`[sim] report: ${opts.out} (+ ${jsonPath})`);
  if (result.failures.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('[sim] FATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
