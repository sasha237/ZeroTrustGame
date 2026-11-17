import type { BandCounters, Indicator, OrdersPreview, Side, TurnProjection } from '@bot/engine';
import { previewTurn } from '@bot/engine';
import { useT } from '../i18n';
import { RULESET, type StoreState } from '../game/store';
import { indicatorOwner } from '../game/format';
import { INDICATOR_COLORS } from './Rail';

const GAUGE_W = 220;

function MoneyValue({ value, cls }: { value: number; cls?: string }) {
  return <strong className={cls ?? ''}>{value}</strong>;
}

function FinancesCard({
  side,
  store,
  turnProjection,
  preview,
}: {
  side: Side;
  store: StoreState;
  turnProjection: TurnProjection;
  preview: OrdersPreview | null;
}) {
  const t = useT();
  const acting = store.phase.kind === 'planning' && store.phase.side === side;
  const game = store.game;
  const after = acting ? preview?.projection : null;
  return (
    <div className={`fin-card ${side}${acting ? ' acting' : ''}`}>
      <h4>{t(`side.${side}`)}</h4>
      <dl>
        <div>
          <dt>{t('fin.budget')}</dt>
          <dd>
            <MoneyValue value={game.budget[side]} />
          </dd>
        </div>
        <div>
          <dt>{t('fin.bank')}</dt>
          <dd>
            <MoneyValue value={game.bank[side]} />
          </dd>
        </div>
        <div>
          <dt>{t('fin.activeUpkeep')}</dt>
          <dd>
            <MoneyValue value={turnProjection.spend} cls={turnProjection.solvent ? 'neg' : 'neg strong'} />
          </dd>
        </div>
        <div>
          <dt>{t('fin.nextIncome')}</dt>
          <dd>
            <MoneyValue value={turnProjection.income} cls="pos" />
          </dd>
        </div>
        {after && (
          <div>
            <dt>{t('fin.afterUpkeep')}</dt>
            <dd>
              <MoneyValue value={after.spend} cls={after.solvent ? '' : 'neg strong'} />
            </dd>
          </div>
        )}
      </dl>
      {(acting ? (after && !after.solvent) : !turnProjection.solvent) && (
        <p className="solvency-warning">⚠ {t('fin.insolvent')}</p>
      )}
    </div>
  );
}

function DangerGauge({ indicator, store }: { indicator: Indicator; store: StoreState }) {
  const t = useT();
  const game = store.game;
  const owner = indicatorOwner(indicator);
  const config = RULESET.danger[owner];
  const value = game.indicators[indicator];
  const counters = (game.danger[owner] as Record<Indicator, BandCounters>)[indicator];
  const pos = Math.min(100, Math.max(0, value));
  const pct = (v: number) => `${(v / 100) * GAUGE_W}px`;

  let status: string;
  let statusCls: string;
  if (value > config.sustainedValue) {
    status = t('danger.safe');
    statusCls = 'safe';
  } else if (value <= config.criticalValue) {
    if (counters.critical === 0) {
      status = t('danger.criticalGrace');
      statusCls = 'crit';
    } else {
      status = t('danger.critical');
      statusCls = 'crit';
    }
  } else if (counters.sustained === 0) {
    status = t('danger.grace');
    statusCls = 'warn';
  } else {
    status = t('danger.sustained', { count: counters.sustained, max: config.sustainedTurns });
    statusCls = 'warn';
  }

  return (
    <div className="gauge">
      <div className="gauge-head">
        <span className="gauge-label">{t(`indicator.${indicator}` as const)}</span>
        <span className="gauge-value" style={{ color: INDICATOR_COLORS[indicator] }}>
          {value}
        </span>
      </div>
      <div className="gauge-bar" style={{ width: GAUGE_W }}>
        <div className="gauge-zone crit" style={{ width: pct(config.criticalValue) }} />
        <div className="gauge-zone warn" style={{ left: pct(config.criticalValue), width: pct(config.sustainedValue - config.criticalValue) }} />
        <div className="gauge-marker" style={{ left: pct(pos) }} />
      </div>
      <div className="gauge-scale">
        <span>{t('danger.bandCritical', { value: config.criticalValue })}</span>
        <span>{t('danger.bandSustained', { value: config.sustainedValue })}</span>
      </div>
      <div className={`gauge-status ${statusCls}`}>{status}</div>
    </div>
  );
}

interface BottomPanelProps {
  store: StoreState;
  preview: OrdersPreview | null;
  errors: string[];
  onSubmit: () => void;
  onToggleDraw: () => void;
}

export function BottomPanel({ store, preview, errors, onSubmit, onToggleDraw }: BottomPanelProps) {
  const t = useT();
  const turnProjection = previewTurn(RULESET, store.game);
  const acting = store.phase.kind === 'planning' ? store.phase.side : null;
  const indicators: Indicator[] = ['stability', 'legitimacy', 'security', 'mobilization'];

  return (
    <footer className="bottom">
      <div className="fin-row">
        <h3 className="section-title">{t('fin.title')}</h3>
        <FinancesCard side="state" store={store} turnProjection={turnProjection.state} preview={acting === 'state' ? preview : null} />
        <FinancesCard side="terrorist" store={store} turnProjection={turnProjection.terrorist} preview={acting === 'terrorist' ? preview : null} />
      </div>
      <div className="danger-block">
        <h3 className="section-title">{t('danger.title')}</h3>
        <div className="danger-row">
          {indicators.map((ind) => (
            <DangerGauge key={ind} indicator={ind} store={store} />
          ))}
        </div>
      </div>
      <div className="action-col">
        {acting && (
          <label className="draw-toggle">
            <input type="checkbox" checked={store.draft.agreeToDraw ?? false} onChange={onToggleDraw} />
            {t('plan.drawOffer')}
          </label>
        )}
        {errors.length > 0 && (
          <ul className="errors">
            <li className="errors-title">{t('plan.errorsTitle')}</li>
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
        <button className="submit-btn" onClick={onSubmit} disabled={errors.length > 0 || !acting}>
          {t('plan.submit')}
        </button>
      </div>
    </footer>
  );
}
