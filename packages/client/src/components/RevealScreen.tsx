import { useState } from 'react';
import type { Indicator, Orders, Side } from '@bot/engine';
import { useLang, useT } from '../i18n';
import { policyTitleOf } from '../i18n/policies';
import { RULESET, type StoreState } from '../game/store';
import { signed } from '../game/format';
import { EventsFeed, findPolicy, INDICATOR_COLORS } from './Rail';

function OrdersPanel({
  side,
  orders,
  levels,
  applied,
}: {
  side: Side;
  orders: Orders;
  levels: Record<string, number>;
  applied: boolean;
}) {
  const t = useT();
  const lang = useLang();
  return (
    <div className={`orders-panel ${side}`}>
      <h3>{t('reveal.changesTitle', { side: t(`side.${side}`) })}</h3>
      {orders.changes.length === 0 ? (
        <p className="no-changes">{t('reveal.noChanges')}</p>
      ) : (
        <ul>
          {orders.changes.map((c, i) => (
            <li key={i} className={c.delta > 0 ? 'pos' : 'neg'}>
              {policyTitleOf(lang, findPolicy(c.policy))} {c.delta > 0 ? '▲' : '▼'}{' '}
              {applied && (
                <span className="order-result">
                  {t('reveal.levelArrow', { from: levels[c.policy] - c.delta, to: levels[c.policy] })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {orders.agreeToDraw && <p className="draw-flag">🤝 {t('reveal.agreesDraw')}</p>}
    </div>
  );
}

export function RevealScreen({ store, onFinish }: { store: StoreState; onFinish: () => void }) {
  const t = useT();
  const [showSummary, setShowSummary] = useState(false);
  const orders = store.revealedOrders;
  const record = store.history[store.history.length - 1];
  const prev = store.history.length > 1 ? store.history[store.history.length - 2] : store.initialSnapshot;
  const indicators: Indicator[] = ['stability', 'legitimacy', 'security', 'mobilization'];

  if (!orders || !record) return null;

  return (
    <div className="screen reveal">
      <div className="reveal-card">
        <h2>
          {showSummary ? t('reveal.summary', { turn: record.turn }) : t('reveal.title')}
          <span className="reveal-turn"> · {t('reveal.turn', { turn: record.turn })}</span>
        </h2>

        {!showSummary ? (
          <>
            <div className="orders-row">
              <OrdersPanel side="state" orders={orders.state} levels={store.game.levels.state} applied={store.game.status !== 'finished'} />
              <OrdersPanel side="terrorist" orders={orders.terrorist} levels={store.game.levels.terrorist} applied={store.game.status !== 'finished'} />
            </div>
            <button className="submit-btn big" onClick={() => setShowSummary(true)}>
              {t('reveal.show')}
            </button>
          </>
        ) : (
          <>
            <div className="delta-row">
              {indicators.map((ind) => {
                const before = prev.indicators[ind];
                const after = record.indicators[ind];
                const diff = after - before;
                return (
                  <div key={ind} className="delta-chip">
                    <span style={{ color: INDICATOR_COLORS[ind] }}>{t(`indicator.${ind}` as const)}</span>
                    <span>
                      {before} → {after}{' '}
                      {diff !== 0 && <strong className={diff >= 0 ? 'pos' : 'neg'}>({signed(diff)})</strong>}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="reveal-feed">
              <EventsFeed records={[record]} />
            </div>
            <button className="submit-btn big" onClick={onFinish}>
              {t('reveal.continue')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
