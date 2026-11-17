import { useState } from 'react';
import type { Lang } from '../i18n';
import { useT } from '../i18n';
import { api, ApiError } from './api';
import type { PublicUser } from './types';

export function AuthScreen({
  lang,
  onLang,
  onAuthed,
  onForgot,
}: {
  lang: Lang;
  onLang: (lang: Lang) => void;
  onAuthed: (user: PublicUser) => void;
  onForgot: () => void;
}) {
  const t = useT();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [forgotSent, setForgotSent] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user } =
        mode === 'login'
          ? await api.login(email, password)
          : await api.register(email, password, displayName || undefined);
      onAuthed(user);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.status === 401
            ? t('auth.badCredentials')
            : err.status === 409
              ? t('auth.duplicateEmail')
              : err.message
          : String(err),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <main className="main center-message">
        {forgotSent ? (
          <div className="auth-card">
            <h1 className="mode-title">{t('app.title')}</h1>
            <p>{t('auth.forgotSent')}</p>
            <button className="submit-btn big" onClick={() => setForgotSent(false)}>
              {t('auth.switchToLogin')}
            </button>
          </div>
        ) : (
        <form className="auth-card" onSubmit={submit}>
          <h1 className="mode-title">{t('app.title')}</h1>
          <h2>{t('auth.title')}</h2>
          <label>
            {t('auth.email')}
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <label>
            {t('auth.password')}
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>
          {mode === 'register' && (
            <label>
              {t('auth.displayName')}
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>
          )}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="submit-btn big" type="submit" disabled={busy}>
            {mode === 'login' ? t('auth.login') : t('auth.register')}
          </button>
          <button
            type="button"
            className="link-btn"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? t('auth.switchToRegister') : t('auth.switchToLogin')}
          </button>
          {mode === 'login' && (
            <button type="button" className="link-btn" onClick={onForgot}>
              {t('auth.forgot')}
            </button>
          )}
          <div className="lang-switch" role="group" aria-label={t('topbar.language')}>
            <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => onLang('en')}>
              EN
            </button>
            <button type="button" className={lang === 'ru' ? 'active' : ''} onClick={() => onLang('ru')}>
              РУ
            </button>
          </div>
        </form>
        )}
      </main>
    </div>
  );
}
