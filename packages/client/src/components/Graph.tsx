import { useMemo } from 'react';
import {
  isIndicator,
  type GameState,
  type Indicator,
  type OrdersPreview,
  type Policy,
  type Side,
} from '@bot/engine';
import { useT, useLang, type TFunction } from '../i18n';
import { policyTitleOf } from '../i18n/policies';
import { RULESET, pendingDeltas, type Action } from '../game/store';
import { indicatorOwner, signed, wrapTitle } from '../game/format';

const NODE_W = 176;
const NODE_H = 86;
const VB_W = 1500;
const VB_H = 640;
const BUBBLE_R = 62;

interface NodeBox {
  policy: Policy;
  side: Side;
  x: number;
  y: number;
}

export interface Layout {
  nodes: NodeBox[];
  bubbles: Record<Indicator, { x: number; y: number }>;
}

export function computeLayout(): Layout {
  const nodes: NodeBox[] = [];
  const place = (side: Side, policies: readonly Policy[]) => {
    const colX = side === 'state' ? [24, 24 + NODE_W + 14] : [VB_W - 24 - NODE_W * 2 - 14, VB_W - 24 - NODE_W];
    policies.forEach((policy, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      nodes.push({ policy, side, x: colX[col], y: 24 + row * (NODE_H + 14) });
    });
  };
  place('state', RULESET.policies.state);
  place('terrorist', RULESET.policies.terrorist);
  // Indicator bubbles: state column on the left (stability above legitimacy),
  // terrorist column on the right (security above mobilization).
  const bubbles = {
    stability: { x: 672, y: 176 },
    security: { x: 838, y: 176 },
    legitimacy: { x: 672, y: 462 },
    mobilization: { x: 838, y: 462 },
  } satisfies Record<Indicator, { x: number; y: number }>;
  return { nodes, bubbles };
}

interface Edge {
  key: string;
  d: string;
  delta: number;
  policyId: string;
  target: Indicator;
}

/** Cluster geometry shared by the dashed frame and the neon background art. */
const CLUSTERS: Record<Side, { x: number; y: number; w: number; h: number }> = {
  state: { x: 12, y: 12, w: NODE_W * 2 + 38, h: VB_H - 24 },
  terrorist: { x: VB_W - (NODE_W * 2 + 38) - 12, y: 12, w: NODE_W * 2 + 38, h: VB_H - 24 },
};

/**
 * Neon background art for a policy cluster, drawn under the nodes in viewBox units.
 * Corporation: cyan skyline + perspective grid. Collective: magenta circuit traces.
 */
function ClusterArt({ side }: { side: Side }) {
  const c = CLUSTERS[side];
  if (side === 'state') {
    const base = c.y + c.h - 14;
    const towers = [
      { x: 26, w: 34, h: 120 }, { x: 66, w: 26, h: 190 }, { x: 98, w: 40, h: 90 },
      { x: 144, w: 30, h: 230 }, { x: 180, w: 44, h: 150 }, { x: 230, w: 28, h: 110 },
      { x: 264, w: 36, h: 200 }, { x: 306, w: 26, h: 140 }, { x: 338, w: 38, h: 100 },
    ];
    return (
      <g className="cluster-art state" clipPath="url(#clip-cluster-state)" aria-hidden="true">
        <rect x={c.x} y={c.y} width={c.w} height={c.h} fill="#0c1822" />
        {/* perspective grid floor */}
        {Array.from({ length: 6 }, (_, i) => (
          <line key={`h${i}`} x1={c.x} y1={base - i * 26} x2={c.x + c.w} y2={base - i * 26} className="art-grid" />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`v${i}`} x1={c.x + i * 50} y1={c.y + 120} x2={c.x + c.w / 2 + (i - 4) * 30} y2={base} className="art-grid" />
        ))}
        {/* skyline silhouette with lit windows */}
        {towers.map((t, i) => (
          <g key={i}>
            <rect x={c.x + t.x} y={base - t.h} width={t.w} height={t.h} className="art-tower" />
            {Array.from({ length: Math.floor(t.h / 26) }, (_, r) =>
              Array.from({ length: Math.max(1, Math.floor(t.w / 14)) }, (_, col) => (
                <rect
                  key={`${r}-${col}`}
                  x={c.x + t.x + 5 + col * 13}
                  y={base - t.h + 8 + r * 24}
                  width={4}
                  height={6}
                  className="art-window"
                />
              )),
            )}
          </g>
        ))}
        <line x1={c.x} y1={base} x2={c.x + c.w} y2={base} className="art-horizon" />
      </g>
    );
  }
  const traces = [
    'M 40 90 h 130 v 54 h 84',
    'M 210 40 v 70 h 96 v 60',
    'M 60 200 h 70 v 80 h 150',
    'M 330 150 v 90 h -70',
    'M 150 300 h 120 v 60 h 80',
    'M 40 420 h 160 v -50 h 120',
    'M 300 380 v 90 h -110',
    'M 80 520 h 90 v -60 h 140',
  ];
  return (
    <g className="cluster-art terrorist" clipPath="url(#clip-cluster-terrorist)" aria-hidden="true">
      <rect x={c.x} y={c.y} width={c.w} height={c.h} fill="#1a0d15" />
      <circle cx={c.x + c.w - 70} cy={c.y + 110} r={130} className="art-glow" />
      {traces.map((d, i) => (
        <path key={i} d={d} className="art-trace" />
      ))}
      {[
        [40, 90], [170, 90], [254, 144], [210, 40], [306, 40], [306, 170],
        [60, 200], [130, 200], [130, 280], [280, 280], [330, 150], [330, 240],
        [150, 300], [270, 300], [350, 360], [40, 420], [200, 420], [320, 370],
        [300, 380], [300, 470], [190, 470], [80, 520], [170, 520], [170, 460], [310, 460],
      ].map(([x, y], i) => (
        <circle key={i} cx={c.x + x} cy={y} r={2.6} className="art-node" />
      ))}
      {[
        { x: 30, y: 60, w: 90, h: 5 }, { x: 220, y: 120, w: 60, h: 4 },
        { x: 60, y: 250, w: 120, h: 6 }, { x: 250, y: 320, w: 80, h: 5 },
        { x: 40, y: 470, w: 100, h: 4 }, { x: 200, y: 540, w: 130, h: 6 },
      ].map((b, i) => (
        <rect key={i} x={c.x + b.x} y={c.y + b.y} width={b.w} height={b.h} className="art-glitch" />
      ))}
    </g>
  );
}

