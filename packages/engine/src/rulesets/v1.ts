import type { Policy, Ruleset } from '../types.js';

/**
 * Ruleset v1.2 — frozen from WORKING_PLAN.md sections 5.3 (State) and 5.4 (Terrorist),
 * transcribed from the scanned cheat sheets (extracted/state_q*.png, extracted/terror_q*.png),
 * with owner answers from ANSWERS.md + ANSWERS2.md applied:
 *
 *  - G-01: all numbers verified correct; explicit level 0 (all effects empty) on every policy.
 *  - G-02: terrorist base income = 100 (confirmed).
 *  - G-03: "Terrorist Group Size" danger thresholds are evaluated on `mobilization` (confirmed).
 *  - G-04: orders are validated for affordability (upkeep vs budget+bank) and for indicator
 *          floors (own indicators may not be driven below 0 by own policies); decreases that
 *          shrink an existing shortfall are always allowed.
 *  - G-05: NO dynamic modifiers — Study Guide passages were strategy examples only (confirmed).
 *  - G-06 + ANSWERS2: per-turn economy is perform policies -> spend (upkeep + opponent budget
 *          attacks) from budget, dipping into bank -> solvency check (budget+bank < 0 => bankruptcy)
 *          -> earn income, which becomes next turn's budget. Unspent budget consolidates into bank.
 *  - G-07: turn limit is a setting; default 50. Reaching it ends the game in a draw.
 *  - G-08: simultaneous resolution; net deltas per target summed and applied once, then clamped
 *          (order-independent by construction).
 *  - G-09: policy changes become active the NEXT turn. Effects and upkeep of a level both start
 *          the turn after the change is submitted. Turn 1 therefore has no policy effects/upkeep.
 *  - G-10: Counter-Finances max level 1 (confirmed); its -20 hits the terrorist budget,
 *          Counter-Narrative -5/-10/-15 hit the terrorist budget (already modeled).
 *  - ANSWERS2/C-1: starting budget = 100 and starting bank = 100 for both sides. Only the four
 *          indicators are clamped to [0,100]; money values are never clamped.
 *
 * A-01: effect values are TOTALS at the held level (not per-level increments).
 */

