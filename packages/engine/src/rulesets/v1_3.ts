import type { EffectTarget, Ruleset } from '../types.js';
import { rulesetV1 } from './v1.js';

/**
 * Ruleset v1.3.0 — balance revision of frozen v1.2.0, derived from it with the minimal
 * delta below (everything else is byte-identical to v1.2.0). Motivation and measurements
 * (seeded bot simulations; bots are measurement instruments, not strong players):
 *
 * Changelog:
 *  1. initial mobilization 0 -> 35. Starting at 0 is inside the <=10 critical band, so a
 *     terrorist that did not recruit on turn 1 auto-lost on turn 2 ("recruit first" cliff;
 *     14.8% of v1.2.0 games ended this way). 35 gives a buffer without leaving the
 *     sustained band unreachable.
 *  2. turnLimitJudge 'danger-indicator-margin': reaching the turn limit with no decisive
 *     loss decides the game by each side's own danger-indicator sums instead of an
 *     unconditional draw (see engine.ts judgeTurnLimit). Measured rejected tiebreaks:
 *     money margin re-imports the state's economic edge (61.5/38.5).
 *  3. effectsTiming 'same-turn' (owner decision, supersedes G-09 for v1.3): submitted
 *     policy changes become active during the very resolution they are ordered in — a
 *     new level's effects AND upkeep apply at the end of that same turn (e.g. ordering
 *     +10 security at 40 makes it 50 when the next turn begins). v1.2.0 keeps the
 *     original next-turn activation.
 *  4. Same-turn timing made the unmodified v1.2.0 numbers swing 22/78 terrorist-favored
 *     (attack outruns defense when damage lands immediately). The response surface has a
 *     chaotic cliff near the v1.2.0 Attacks damage (a ~4% change flips the decisive
 *     split by 21 points), so the balance is tuned on BOTH kill axes instead:
 *       - state security-attack moderation (kills the zero-upkeep blitz): killCapture
 *         security -15/-40/-60 -> -10/-30/-45, emergencyLegislation security
 *         -15/-30 -> -10/-20;
 *       - attacks affordability: terroristBudget upkeep -10/-25/-45/-70/-100 ->
 *         -8/-20/-36/-56/-80;
 *       - attacks damage softening: stability -30/-45/-60/-120/-145 -> -25/-35/-45/-90/
 *         -110, legitimacy -5/-10/-15/-20/-25 -> -4/-8/-12/-16/-20.
 *
 * Measured decisive-game splits of THIS configuration (10k seed 42 + 3k seeds 7/1234):
 * 49.7/50.3, 49.8/50.2, 49.5/50.5 — statistically 50/50, 0 invariant failures.
 * Simultaneous decisive losses at the turn cap still take precedence over the judge
 * (v1.2.0 behavior, kept). v1.2.0 remains exported and frozen for existing games.
 */

function setDelta(rs: Ruleset, side: 'state' | 'terrorist', id: string, level: number, target: EffectTarget, delta: number): void {
  const policy = rs.policies[side].find((p) => p.id === id);
  const effect = policy?.effects[level]?.find((e) => e.target === target);
  if (!policy || !effect) throw new Error(`ruleset v1.3 build: no effect ${side}/${id}@${level} -> ${target}`);
  effect.delta = delta;
}

const base = structuredClone(rulesetV1);

// (1) turn-2 Mobilization cliff
base.initial.indicators.mobilization = 35;

// (4) same-turn balance: state security-attack moderation
setDelta(base, 'state', 'killCapture', 1, 'security', -10);
setDelta(base, 'state', 'killCapture', 2, 'security', -30);
setDelta(base, 'state', 'killCapture', 3, 'security', -45);
setDelta(base, 'state', 'emergencyLegislation', 1, 'security', -10);
setDelta(base, 'state', 'emergencyLegislation', 2, 'security', -20);

// (4) same-turn balance: attacks upkeep discount + damage softening
setDelta(base, 'terrorist', 'attacks', 1, 'terroristBudget', -8);
setDelta(base, 'terrorist', 'attacks', 2, 'terroristBudget', -20);
setDelta(base, 'terrorist', 'attacks', 3, 'terroristBudget', -36);
setDelta(base, 'terrorist', 'attacks', 4, 'terroristBudget', -56);
setDelta(base, 'terrorist', 'attacks', 5, 'terroristBudget', -80);
setDelta(base, 'terrorist', 'attacks', 1, 'stability', -25);
setDelta(base, 'terrorist', 'attacks', 2, 'stability', -35);
setDelta(base, 'terrorist', 'attacks', 3, 'stability', -45);
setDelta(base, 'terrorist', 'attacks', 4, 'stability', -90);
setDelta(base, 'terrorist', 'attacks', 5, 'stability', -110);
setDelta(base, 'terrorist', 'attacks', 1, 'legitimacy', -4);
setDelta(base, 'terrorist', 'attacks', 2, 'legitimacy', -8);
setDelta(base, 'terrorist', 'attacks', 3, 'legitimacy', -12);
setDelta(base, 'terrorist', 'attacks', 4, 'legitimacy', -16);
setDelta(base, 'terrorist', 'attacks', 5, 'legitimacy', -20);

export const rulesetV1_3: Ruleset = {
  ...base,
  version: '1.3.0',
  turnLimitJudge: 'danger-indicator-margin',
  effectsTiming: 'same-turn',
  notes: [
    ...rulesetV1.notes.map((n) => `[v1.2.0] ${n}`),
    'v1.3.0 (owner-approved): initial mobilization 0 -> 35; effectsTiming same-turn (changes perform the turn they are ordered, supersedes G-09 for v1.3+); turnLimitJudge danger-indicator-margin replaces unconditional turn-limit draws; same-turn balance package: killCapture security -10/-30/-45, emergencyLegislation security -10/-20, attacks upkeep -8/-20/-36/-56/-80, attacks stability -25/-35/-45/-90/-110 and legitimacy -4/-8/-12/-16/-20. Measured decisive splits: 49.7/50.3 (10k seed 42), 49.8/50.2 (seed 7), 49.5/50.5 (seed 1234); 0 invariant failures. v1.2.0 remains frozen for games created under it.',
  ],
};