function buildEdges(layout: Layout, game: GameState): Edge[] {
  const edges: Edge[] = [];
  for (const node of layout.nodes) {
    const level = game.levels[node.side][node.policy.id] ?? 0;
    if (level === 0) continue;
    for (const effect of node.policy.effects[level] ?? []) {
      if (!isIndicator(effect.target)) continue;
      const b = layout.bubbles[effect.target];
      const x1 = node.side === 'state' ? node.x + NODE_W : node.x;
      const y1 = node.y + NODE_H / 2;
      const x2 = b.x;
      const y2 = b.y;
      const bend = node.side === 'state' ? Math.max(60, (x2 - x1) * 0.45) : -Math.max(60, (x1 - x2) * 0.45);
      edges.push({
        key: `${node.policy.id}->${effect.target}`,
        d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
        delta: effect.delta,
        policyId: node.policy.id,
        target: effect.target,
      });
    }
  }
  return edges;
}

function targetLabel(t: TFunction, target: string): string {
  if (isIndicator(target as Indicator)) {
    const key: 'indicator.stability' | 'indicator.legitimacy' | 'indicator.security' | 'indicator.mobilization' =
      `indicator.${target}` as 'indicator.stability';
    return t(key);
  }
  const key: 'target.stateBudget' | 'target.terroristBudget' = `target.${target}` as 'target.stateBudget';
  return t(key);
}

interface GraphProps {
  game: GameState;
  actingSide: Side | null;
  draft: { changes: { policy: string; delta: 1 | -1 }[] } | null;
  preview: OrdersPreview | null;
  focusId: string | null;
  onFocus: (id: string | null) => void;
  dispatch: (a: Action) => void;
  /** False hides the +/- steppers (observer mode / replay). Defaults to true. */
  interactive?: boolean;
}

