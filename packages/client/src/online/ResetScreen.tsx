import { useState } from 'react';
import { useT } from '../i18n';
import { api, ApiError } from './api';

/**
 * A-24: password reset form behind `#/reset/<token>` (linked from the reset email).
 * On success nudges the user back to the login form.
 */
export function ResetScreen({ token, onDone }: { token: string; onDone: () => void }) {
  const t = useT();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError(t('auth.resetMismatch'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.reset(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <main className="main center-message">
        {done ? (
          <div className="auth-card">
            <h1 className="mode-title">{t('app.title')}</h1>
            <p>{t('auth.resetDone')}</p>
            <button className="submit-btn big" onClick={onDone}>
              {t('auth.login')}
            </button>
          </div>
        ) : (
          <form className="auth-card" onSubmit={submit}>
            <h1 className="mode-title">{t('app.title')}</h1>
            <h2>{t('auth.resetTitle')}</h2>
            <label>
              {t('auth.newPassword')}
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label>
              {t('auth.confirmPassword')}
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button className="submit-btn big" type="submit" disabled={busy}>
              {t('auth.resetSubmit')}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
