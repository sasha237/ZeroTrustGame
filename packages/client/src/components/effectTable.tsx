import type { ReactNode } from 'react';
import type { Effect, EffectTarget, Side } from '@bot/engine';
import { useT } from '../i18n';
import { targetLabel } from './Graph';

/** Value columns per table, relative to the table owner (same layout for both popups). */
export const OWN_TARGETS: Record<Side, EffectTarget[]> = {
  state: ['stability', 'legitimacy', 'stateBudget'],
  terrorist: ['security', 'mobilization', 'terroristBudget'],
};
export const OPPONENT_TARGETS: Record<Side, EffectTarget[]> = {
  state: ['security', 'mobilization', 'terroristBudget'],
  terrorist: ['stability', 'legitimacy', 'stateBudget'],
};

/** One value cell per parameter: just the signed arrow + number, or an em dash. */
export function valueCells(targets: readonly EffectTarget[], effects: readonly Effect[], invert: boolean) {
  return targets.map((tg) => {
    const e = effects.find((x) => x.target === tg);
    if (!e) {
      return (
        <td key={tg} className="val">
          —
        </td>
      );
    }
    // Colors are relative to the owner: in the opponent column a negative delta
    // (hurting the opponent) is good and a positive one is bad, so pos/neg invert.
    const positive = invert ? e.delta < 0 : e.delta >= 0;
    return (
      <td key={tg} className="val">
        <span className={`fx ${positive ? 'pos' : 'neg'}`}>{`${e.delta >= 0 ? '▲' : '▼'}${Math.abs(e.delta)}`}</span>
      </td>
    );
  });
}

/**
 * Two-level header shared by the help modal and the policy detail card:
 * Level | OWN (per-parameter columns) | OPPONENT (per-parameter columns).
 * `leading` renders extra rowSpan-2 header cells before the Level column.
 */
export function EffectsThead({ side, leading }: { side: Side; leading?: ReactNode }) {
  const t = useT();
  return (
    <thead>
      <tr>
        {leading}
        <th rowSpan={2}>{t('help.level')}</th>
        <th colSpan={OWN_TARGETS[side].length} className="grp">
          {t('graph.own')}
        </th>
        <th colSpan={OPPONENT_TARGETS[side].length} className="grp">
          {t('graph.opponent')}
        </th>
      </tr>
      <tr>
        {OWN_TARGETS[side].map((tg) => (
          <th key={tg}>{targetLabel(t, tg)}</th>
        ))}
        {OPPONENT_TARGETS[side].map((tg) => (
          <th key={tg}>{targetLabel(t, tg)}</th>
        ))}
      </tr>
    </thead>
  );
}