export function Graph({ game, actingSide, draft, preview, focusId, onFocus, dispatch, interactive = true }: GraphProps) {
  const t = useT();
  const lang = useLang();
  const layout = useMemo(computeLayout, []);
  const edges = useMemo(() => buildEdges(layout, game), [layout, game]);
  const deltas = draft ? pendingDeltas(draft) : {};

  const nodeById = new Map(layout.nodes.map((n) => [n.policy.id, n]));

  return (
    // No role="img": the graph exposes per-node accessible names (<title> children),
    // which role="img" would hide. Decorative layers are aria-hidden.
    <svg className="graph" viewBox={`0 0 ${VB_W} ${VB_H}`} role="group" aria-label={t('app.title')}>
      <defs>
        {(Object.keys(CLUSTERS) as Side[]).map((side) => (
          <clipPath key={side} id={`clip-cluster-${side}`}>
            <rect x={CLUSTERS[side].x} y={CLUSTERS[side].y} width={CLUSTERS[side].w} height={CLUSTERS[side].h} rx={14} />
          </clipPath>
        ))}
      </defs>

      <g className="edges" aria-hidden="true">
        {edges.map((e) => {
          const hot = focusId === null || focusId === e.policyId;
          const focused = focusId === e.policyId;
          return (
            <path
              key={e.key}
              d={e.d}
              className={`edge ${e.delta >= 0 ? 'pos' : 'neg'}${focused ? ' hot' : ''}${hot ? '' : ' dim'}`}
              strokeWidth={1.5 + Math.min(4, Math.abs(e.delta) / 12)}
            />
          );
        })}
      </g>

      <g className="clusters" aria-hidden="true">
        {(Object.keys(CLUSTERS) as Side[]).map((side) => (
          <ClusterArt key={side} side={side} />
        ))}
        {(Object.keys(CLUSTERS) as Side[]).map((side) => (
          <rect
            key={side}
            x={CLUSTERS[side].x}
            y={CLUSTERS[side].y}
            width={CLUSTERS[side].w}
            height={CLUSTERS[side].h}
            rx={14}
            className={`cluster ${side}`}
          />
        ))}
      </g>

      {(Object.keys(layout.bubbles) as Indicator[]).map((ind) => {
        const b = layout.bubbles[ind];
        const value = game.indicators[ind];
        const projected = preview?.projection.indicators[ind];
        const diff = projected === undefined ? null : projected - value;
        const label = t(`indicator.${ind}` as const);
        const paren = label.indexOf(' (');
        const main = paren === -1 ? label : label.slice(0, paren);
        const sub = paren === -1 ? null : label.slice(paren + 1);
        const inDanger = value <= RULESET.danger[indicatorOwner(ind)].sustainedValue;
        return (
          <g key={ind} className={`bubble ${indicatorOwner(ind)}${inDanger ? ' danger' : ''}`}>
            <title>{`${label}: ${value}`}</title>
            <circle cx={b.x} cy={b.y} r={BUBBLE_R} />
            <text x={b.x} y={b.y - 14} className="bubble-value">
              {value}
            </text>
            {diff !== null && diff !== 0 && (
              <text x={b.x} y={b.y + 4} className={`bubble-delta ${diff >= 0 ? 'pos' : 'neg'}`}>
                {`${diff >= 0 ? '▲' : '▼'}${signed(diff)}`}
              </text>
            )}
            <text x={b.x} y={b.y + 22} className="bubble-label">
              {main}
            </text>
            {sub && (
              <text x={b.x} y={b.y + 34} className="bubble-label sub">
                {sub}
              </text>
            )}
          </g>
        );
      })}

      {layout.nodes.map((node) => {
        const level = game.levels[node.side][node.policy.id] ?? 0;
        const pending = deltas[node.policy.id] ?? 0;
        const after = level + pending;
        const mine = actingSide === node.side;
        const focused = focusId === node.policy.id;
        const dimmedByFocus = focusId !== null && !focused;
        const lines = wrapTitle(policyTitleOf(lang, node.policy), 20);
        const maxLevel = node.policy.maxLevel;
        return (
          <g
            key={node.policy.id}
            className={`pnode ${node.side}${mine ? ' mine' : ''}${focused ? ' focused' : ''}${dimmedByFocus ? ' dim' : ''}`}
            onMouseEnter={() => onFocus(node.policy.id)}
            onMouseLeave={() => onFocus(null)}
          >
            {/* Accessible name for the node: policy, side, level, pending direction.
                The full per-level effect tables (screen-reader friendly) live in HelpModal. */}
            <title>
              {`${policyTitleOf(lang, node.policy)} — ${t(`side.${node.side}`)} — ${t('graph.current', { level })}${
                pending !== 0 ? `, ${t('graph.pending', { delta: signed(pending) })}` : ''
              }`}
            </title>
            <rect x={node.x} y={node.y} width={NODE_W} height={NODE_H} rx={10} className="pnode-box" />
            {lines.map((line, i) => (
              <text key={i} x={node.x + NODE_W / 2} y={node.y + 17 + i * 12} className="pnode-title">
                {line}
              </text>
            ))}
            <g className="pips">
              {Array.from({ length: maxLevel }, (_, i) => (
                <rect
                  key={i}
                  x={node.x + 10 + i * 12}
                  y={node.y + NODE_H - 16}
                  width={9}
                  height={9}
                  rx={2}
                  className={`pip${i < level ? ' on' : ''}${i < after && i >= level ? ' pending' : ''}${i >= after && i < level ? ' pending-down' : ''}`}
                />
              ))}
            </g>
            <text x={node.x + NODE_W - 10} y={node.y + NODE_H - 8} className="pnode-level" textAnchor="end">
              {`L${level}${pending !== 0 ? ` ${signed(pending)}` : ''}`}
            </text>
            {mine && interactive && (
              <>
                <g
                  className="stepper"
                  role="button"
                  aria-label={t('action.decrease')}
                  onClick={() => after > 0 && dispatch({ type: 'addChange', change: { policy: node.policy.id, delta: -1 } })}
                >
                  <circle cx={node.x + NODE_W - 46} cy={node.y + 30} r={11} className={after > 0 ? '' : 'off'} />
                  <text x={node.x + NODE_W - 46} y={node.y + 34} textAnchor="middle">
                    −
                  </text>
                </g>
                <g
                  className="stepper"
                  role="button"
                  aria-label={t('action.increase')}
                  onClick={() => after < maxLevel && dispatch({ type: 'addChange', change: { policy: node.policy.id, delta: 1 } })}
                >
                  <circle cx={node.x + NODE_W - 18} cy={node.y + 30} r={11} className={after < maxLevel ? '' : 'off'} />
                  <text x={node.x + NODE_W - 18} y={node.y + 34} textAnchor="middle">
                    +
                  </text>
                </g>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export { targetLabel };
