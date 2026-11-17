import type { OrdersPreview, Policy, Side } from '@bot/engine';
import { useLang, useT } from '../i18n';
import { policyBlurbOf, policyTitleOf } from '../i18n/policies';
import { EffectsThead, OWN_TARGETS, OPPONENT_TARGETS, valueCells } from './effectTable';

interface PolicyCardProps {
  policy: Policy;
  side: Side;
  level: number;
  pending: number;
  preview: OrdersPreview | null;
  onClose: () => void;
}

/** Floating detail card: blurb + per-level effect table for the focused policy. */
export function PolicyCard({ policy, side, level, pending, preview, onClose }: PolicyCardProps) {
  const t = useT();
  const lang = useLang();
  const after = level + pending;
  const rows = Array.from({ length: policy.maxLevel }, (_, i) => i + 1);

  return (
    <div className={`policy-card ${side}`}>
      <button className="policy-card-close" onClick={onClose} aria-label={t('help.close')}>
        ×
      </button>
      <h3>{policyTitleOf(lang, policy)}</h3>
      <p className="blurb">{policyBlurbOf(lang, policy)}</p>
      <p className="levels-line">
        {t('graph.current', { level })}
        {pending !== 0 && (
          <span className={pending > 0 ? 'pos' : 'neg'}>
            {' · '}
            {t('graph.after', { level: after })}
          </span>
        )}
      </p>
      <h4>{t('graph.effectsTitle')}</h4>
      <table>
        <EffectsThead side={side} />
        <tbody>
          {rows.map((lv) => (
            <tr key={lv} className={lv === after ? 'after' : lv === level ? 'current' : ''}>
              <td className="val">
                <strong>L{lv}</strong>
              </td>
              {valueCells(OWN_TARGETS[side], policy.effects[lv] ?? [], false)}
              {valueCells(OPPONENT_TARGETS[side], policy.effects[lv] ?? [], true)}
            </tr>
          ))}
        </tbody>
      </table>
      {preview && (
        <p className="projection-line">
          {t('plan.projection')}: {t('fin.afterUpkeep').toLowerCase()}{' '}
          <strong className={preview.projection.solvent ? '' : 'neg'}>{preview.projection.spend}</strong>
        </p>
      )}
    </div>
  );
}
