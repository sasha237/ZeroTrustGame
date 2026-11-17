import { useMemo, useState } from 'react';
import type { Policy } from '@bot/engine';
import { useT } from '../i18n';
import {
  RULESET,
  pendingDeltas,
  selectDraft,
  selectPreview,
  type Action,
  type StoreState,
} from '../game/store';
import { Graph } from './Graph';
import { PolicyCard } from './PolicyCard';
import { Rail } from './Rail';
import { BottomPanel } from './BottomPanel';

export function PlanningScreen({
  store,
  dispatch,
}: {
  store: StoreState;
  dispatch: (a: Action) => void;
}) {
  const t = useT();
  const side = (store.phase as { side: 'state' | 'terrorist' }).side;
  const draft = selectDraft(store, side);
  const preview = selectPreview(store);
  const [focusId, setFocusId] = useState<string | null>(null);

  const focused: { policy: Policy; side: 'state' | 'terrorist' } | null = useMemo(() => {
    if (!focusId) return null;
    for (const s of ['state', 'terrorist'] as const) {
      const policy = RULESET.policies[s].find((p) => p.id === focusId);
      if (policy) return { policy, side: s };
    }
    return null;
  }, [focusId]);

  const deltas = draft ? pendingDeltas(draft) : {};
  const errors = preview?.errors ?? [];

  return (
    <div className="planning">
      <div className="planning-head">
        <h2 className={`acting-title ${side}`}>{t('plan.title', { side: t(`side.${side}`) })}</h2>
      </div>
      <div className="planning-body">
        <div className="graph-wrap">
          <Graph
            game={store.game}
            actingSide={side}
            draft={draft}
            preview={preview}
            focusId={focusId}
            onFocus={setFocusId}
            dispatch={dispatch}
          />
          {focused && (
            <PolicyCard
              policy={focused.policy}
              side={focused.side}
              level={store.game.levels[focused.side][focused.policy.id] ?? 0}
              pending={deltas[focused.policy.id] ?? 0}
              preview={focused.side === side ? preview : null}
              onClose={() => setFocusId(null)}
            />
          )}
        </div>
        <Rail store={store} />
      </div>
      <BottomPanel
        store={store}
        preview={preview}
        errors={errors}
        onSubmit={() => dispatch({ type: 'submit' })}
        onToggleDraw={() => dispatch({ type: 'toggleDraw' })}
      />
    </div>
  );
}
