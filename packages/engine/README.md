# @bot/engine

Deterministic rules engine for the Balance of Terror rebuild (WORKING_PLAN.md, milestone M0).

- `src/rulesets/v1.ts` — frozen ruleset v1.2.0: all 19 policy tables, initial state, thresholds.
  Rules-as-data: balancing means adding a new ruleset version, never editing this file.
- `src/rulesets/v1_3.ts` — ruleset v1.3.0, the sim-measured balance revision of v1.2.0
  (changelog in the file header): starting mobilization 35 (kills the turn-2 auto-loss
  cliff), softened state security-attack numbers (killCapture/emergencyLegislation),
  discounted attacks upkeep, and a `turnLimitJudge` that decides turn-limit games by
  danger-indicator margin instead of an unconditional draw. Server/client/sim run v1.3.0;
  v1.2.0 stays exported and frozen for games created under it.
- `src/engine.ts` — `getInitialState`, `validateOrders`, `resolveTurn`, `previewOrders`,
  `serializeState` / `deserializeState`, `replay`.
- Zero runtime dependencies; pure TypeScript, no I/O, no randomness.

Resolution contract (GAPS defaults G-06..G-10, assumptions A-01/A-07/A-08):

1. Both sides' orders validated (<=3 single-step changes, levels stay within [0, maxLevel]).
2. If both set `agreeToDraw`, the game ends in a draw.
3. Levels change simultaneously; effects are TOTALS at the held level and net deltas per
   target are applied once, then clamped to [0, 100] — order-independent by construction.
4. Economy: `bank += baseIncome + net budget delta` for each side (same-turn effects).
5. Danger thresholds on end-of-turn values: <=10 => immediate loss; <=30 for 3 consecutive
   turns => loss. Terrorist "Group Size" is evaluated on `mobilization` (G-03).
6. Bank < 0 => bankruptcy loss. No turn cap; no action prerequisites (G-04/G-07).

## Commands (from the repository root)

```bash
npm install        # once
npm test           # vitest
npm run typecheck  # strict tsc over src + test
npm run build      # emits packages/engine/dist
```
