import {
  isIndicator,
  type Effect,
  type EffectTarget,
  type Indicator,
  type Policy,
  type Side,
} from '@bot/engine';

export function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

export function indicatorOwner(indicator: Indicator): Side {
  return indicator === 'stability' || indicator === 'legitimacy' ? 'state' : 'terrorist';
}

/** Classify an effect target as belonging to the policy owner ('own') or the other side. */
export function effectTargetSide(target: EffectTarget, policySide: Side): 'own' | 'opponent' {
  if (isIndicator(target)) return indicatorOwner(target) === policySide ? 'own' : 'opponent';
  const ownBudget = policySide === 'state' ? 'stateBudget' : 'terroristBudget';
  return target === ownBudget ? 'own' : 'opponent';
}

export function splitEffects(
  effects: readonly Effect[],
  policySide: Side,
): { own: Effect[]; opponent: Effect[] } {
  const own: Effect[] = [];
  const opponent: Effect[] = [];
  for (const e of effects) {
    (effectTargetSide(e.target, policySide) === 'own' ? own : opponent).push(e);
  }
  return { own, opponent };
}

/** Net own-budget delta at a level (negative = upkeep cost). */
export function budgetDeltaOf(policy: Policy, level: number): number {
  for (const e of policy.effects[level] ?? []) {
    if (e.target === 'stateBudget' || e.target === 'terroristBudget') return e.delta;
  }
  return 0;
}

/** Wrap a policy title into lines of at most maxChars for SVG rendering. */
export function wrapTitle(title: string, maxChars: number): string[] {
  const words = title.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
