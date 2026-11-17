import { useEffect, useRef } from 'react';
import { useLang, useT } from '../i18n';
import { policyBlurbOf, policyTitleOf } from '../i18n/policies';
import { RULESET } from '../game/store';
import { EffectsThead, OWN_TARGETS, OPPONENT_TARGETS, valueCells } from './effectTable';

/**
 * Help modal: how a turn works + full policy tables generated from the ruleset.
 * Accessibility: role="dialog" + focus trap + Escape to close + focus return (WCAG 2.1 AA).
 */
export function HelpModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<Element | null>(null);
  const danger = RULESET.danger.state;
  const howText = t('help.howText', {
    max: RULESET.maxPolicyChangesPerTurn,
    sustained: danger.sustainedValue,
    sustainedTurns: danger.sustainedTurns,
    critical: danger.criticalValue,
    limit: RULESET.turnLimit ?? 50,
  });

  useEffect(() => {
    restoreRef.current = document.activeElement;
    const dialog = dialogRef.current;
    // Initial focus: the close button (first focusable in the modal).
    const focusables = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [],
      ).filter((el) => !el.hasAttribute('disabled'));
    focusables()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      (restoreRef.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('help.title')}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{t('help.title')}</h2>
          <button className="ghost-btn" onClick={onClose} aria-label={t('help.close')}>
            {t('help.close')}
          </button>
        </div>
        <div className="modal-body">
          <section>
            <h3>{t('help.howTitle')}</h3>
            {howText.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </section>
          <section>
            <h3>{t('help.policies', { version: RULESET.version })}</h3>
            {(['state', 'terrorist'] as const).map((side) => {
              const own = OWN_TARGETS[side];
              const opponent = OPPONENT_TARGETS[side];
              return (
                <div key={side} className={`help-side ${side}`}>
                  <h4>{t(`side.${side}`)}</h4>
                  <table className="help-table">
                    <EffectsThead side={side} leading={<th rowSpan={2}>{t('help.policy')}</th>} />
                    <tbody>
                      {RULESET.policies[side].map((policy) =>
                        Array.from({ length: policy.maxLevel }, (_, i) => i + 1).map((lv, li) => {
                          const effects = policy.effects[lv] ?? [];
                          return (
                            <tr key={`${policy.id}-${lv}`}>
                              {li === 0 && (
                                <td rowSpan={policy.maxLevel} className="policy-cell">
                                  <strong>{policyTitleOf(lang, policy)}</strong>
                                  <span className="blurb">{policyBlurbOf(lang, policy)}</span>
                                </td>
                              )}
                              <td className="val">
                                <strong>L{lv}</strong>
                              </td>
                              {valueCells(own, effects, false)}
                              {valueCells(opponent, effects, true)}
                            </tr>
                          );
                        }),
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </section>
        </div>
      </div>
    </div>
  );
}