const statePolicies: Policy[] = [
  {
    id: 'counterFinances',
    title: 'Counter-Finances',
    blurb: 'Government efforts to stop the flow of money to the terrorists.',
    maxLevel: 1,
    effects: {
      0: [],
      1: [
        { target: 'legitimacy', delta: -5 },
        { target: 'stateBudget', delta: -10 },
        { target: 'terroristBudget', delta: -20 },
      ],
    },
  },
  {
    id: 'counterNarrative',
    title: 'Counter-Narrative',
    blurb: 'Government messaging to influence the national sentiment.',
    maxLevel: 3,
    effects: {
      0: [],
      1: [
        { target: 'legitimacy', delta: 10 },
        { target: 'stateBudget', delta: -10 },
        { target: 'terroristBudget', delta: -5 },
      ],
      2: [
        { target: 'legitimacy', delta: 20 },
        { target: 'stateBudget', delta: -25 },
        { target: 'terroristBudget', delta: -10 },
      ],
      3: [
        { target: 'legitimacy', delta: 30 },
        { target: 'stateBudget', delta: -40 },
        { target: 'terroristBudget', delta: -15 },
      ],
    },
  },
  {
    id: 'emergencyLegislation',
    title: 'Emergency Legislation',
    blurb: 'Executive powers to assist in counterterrorism efforts.',
    maxLevel: 2,
    effects: {
      0: [],
      1: [
        { target: 'legitimacy', delta: -10 },
        { target: 'security', delta: -15 },
      ],
      2: [
        { target: 'legitimacy', delta: -20 },
        { target: 'security', delta: -30 },
        { target: 'mobilization', delta: 10 },
      ],
    },
  },
  {
    id: 'intelligence',
    title: 'Intelligence',
    blurb: 'Intelligence-gathering activities related to counterterrorism.',
    maxLevel: 3,
    effects: {
      0: [],
      1: [
        { target: 'stability', delta: 20 },
        { target: 'stateBudget', delta: -15 },
        { target: 'security', delta: -10 },
      ],
      2: [
        { target: 'stability', delta: 40 },
        { target: 'legitimacy', delta: -5 },
        { target: 'stateBudget', delta: -30 },
        { target: 'security', delta: -15 },
      ],
      3: [
        { target: 'stability', delta: 60 },
        { target: 'legitimacy', delta: -10 },
        { target: 'stateBudget', delta: -45 },
        { target: 'security', delta: -20 },
        { target: 'mobilization', delta: 5 },
      ],
    },
  },
  {
    id: 'killCapture',
    title: 'Kill/Capture Terrorists',
    blurb: 'The effort dedicated to attacking the terrorist network.',
    maxLevel: 3,
    effects: {
      0: [],
      1: [
        { target: 'stateBudget', delta: -10 },
        { target: 'security', delta: -15 },
      ],
      2: [
        { target: 'stateBudget', delta: -25 },
        { target: 'security', delta: -40 },
      ],
      3: [
        { target: 'stateBudget', delta: -40 },
        { target: 'security', delta: -60 },
      ],
    },
  },
  {
    id: 'leadershipTargeting',
    title: 'Leadership Targeting',
    blurb: 'The effort dedicated to kill/capture terrorist leadership.',
    maxLevel: 2,
    effects: {
      0: [],
      1: [
        { target: 'stability', delta: 5 },
        { target: 'legitimacy', delta: -3 },
        { target: 'stateBudget', delta: -10 },
        { target: 'security', delta: -10 },
        { target: 'mobilization', delta: -5 },
      ],
      2: [
        { target: 'stability', delta: 10 },
        { target: 'legitimacy', delta: -6 },
        { target: 'stateBudget', delta: -25 },
        { target: 'security', delta: -15 },
        { target: 'mobilization', delta: -10 },
      ],
    },
  },
  {
    id: 'internationalPartners',
    title: 'International Partners',
    blurb: 'The effort dedicated to working with international partners.',
    maxLevel: 2,
    effects: {
      0: [],
      1: [
        { target: 'stateBudget', delta: -5 },
        { target: 'mobilization', delta: -5 },
      ],
      2: [
        { target: 'stateBudget', delta: -10 },
        { target: 'mobilization', delta: -10 },
      ],
    },
  },
  {
    id: 'policing',
    title: 'Policing & Security',
    blurb: 'Police and security activities related to counterterrorism.',
    maxLevel: 3,
    effects: {
      0: [],
      1: [
        { target: 'stability', delta: 20 },
        { target: 'stateBudget', delta: -10 },
        { target: 'security', delta: -10 },
        { target: 'mobilization', delta: 5 },
      ],
      2: [
        { target: 'stability', delta: 50 },
        { target: 'legitimacy', delta: -5 },
        { target: 'stateBudget', delta: -20 },
        { target: 'security', delta: -10 },
        { target: 'mobilization', delta: 10 },
      ],
      3: [
        { target: 'stability', delta: 80 },
        { target: 'legitimacy', delta: -20 },
        { target: 'stateBudget', delta: -30 },
        { target: 'security', delta: -20 },
        { target: 'mobilization', delta: 20 },
      ],
    },
  },
  {
    id: 'reforms',
    title: 'Reforms',
    blurb: 'The effort dedicated to economic, political or social reforms.',
    maxLevel: 3,
    effects: {
      0: [],
      1: [
        { target: 'legitimacy', delta: 10 },
        { target: 'stateBudget', delta: -20 },
        { target: 'mobilization', delta: -15 },
      ],
      2: [
        { target: 'legitimacy', delta: 15 },
        { target: 'stateBudget', delta: -50 },
        { target: 'mobilization', delta: -40 },
      ],
      3: [
        { target: 'legitimacy', delta: 20 },
        { target: 'stateBudget', delta: -80 },
        { target: 'mobilization', delta: -60 },
      ],
    },
  },
  {
    id: 'taxes',
    title: 'Taxes',
    blurb: 'Government revenue collection efforts.',
    maxLevel: 3,
    effects: {
      0: [],
      1: [
        { target: 'legitimacy', delta: -5 },
        { target: 'stateBudget', delta: 10 },
        { target: 'mobilization', delta: 5 },
      ],
      2: [
        { target: 'legitimacy', delta: -10 },
        { target: 'stateBudget', delta: 15 },
        { target: 'mobilization', delta: 10 },
      ],
      3: [
        { target: 'legitimacy', delta: -15 },
        { target: 'stateBudget', delta: 20 },
        { target: 'mobilization', delta: 15 },
      ],
    },
  },
];

