import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getInitialState, resolveTurn, rulesetV1, validateOrders } from '@bot/engine';
import { mulberry32 } from '../src/prng.js';
import { proposeOrders } from '../src/bots.js';
import { runSimulation } from '../src/runner.js';
import { buildReport, buildReportJson } from '../src/report.js';

describe('simulation (A-22)', () => {
  it('runs 200 games at a fixed seed with zero invariant failures', () => {
    const result = runSimulation({ games: 200, seed: 42 });
    expect(result.failures).toEqual([]);
    expect(result.botRejections).toBe(0);
    expect(result.records).toHaveLength(200);
    for (const r of result.records) {
      expect(['state', 'terrorist', 'draw']).toContain(r.winner);
      expect(r.turns).toBeGreaterThan(0);
      expect(r.turns).toBeLessThanOrEqual(rulesetV1.turnLimit ?? 50);
    }
  });

  it('is deterministic: same seed twice produces identical results', () => {
    const a = runSimulation({ games: 40, seed: 7 });
    const b = runSimulation({ games: 40, seed: 7 });
    expect(a.records).toEqual(b.records);
    expect(a.failures).toEqual(b.failures);
    // Different seed diverges.
    const c = runSimulation({ games: 40, seed: 8 });
    expect(c.records).not.toEqual(a.records);
  });

  it('bot-proposed orders always pass validateOrders across sampled turns', () => {
    const rng = mulberry32(1234);
    let state = getInitialState(rulesetV1);
    for (let turn = 0; turn < 300 && state.status === 'active'; turn++) {
      const stateOrders = proposeOrders(rulesetV1, state, 'state', rng);
      const terroristOrders = proposeOrders(rulesetV1, state, 'terrorist', rng);
      expect(validateOrders(rulesetV1, state, 'state', stateOrders)).toEqual([]);
      expect(validateOrders(rulesetV1, state, 'terrorist', terroristOrders)).toEqual([]);
      state = resolveTurn(rulesetV1, state, stateOrders, terroristOrders).state;
    }
  });

  it('writes a report with all expected sections', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'botsim-'));
    try {
      const result = runSimulation({ games: 20, seed: 5 });
      const md = buildReport(result);
      expect(md).toContain('# Balance of Terror — Simulation Report');
      expect(md).toContain('## Win distribution');
      expect(md).toContain('## End reasons');
      expect(md).toContain('## Game length (turns)');
      expect(md).toContain('## Degenerate-pattern flags');
      const json = JSON.parse(buildReportJson(result));
      expect(json.games).toBe(20);
      expect(json.winners.state + json.winners.terrorist + json.winners.draw).toBe(20);

      const file = path.join(dir, 'report.md');
      await (await import('node:fs/promises')).writeFile(file, md, 'utf8');
      const read = await readFile(file, 'utf8');
      expect(read).toContain('Simulation Report');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
