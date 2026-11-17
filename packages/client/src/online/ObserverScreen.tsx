import { useCallback, useEffect, useState } from 'react';
import type { Lang } from '../i18n';
import { useT } from '../i18n';
import { TopBar } from '../components/TopBar';
import { Graph } from '../components/Graph';
import { Rail } from '../components/Rail';
import { BottomPanel } from '../components/BottomPanel';
import { api, ApiError } from './api';
import { GameSocket, observerSocketUrl } from './ws';
import { buildStoreState, emptyDraft, lastResolvedTurn } from './store';
import { ReplayView } from './ReplayScreen';
import type { GameView, ServerMessage } from './types';

export interface ObserverScreenProps {
  token: string;
  lang: Lang;
  onLang: (lang: Lang) => void;
  onHelp: () => void;
  onExit: () => void;
}

/**
 * Observer mode (A-19): read-only live view via the unguessable token — no account.
 * The replay scrubber is the main view once any turn is resolved; it always renders
 * the position through the selected turn (live == end of the last resolved turn,
 * because the position only changes at resolution).
 */
export function ObserverScreen({ token, lang, onLang, onHelp, onExit }: ObserverScreenProps) {
  const t = useT();
  const [view, setView] = useState<GameView | null>(null);
  const [failed, setFailed] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  const refetch = useCallback(async () => {
    try {
      const { game } = await api.observe(token);
      setView(game);
      setFailed(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setFailed(true);
    }
  }, [token]);

  useEffect(() => {
    let disposed = false;
    let socket: GameSocket | null = null;
    const bootstrap = async () => {
      await refetch();
      if (disposed) return;
      socket = new GameSocket(observerSocketUrl(token), {
        onMessage: (_m: ServerMessage) => void refetch(),
        onDrop: () => setReconnecting(true),
        onResume: () => {
          setReconnecting(false);
          void refetch();
        },
      });
    };
    void bootstrap();
    return () => {
      disposed = true;
      socket?.close();
    };
  }, [token, refetch]);

  if (failed) {
    return (
      <div className="app">
        <main className="main center-message">
          <div className="auth-card">
            <p>{t('obs.unknown')}</p>
            <button className="submit-btn big" onClick={onExit}>
              {t('obs.exit')}
            </button>
          </div>
        </main>
      </div>
    );
  }

  const live = view ? buildStoreState(view, emptyDraft()) : null;
  const store = live ? { ...live, phase: { kind: 'readonly' as const } } : null;
  const total = view ? lastResolvedTurn(view) : 0;

  return (
    <div className="app">
      {reconnecting && <div className="reconnect-banner">{t('online.reconnecting')}</div>}
      {store && view && (
        <>
          <div className="obs-badge">{t('obs.badge')}</div>
          <TopBar store={store} lang={lang} onLang={onLang} onReset={onExit} onHelp={onHelp} />
          <main className="main">
            {total === 0 ? (
              <div className="observer-replay">
                <p className="obs-waiting">{t('obs.waiting')}</p>
                <div className="replay-body">
                  <div className="graph-wrap">
                    <Graph game={store.game} actingSide={null} draft={null} preview={null} focusId={null} onFocus={() => {}} dispatch={() => {}} interactive={false} />
                  </div>
                  <Rail store={store} />
                </div>
                <BottomPanel store={store} preview={null} errors={[]} onSubmit={() => {}} onToggleDraw={() => {}} />
              </div>
            ) : (
              <div className="observer-replay">
                <ReplayView view={view} />
              </div>
            )}
          </main>
        </>
      )}
    </div>
  );
}
