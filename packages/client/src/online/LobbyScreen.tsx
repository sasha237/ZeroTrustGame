import { useEffect, useState } from 'react';
import type { Side } from '@bot/engine';
import { useT } from '../i18n';
import { api, ApiError } from './api';
import type { GameView, PublicUser } from './types';

export function LobbyScreen({
  user,
  onActive,
  onLoggedOut,
}: {
  user: PublicUser;
  onActive: (gameId: string) => void;
  onLoggedOut: () => void;
}) {
  const t = useT();
  const [side, setSide] = useState<Side>('state');
  const [pending, setPending] = useState<GameView | null>(null); // created, waiting for a join
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // While a created game is open, poll until the opponent joins.
  useEffect(() => {
    if (!pending || pending.status !== 'open') return;
    const timer = setInterval(() => {
      api
        .getGame(pending.id)
        .then(({ game }) => {
          if (game.status === 'active') onActive(game.id);
          else setPending(game);
        })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [pending, onActive]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const { game } = await api.createGame(side);
      setPending(game);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { game } = await api.joinGame(code.trim());
      if (game.status === 'active') onActive(game.id);
      else setPending(game);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 404
            ? t('lobby.codeNotFound')
            : err.message
          : String(err),
      );
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await api.logout();
    onLoggedOut();
  };

  return (
    <div className="app">
      <main className="main center-message">
        <div className="auth-card lobby-card">
          <h1 className="mode-title">{t('app.title')}</h1>
          <div className="lobby-user">
            <span>
              {t('lobby.signedInAs')} <strong>{user.displayName ?? user.email}</strong>
            </span>
            <button className="link-btn" onClick={() => void logout()}>
              {t('auth.logout')}
            </button>
          </div>

          {pending && pending.status === 'open' ? (
            <div className="invite-box">
              <h2>{t('lobby.waiting')}</h2>
              <p>{t('lobby.shareCode')}</p>
              <p className="invite-code">{pending.inviteCode}</p>
              <p>
                {t('lobby.youAre', { side: t(`side.${pending.you?.side ?? 'state'}`) })}
              </p>
              <button className="link-btn" onClick={() => setPending(null)}>
                {t('lobby.cancel')}
              </button>
            </div>
          ) : (
            <>
              <section className="lobby-section">
                <h2>{t('lobby.create')}</h2>
                <div className="side-picker" role="radiogroup" aria-label={t('lobby.playAs')}>
                  {(['state', 'terrorist'] as Side[]).map((s) => (
                    <label key={s} className={`side-option ${s} ${side === s ? 'active' : ''}`}>
                      <input type="radio" name="side" checked={side === s} onChange={() => setSide(s)} />
                      {t(`side.${s}`)}
                    </label>
                  ))}
                </div>
                <button className="submit-btn big" onClick={() => void create()} disabled={busy}>
                  {t('lobby.create')}
                </button>
              </section>
              <div className="lobby-divider">{t('lobby.or')}</div>
              <form className="lobby-section" onSubmit={join}>
                <h2>{t('lobby.join')}</h2>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder={t('lobby.codePlaceholder')}
                  maxLength={8}
                  minLength={8}
                  required
                  className="code-input"
                />
                <button className="submit-btn big online" type="submit" disabled={busy}>
                  {t('lobby.joinButton')}
                </button>
              </form>
            </>
          )}
          {error && <p className="auth-error">{error}</p>}
        </div>
      </main>
    </div>
  );
}
