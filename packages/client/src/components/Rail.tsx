import type { Indicator } from '@bot/engine';
import { useLang, useT, type Lang, type TFunction } from '../i18n';
import { policyTitleOf } from '../i18n/policies';
import { RULESET, selectIndicatorHistory, type StoreState, type TurnRecord } from '../game/store';
import { signed } from '../game/format';
import { targetLabel } from './Graph';

export const INDICATOR_COLORS: Record<Indicator, string> = {
  stability: '#2dd4bf',
  legitimacy: '#7dd3fc',
  security: '#fbbf24',
  mobilization: '#f87171',
};

const SPARK_W = 250;
const SPARK_H = 40;
/** Right inset so the end-of-line dot is fully inside the history area. */
const PAD_R = 3;

export function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length === 0) return null;
  const w = SPARK_W - PAD_R;
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const yOf = (v: number) => (SPARK_H - 3 - (Math.min(100, Math.max(0, v)) / 100) * (SPARK_H - 6)).toFixed(1);
  const coords = points.map((v, i) => `${(i * step).toFixed(1)},${yOf(v)}`);
  const last = points[points.length - 1];
  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line x1={0} y1={SPARK_H - 3 - 0.1 * (SPARK_H - 6)} x2={w} y2={SPARK_H - 3 - 0.1 * (SPARK_H - 6)} className="spark-limit" />
      <line x1={0} y1={SPARK_H - 3 - 0.3 * (SPARK_H - 6)} x2={w} y2={SPARK_H - 3 - 0.3 * (SPARK_H - 6)} className="spark-limit" />
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        vector-effect="non-scaling-stroke"
      />
      <circle cx={w} cy={yOf(last)} r={2.6} fill={color} />
    </svg>
  );
}

export function HistoryPanel({ store }: { store: StoreState }) {
  const t = useT();
  const indicators: Indicator[] = ['stability', 'legitimacy', 'security', 'mobilization'];
  return (
    <section className="rail-section">
      <h3>{t('rail.history')}</h3>
      {indicators.map((ind) => {
        const points = selectIndicatorHistory(store, ind);
        const value = points[points.length - 1];
        return (
          <div key={ind} className="spark-row">
            <span className="spark-label">{t(`indicator.${ind}` as const)}</span>
            <Sparkline points={points} color={INDICATOR_COLORS[ind]} />
            <span className="spark-value" style={{ color: INDICATOR_COLORS[ind] }}>
              {value}
            </span>
          </div>
        );
      })}
    </section>
  );
}

export function findPolicy(id: string): { id: string; title: string } {
  for (const side of ['state', 'terrorist'] as const) {
    const p = RULESET.policies[side].find((pol) => pol.id === id);
    if (p) return p;
  }
  return { id, title: id };
}

export interface FeedItem {
  turn: number;
  kind: 'log' | 'economy' | 'event';
  text: string;
  cls: string;
}

/** Flatten a turn record into displayable, cause-attributed feed items. */
export function feedItems(t: TFunction, lang: Lang, rec: TurnRecord): FeedItem[] {
  const items: FeedItem[] = [];
  for (const l of rec.log) {
    items.push({
      turn: rec.turn,
      kind: 'log',
      cls: l.delta >= 0 ? 'pos' : 'neg',
      text:
        l.resultingValue === null
          ? t('feed.effectNoValue', {
              side: t(`side.${l.actor}`),
              policy: policyTitleOf(lang, findPolicy(l.policy)),
              target: targetLabel(t, l.target),
              delta: signed(l.delta),
            })
          : t('feed.effect', {
              side: t(`side.${l.actor}`),
              policy: policyTitleOf(lang, findPolicy(l.policy)),
              target: targetLabel(t, l.target),
              delta: signed(l.delta),
              value: l.resultingValue,
            }),
    });
  }
  for (const e of rec.economy) {
    items.push({
      turn: rec.turn,
      kind: 'economy',
      cls: e.insolvent ? 'neg' : '',
      text: e.insolvent
        ? t('feed.economyBankrupt', {
            side: t(`side.${e.side}`),
            spend: e.spend,
            budget: rec.budget[e.side],
            bank: rec.bank[e.side],
          })
        : t('feed.economy', {
            side: t(`side.${e.side}`),
            spend: e.spend,
            income: e.income,
            budget: e.budgetAfter,
            bank: e.bankAfter,
          }),
    });
  }
  for (const ev of rec.events) {
    items.push({ turn: rec.turn, kind: 'event', cls: '', text: ev });
  }
  return items;
}

export function EventsFeed({ records }: { records: TurnRecord[] }) {
  const t = useT();
  const lang = useLang();
  const all: FeedItem[] = [];
  for (const rec of [...records].reverse()) all.push(...feedItems(t, lang, rec));
  return (
    <section className="rail-section events" aria-live="polite">
      <h3>{t('rail.events')}</h3>
      <ul className="feed">
        {all.slice(0, 80).map((item, i) => (
          <li key={i} className={`feed-item ${item.cls}`}>
            <span className="feed-turn">T{item.turn}</span>
            <span className="feed-text">{item.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Rail({ store }: { store: StoreState }) {
  return (
    <aside className="rail">
      <HistoryPanel store={store} />
      <EventsFeed records={store.history} />
    </aside>
  );
}
