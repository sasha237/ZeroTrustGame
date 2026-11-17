# Balance of Terror — Simulation Report

- Ruleset: **v1.3.0**
- Games: **10000** · Seed: **42** · Wall time: **297.7s**
- Invariant failures: **0** · Bot order rejections: **0**

## Win distribution

| Winner | Games | Share |
|---|---|---|
| state | 2522 | 25.2% |
| terrorist | 2550 | 25.5% |
| draw | 4928 | 49.3% |

## End reasons

| Reason | Games | Share |
|---|---|---|
| turn limit (draw or judged) | 8564 | 85.6% |
| terrorist critical band | 799 | 8.0% |
| state critical band | 485 | 4.9% |
| terrorist sustained band | 194 | 1.9% |
| state sustained band | 60 | 0.6% |
| state bankruptcy | 3 | 0.0% |

## Game length (turns)

```text
   1-5 | ███ 623 (6.2%)
  6-10 | █ 177 (1.8%)
 11-15 | █ 82 (0.8%)
 16-20 | █ 98 (1.0%)
 21-25 | █ 80 (0.8%)
 26-30 | █ 69 (0.7%)
 31-35 | █ 77 (0.8%)
 36-40 | █ 86 (0.9%)
 41-45 | █ 75 (0.8%)
 46-50 | ████████████████████████████████████████ 8633 (86.3%)
```

## Degenerate-pattern flags

- **Turn-2 idle-Terrorist losses** (Mobilization gate): 0 (0.0%)
- **Terrorist recruited on turn 1** ("recruit first" gate handled): 8525 (85.3%)
- **Games with an indicator pinned** at 0 or 100 for ≥5 consecutive end-of-turn values: 9402 (94.0%)
  - stability: 9315 games
  - legitimacy: 9187 games
  - security: 9223 games
  - mobilization: 9260 games

## Notes

- The ruleset is frozen by decision; degenerate patterns above are flagged, not fixed.
- Bots are heuristic (danger-band lifting, attacking opponent weakness, solvency); they are
  measurement instruments, not strong players — win rates describe the ruleset, not optimal play.
