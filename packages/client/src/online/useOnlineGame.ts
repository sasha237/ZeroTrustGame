import { useCallback, useEffect, useRef, useState } from 'react';
import type { Orders, Side } from '@bot/engine';
import { previewOrders } from '@bot/engine';
import { RULESET, draftWithChange, type Action } from '../game/store';
import { api, ApiError, getToken } from './api';
import { GameSocket, gameSocketUrl } from './ws';
import { buildStoreState, derivePhase, emptyDraft, type OnlinePhase } from './store';
import type { GameView, ServerMessage } from './types';

export interface OnlineGame {
  view: GameView | null;
  phase: OnlinePhase;
  store: ReturnType<typeof buildStoreState>;
  draftPreview: ReturnType<typeof previewOrders> | null;
  reconnecting: boolean;
  error: string | null;
  dispatch: (action: Action) => void;
  ackReveal: () => void;
  dismissError: () => void;
}

/**
 * Server-authoritative game hook: REST fetch + WS subscription, local draft for the
 * planning screen, reveal acknowledgement tracking. Any WS event triggers a refetch,
 * so the rendered state always comes from the server's own view.
 */
export function useOnlineGame(gameId: string, onLeft: (message?: string) => void): OnlineGame {
  const [view, setView] = useState<GameView | null>(null);
  const [draft, setDraft] = useState<Orders>(emptyDraft());
  const [ackedTurn, setAckedTurn] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewRef = useRef<GameView | null>(null);
  viewRef.current = view;

  const refetch = useCallback(async () => {
    try {
      const { game } = await api.getGame(gameId);
      setView(game);
      return game;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) onLeft(err.message);
      else setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [gameId, onLeft]);

  useEffect(() => {
    let disposed = false;
    let socket: GameSocket | null = null;
    setView(null);
    setDraft(emptyDraft());
    setAckedTurn(0);

    const bootstrap = async () => {
      const game = await refetch();
      if (disposed || !game) return;
      const token = getToken();
      if (!token) return;
      socket = new GameSocket(gameSocketUrl(gameId, token), {
        // The server view is the single source of truth; every event refetches it.
        onMessage: (_message: ServerMessage) => void refetch(),
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
  }, [gameId, refetch]);

  const dispatch = useCallback(
    (action: Action) => {
      const current = viewRef.current;
      if (!current || current.status !== 'active' || !current.you || !current.state) return;
      const side: Side = current.you.side;
      switch (action.type) {
        case 'addChange':
          // Same stepper semantics as hot-seat (net-zero cancels an opposite step).
          setDraft((d) => ({
            ...d,
            changes: draftWithChange(d.changes, action.change, RULESET.maxPolicyChangesPerTurn),
          }));
          break;
        case 'toggleDraw':
          setDraft((d) => ({ ...d, agreeToDraw: !d.agreeToDraw }));
          break;
        case 'submit': {
          const orders: Orders = {
            changes: draftRef.current.changes,
            agreeToDraw: draftRef.current.agreeToDraw ? true : undefined,
          };
          setError(null);
          api
            .submitOrders(gameId, orders)
            .then(({ game }) => {
              setDraft(emptyDraft());
              setView(game);
            })
            .catch((err) => {
              setError(err instanceof Error ? err.message : String(err));
            });
          break;
        }
        default:
          break;
      }
    },
    [gameId],
  );
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const phase = derivePhase(view, ackedTurn);
  const store = view ? buildStoreState(view, draft) : null;
  const acting = phase.kind === 'planning' && view?.you ? view.you.side : null;
  const draftPreview = acting && view?.state ? previewOrders(RULESET, view.state, acting, draft) : null;

  return {
    view,
    phase,
    store,
    draftPreview,
    reconnecting,
    error,
    dispatch,
    ackReveal: () => {
      const lastResolved = view?.history.length ? view.history[view.history.length - 1]!.turn : 0;
      setAckedTurn(lastResolved);
    },
    dismissError: () => setError(null),
  };
}
