import { useState } from 'react';
import type { Lang } from '../i18n';
import { useT } from '../i18n';
import { TopBar } from '../components/TopBar';
import { PlanningScreen } from '../components/PlanningScreen';
import { RevealScreen } from '../components/RevealScreen';
import { GameOverScreen } from '../components/GameOverScreen';
import { Graph } from '../components/Graph';
import { useOnlineGame } from './useOnlineGame';
import { api, downloadBlob, exportCsv } from './api';
import { observerLinkUrl } from './route';
import { lastResolvedTurn } from './store';
import { ReplayScreen } from './ReplayScreen';

export interface OnlineGameScreenProps {
  gameId: string;
  lang: Lang;
  onLang: (lang: Lang) => void;
  onHelp: () => void;
  onLeave: (message?: string) => void;
}

/** Copies text to the clipboard with a fallback for non-secure contexts. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export function OnlineGameScreen({ gameId, lang, onLang, onHelp, onLeave }: OnlineGameScreenProps) {
  const t = useT();
  const game = useOnlineGame(gameId, onLeave);
  const { view, phase, store, reconnecting, error } = game;
  const [replayOpen, setReplayOpen] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [toolError, setToolError] = useState<string | null>(null);

  if (!store || !view) {
    return (
      <div className="app">
        <main className="main center-message">{t('online.loading')}</main>
      </div>
    );
  }

  const resolvedTurns = lastResolvedTurn(view);

  const shareObserverLink = async () => {
    setToolError(null);
    try {
      const token = linkToken ?? (await api.observerLink(gameId)).token;
      setLinkToken(token);
      const ok = await copyText(observerLinkUrl(token));
      setCopied(ok);
      if (!ok) setToolError(`${t('obs.copyFailed')} — ${observerLinkUrl(token)}`);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      setToolError(err instanceof Error ? err.message : String(err));
    }
  };

  const downloadCsv = async () => {
    setToolError(null);
    try {
      const blob = await exportCsv(gameId);
      downloadBlob(blob, `balance-of-terror-${gameId}.csv`);
    } catch (err) {
      setToolError(t('obs.exportFailed', { message: err instanceof Error ? err.message : String(err) }));
    }
  };

  return (
    <div className="app">
      {reconnecting && <div className="reconnect-banner">{t('online.reconnecting')}</div>}
      {error && (
        <div className="error-banner">
          <span>{t('online.submitFailed', { message: error })}</span>
          <button className="ghost-btn" onClick={game.dismissError} aria-label={t('replay.close')}>
            ✕
          </button>
        </div>
      )}
      {toolError && (
        <div className="error-banner">
          <span>{toolError}</span>
          <button className="ghost-btn" onClick={() => setToolError(null)} aria-label={t('replay.close')}>
            ✕
          </button>
        </div>
      )}
      <TopBar store={store} lang={lang} onLang={onLang} onReset={() => onLeave()} onHelp={onHelp} />
      <div className="game-toolbar">
        <button className="ghost-btn" onClick={() => void shareObserverLink()}>
          {copied ? `✓ ${t('obs.linkCopied')}` : t('obs.copyLink')}
        </button>
        <button className="ghost-btn" onClick={() => void downloadCsv()}>
          ⬇ {t('obs.export')}
        </button>
        <button className="ghost-btn" disabled={resolvedTurns === 0} onClick={() => setReplayOpen(true)}>
          ▶ {t('replay.title')}
        </button>
      </div>
      <main className="main">
        {phase.kind === 'planning' && <PlanningScreen key={`${view.turn}-${view.you?.side}`} store={store} dispatch={game.dispatch} />}
        {phase.kind === 'waiting' && (
          <div className="screen waiting">
            <div className="waiting-card">
              <h2>{t('online.waitingTitle')}</h2>
              <p>{t('online.waitingBody')}</p>
              <p className={`presence-line ${view.opponent?.connected ? 'on' : 'off'}`}>
                {view.opponent?.connected
                  ? view.opponent.submitted
                    ? t('online.opponentSubmitted')
                    : t('online.opponentThinking')
                  : t('online.opponentAway')}
              </p>
              <div className="graph-wrap waiting-graph">
                <Graph game={store.game} actingSide={view.you?.side ?? 'state'} draft={null} preview={null} focusId={null} onFocus={() => {}} dispatch={() => {}} />
              </div>
            </div>
          </div>
        )}
        {phase.kind === 'reveal' && <RevealScreen key={store.game.turn} store={store} onFinish={game.ackReveal} />}
        {phase.kind === 'gameover' && <GameOverScreen store={store} onRematch={() => onLeave()} />}
      </main>
      {replayOpen && <ReplayScreen view={view} onClose={() => setReplayOpen(false)} />}
    </div>
  );
}
