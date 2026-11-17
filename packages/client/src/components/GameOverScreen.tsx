import type { Indicator, Side } from '@bot/engine';
import { useT } from '../i18n';
import type { StoreState } from '../game/store';
import { INDICATOR_COLORS } from './Rail';

export function GameOverScreen({ store, onRematch }: { store: StoreState; onRematch: () => void }) {
  const t = useT();
  const result = store.game.result;
  if (!result) return null;
  const indicators: Indicator[] = ['stability', 'legitimacy', 'security', 'mobilization'];
  const winnerKey = result.winner === 'draw' ? null : (`side.${result.winner}` as const);
  const turns = store.history.length > 0 ? store.history[store.history.length - 1].turn : store.game.turn;

  return (
    <div className="screen gameover">
      <div className={`over-card ${result.winner}`}>
        <h2 className="over-title">{t('over.title')}</h2>
        <p className="winner-banner">
          {winnerKey ? t('over.wins', { side: t(winnerKey) }) : t('over.draw')}
        </p>
        <div className="over-reasons">
          <h3>{t('over.reasons')}</h3>
          <ul>
            {result.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
        <div className="over-stats">
          <h3>{t('over.stats')}</h3>
          <p>{t('over.turns', { turns })}</p>
          <div className="stats-grid">
            {indicators.map((ind) => (
              <div key={ind} className="stat">
                <span className="stat-label" style={{ color: INDICATOR_COLORS[ind] }}>
                  {t(`indicator.${ind}` as const)}
                </span>
                <span className="stat-value">{store.game.indicators[ind]}</span>
              </div>
            ))}
            {(['state', 'terrorist'] as Side[]).map((side) => (
              <div key={side} className={`stat side-stat ${side}`}>
                <span className="stat-label">{t(`side.${side}`)}</span>
                <span className="stat-value">
                  {t('fin.budget')} {store.game.budget[side]} · {t('fin.bank')} {store.game.bank[side]}
                </span>
              </div>
            ))}
          </div>
        </div>
        <button className="submit-btn big" onClick={onRematch}>
          {t('over.rematch')}
        </button>
      </div>
    </div>
  );
}