const terroristPolicies: Policy[] = [
  {
    id: 'attacks',
    title: 'Attacks',
    blurb: 'The size, frequency, and scope of violent terror attacks.',
    maxLevel: 5,
    effects: {
      0: [],
      1: [
        { target: 'security', delta: -3 },
        { target: 'terroristBudget', delta: -10 },
        { target: 'stability', delta: -30 },
        { target: 'legitimacy', delta: -5 },
      ],
      2: [
        { target: 'security', delta: -6 },
        { target: 'terroristBudget', delta: -25 },
        { target: 'stability', delta: -45 },
        { target: 'legitimacy', delta: -10 },
      ],
      3: [
        { target: 'security', delta: -9 },
        { target: 'mobilization', delta: -5 },
        { target: 'terroristBudget', delta: -45 },
        { target: 'stability', delta: -60 },
        { target: 'legitimacy', delta: -15 },
      ],
      4: [
        { target: 'security', delta: -12 },
        { target: 'mobilization', delta: -10 },
        { target: 'terroristBudget', delta: -70 },
        { target: 'stability', delta: -120 },
        { target: 'legitimacy', delta: -20 },
      ],
      5: [
        { target: 'security', delta: -15 },
        { target: 'mobilization', delta: -20 },
        { target: 'terroristBudget', delta: -100 },
        { target: 'stability', delta: -145 },
        { target: 'legitimacy', delta: -25 },
      ],
    },
  },
  {
    id: 'fundraising',
    title: 'Fundraising',
    blurb: 'Terrorist efforts at raising money and resources.',
    maxLevel: 3,
    effects: {
      0: [],
      1: [
        { target: 'security', delta: -5 },
        { target: 'mobilization', delta: -5 },
        { target: 'terroristBudget', delta: 10 },
      ],
      2: [
        { target: 'security', delta: -10 },
        { target: 'mobilization', delta: -10 },
        { target: 'terroristBudget', delta: 15 },
      ],
      3: [
        { target: 'security', delta: -15 },
        { target: 'mobilization', delta: -15 },
        { target: 'terroristBudget', delta: 20 },
      ],
    },
  },
  {
    id: 'operationalSecurity',
    title: 'Operational Security',
    blurb: 'Efforts at protecting the terrorist leadership and network.',
    maxLevel: 4,
    effects: {
      0: [],
      1: [
        { target: 'security', delta: 25 },
        { target: 'terroristBudget', delta: -10 },
      ],
      2: [
        { target: 'security', delta: 50 },
        { target: 'terroristBudget', delta: -20 },
      ],
      3: [
        { target: 'security', delta: 75 },
        { target: 'terroristBudget', delta: -30 },
      ],
      4: [
        { target: 'security', delta: 100 },
        { target: 'terroristBudget', delta: -40 },
      ],
    },
  },
  {
    id: 'propaganda',
    title: 'Propaganda',
    blurb: 'Terrorist efforts at affecting the national sentiment.',
    maxLevel: 3,
    effects: {
      0: [],
      1: [
        { target: 'mobilization', delta: 10 },
        { target: 'terroristBudget', delta: -15 },
        { target: 'legitimacy', delta: -5 },
      ],
      2: [
        { target: 'mobilization', delta: 15 },
        { target: 'terroristBudget', delta: -30 },
        { target: 'legitimacy', delta: -10 },
      ],
      3: [
        { target: 'mobilization', delta: 20 },
        { target: 'terroristBudget', delta: -45 },
        { target: 'legitimacy', delta: -15 },
      ],
    },
  },
  {
    id: 'recruitment',
    title: 'Recruitment',
    blurb: 'Terrorist efforts at recruiting new participants.',
    maxLevel: 2,
    effects: {
      0: [],
      1: [
        { target: 'security', delta: -10 },
        { target: 'mobilization', delta: 20 },
        { target: 'terroristBudget', delta: -10 },
      ],
      2: [
        { target: 'security', delta: -20 },
        { target: 'mobilization', delta: 40 },
        { target: 'terroristBudget', delta: -20 },
      ],
    },
  },
  {
    id: 'safeHavens',
    title: 'Safe Havens',
    blurb: 'Terrorist efforts at establishing sites for training and recruitment.',
    maxLevel: 2,
    effects: {
      0: [],
      1: [
        { target: 'mobilization', delta: 5 },
        { target: 'terroristBudget', delta: -5 },
      ],
      2: [
        { target: 'mobilization', delta: 10 },
        { target: 'terroristBudget', delta: -10 },
      ],
    },
  },
  {
    id: 'socialServices',
    title: 'Social Services',
    blurb: 'Terrorist efforts at providing social services to civilians.',
    maxLevel: 2,
    effects: {
      0: [],
      1: [
        { target: 'security', delta: -10 },
        { target: 'mobilization', delta: 35 },
        { target: 'terroristBudget', delta: -30 },
        { target: 'legitimacy', delta: -5 },
      ],
      2: [
        { target: 'security', delta: -20 },
        { target: 'mobilization', delta: 60 },
        { target: 'terroristBudget', delta: -50 },
        { target: 'legitimacy', delta: -10 },
      ],
    },
  },
  {
    id: 'subversiveAction',
    title: 'Subversive Action',
    blurb: "The scope of attacks on the nation's political and economic infrastructure.",
    maxLevel: 3,
    effects: {
      0: [],
      1: [
        { target: 'terroristBudget', delta: -15 },
        { target: 'legitimacy', delta: -10 },
        { target: 'stateBudget', delta: -3 },
      ],
      2: [
        { target: 'terroristBudget', delta: -30 },
        { target: 'legitimacy', delta: -20 },
        { target: 'stateBudget', delta: -6 },
      ],
      3: [
        { target: 'terroristBudget', delta: -45 },
        { target: 'legitimacy', delta: -30 },
        { target: 'stateBudget', delta: -9 },
      ],
    },
  },
  {
    id: 'training',
    title: 'Training',
    blurb: 'The establishment of a training camp network.',
    maxLevel: 2,
    effects: {
      0: [],
      1: [
        { target: 'security', delta: 10 },
        { target: 'terroristBudget', delta: -10 },
      ],
      2: [
        { target: 'security', delta: 20 },
        { target: 'terroristBudget', delta: -25 },
      ],
    },
  },
];

