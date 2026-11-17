import { useState } from 'react';
import type { Orders, Side } from '@bot/engine';
import { useLang, useT } from '../i18n';
import { policyTitleOf } from '../i18n/policies';
import { Graph } from '../components/Graph';
import { findPolicy, Rail } from '../components/Rail';
import { BottomPanel } from '../components/BottomPanel';
import { buildReplayStoreState, lastResolvedTurn } from './store';
import { ReplayBar } from './ReplayBar';
import type { GameView } from './types';

export function OrdersSummary({ orders, side }: { orders: Orders; side: Side }) {
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
              {policyTitleOf(lang, findPolicy(c.policy))} {c.delta > 0 ? '▲' : '▼'}
            </li>
          ))}
        </ul>
      )}
      {orders.agreeToDraw && <p className="draw-flag">🤝 {t('reveal.agreesDraw')}</p>}
    </div>
  );
}

/**
 * Interactive replay (A-21): scrubs through resolved turns. Used as an in-game overlay
 * for players and as the observer's main view. Read-only: readonly store phase +
 * non-interactive Graph.
 */
export function ReplayView({ view }: { view: GameView }) {
  const t = useT();
  const total = lastResolvedTurn(view);
  const [scrub, setScrub] = useState<number | null>(null);
  const turn = scrub ?? total;

  if (total === 0) {
    return <p className="center-message">{t('obs.waiting')}</p>;
  }
  const store = buildReplayStoreState(view, turn)!;
  return (
    <>
      <ReplayBar turn={turn} total={total} onScrub={setScrub} />
      <div className="replay-body">
        <div className="graph-wrap">
          <Graph game={store.game} actingSide={null} draft={null} preview={null} focusId={null} onFocus={() => {}} dispatch={() => {}} interactive={false} />
        </div>
        <Rail store={store} />
      </div>
      <div className="orders-row">
        <OrdersSummary side="state" orders={store.revealedOrders!.state} />
        <OrdersSummary side="terrorist" orders={store.revealedOrders!.terrorist} />
      </div>
      <BottomPanel store={store} preview={null} errors={[]} onSubmit={() => {}} onToggleDraw={() => {}} />
    </>
  );
}

/** Full-screen replay overlay for players (entry: Replay button on the game screen). */
export function ReplayScreen({ view, onClose }: { view: GameView; onClose: () => void }) {
  const t = useT();
  return (
    <div className="screen replay-screen">
      <div className="replay-card">
        <div className="replay-head">
          <h2>{t('replay.title')}</h2>
          <button className="ghost-btn" onClick={onClose}>
            {t('replay.close')} ✕
          </button>
        </div>
        <ReplayView view={view} />
      </div>
    </div>
  );
}
