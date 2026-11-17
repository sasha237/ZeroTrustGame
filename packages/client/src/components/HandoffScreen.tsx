import type { Side } from '@bot/engine';
import { useT } from '../i18n';

export function HandoffScreen({ nextSide, onConfirm }: { nextSide: Side; onConfirm: () => void }) {
  const t = useT();
  return (
    <div className="screen handoff">
      <div className={`handoff-card ${nextSide}`}>
        <h2>{t('handoff.title')}</h2>
        <p className="handoff-to">{t('handoff.to', { side: t(`side.${nextSide}`) })}</p>
        <p className="handoff-privacy">{t('handoff.privacy')}</p>
        <button className="submit-btn big" onClick={onConfirm}>
          {t('handoff.confirm', { side: t(`side.${nextSide}`) })}
        </button>
      </div>
    </div>
  );
}