export const rulesetV1 = {
  version: '1.2.0',
  baseIncome: { state: 100, terrorist: 100 },
  initial: {
    indicators: { stability: 75, legitimacy: 75, security: 100, mobilization: 0 },
    budget: { state: 100, terrorist: 100 },
    bank: { state: 100, terrorist: 100 },
  },
  maxPolicyChangesPerTurn: 3,
  indicatorScale: { min: 0, max: 100 },
  turnLimit: 50,
  danger: {
    state: {
      indicators: ['stability', 'legitimacy'],
      criticalValue: 10,
      criticalTurns: 1,
      sustainedValue: 30,
      sustainedTurns: 3,
    },
    terrorist: {
      indicators: ['security', 'mobilization'],
      criticalValue: 10,
      criticalTurns: 1,
      sustainedValue: 30,
      sustainedTurns: 3,
    },
  },
  policies: {
    state: statePolicies,
    terrorist: terroristPolicies,
  },
  notes: [
    'G-01: all transcribed numbers verified correct by rules owner; explicit level 0 (no effects) on every policy.',
    'G-03: terrorist "Group Size" danger thresholds are evaluated on the mobilization indicator.',
    'G-04: orders validated against budget+bank (upkeep must be affordable) and indicator floors (own indicators cannot go below 0); decreases shrinking a shortfall are always allowed.',
    'G-05: no dynamic modifiers — Study Guide passages were strategy examples, not engine rules.',
    'G-06/ANSWERS2: spend (upkeep + opponent budget attacks) from budget, dipping into bank -> solvency check -> earn income into next turn\'s budget; unspent budget consolidates into bank.',
    'G-07: turn limit is a per-ruleset setting; v1.2 default 50, ending in a draw.',
    'G-09: changes become active next turn; effects AND upkeep start the turn after the change. Turn 1 has no policy effects or upkeep.',
    'G-08: per-target net deltas are summed and applied once per turn, then clamped; resolution is order-independent by construction.',
    'ANSWERS2/C-1: starting budget = 100 and starting bank = 100 for both sides; only indicators are clamped to [0,100], money is never clamped.',
    'Quirk: Emergency Legislation has no budget upkeep on the cheat sheet (costs legitimacy only) — verified G-01 data, kept as-is.',
  ],
} satisfies Ruleset;
