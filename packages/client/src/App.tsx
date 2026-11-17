import { useEffect, useReducer, useState } from 'react';
import { LangContext, useT, type Lang } from './i18n';
import { initStore, reducer } from './game/store';
import { TopBar } from './components/TopBar';
import { PlanningScreen } from './components/PlanningScreen';
import { HandoffScreen } from './components/HandoffScreen';
import { RevealScreen } from './components/RevealScreen';
import { GameOverScreen } from './components/GameOverScreen';
import { HelpModal } from './components/HelpModal';
import { ModeScreen } from './online/ModeScreen';
import { AuthScreen } from './online/AuthScreen';
import { LobbyScreen } from './online/LobbyScreen';
import { OnlineGameScreen } from './online/OnlineGameScreen';
import { ObserverScreen } from './online/ObserverScreen';
import { ResetScreen } from './online/ResetScreen';
import { parseHash } from './online/route';
import { api } from './online/api';
import type { PublicUser } from './online/types';

/** A-24: forgot-password form — always shows the same confirmation (no enumeration). */
function ForgotScreen({ onBack }: { onBack: () => void }) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.forgot(email);
    } finally {
      setBusy(false);
      setSent(true);
    }
  };
  return (
    <div className="app">
      <main className="main center-message">
        {sent ? (
          <div className="auth-card">
            <h1 className="mode-title">{t('app.title')}</h1>
            <p>{t('auth.forgotSent')}</p>
            <button className="submit-btn big" onClick={onBack}>
              {t('auth.switchToLogin')}
            </button>
          </div>
        ) : (
          <form className="auth-card" onSubmit={submit}>
            <h1 className="mode-title">{t('app.title')}</h1>
            <h2>{t('auth.forgotTitle')}</h2>
            <label>
              {t('auth.email')}
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            <button className="submit-btn big" type="submit" disabled={busy}>
              {t('auth.forgotSubmit')}
            </button>
            <button type="button" className="link-btn" onClick={onBack}>
              {t('auth.switchToLogin')}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

function HotseatApp({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const [store, dispatch] = useReducer(reducer, undefined, initStore);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="app">
      <TopBar
        store={store}
        lang={lang}
        onLang={setLang}
        onReset={() => dispatch({ type: 'reset' })}
        onHelp={() => setHelpOpen(true)}
      />
      <main className="main">
        {store.phase.kind === 'planning' && (
          <PlanningScreen key={`${store.game.turn}-${store.phase.side}`} store={store} dispatch={dispatch} />
        )}
        {store.phase.kind === 'handoff' && (
          <HandoffScreen nextSide={store.phase.nextSide} onConfirm={() => dispatch({ type: 'confirmHandoff' })} />
        )}
        {store.phase.kind === 'reveal' && (
          <RevealScreen key={store.game.turn} store={store} onFinish={() => dispatch({ type: 'finishReveal' })} />
        )}
        {store.phase.kind === 'gameover' && (
          <GameOverScreen store={store} onRematch={() => dispatch({ type: 'reset' })} />
        )}
      </main>
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

function NoticeScreen({ message, onBack }: { message: string; onBack: () => void }) {
  const t = useT();
  return (
    <div className="app">
      <main className="main center-message">
        <div className="auth-card">
          <p>{message}</p>
          <button className="submit-btn big" onClick={onBack}>
            {t('online.backToLobby')}
          </button>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState<Lang>('en');
  const [mode, setMode] = useState<'menu' | 'hotseat' | 'online'>('menu');
  const [user, setUser] = useState<PublicUser | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [route, setRoute] = useState(() => parseHash(location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const leaveGame = (message?: string) => {
    setGameId(null);
    setNotice(message ?? null);
  };

  // Observer links (#/observe/<token>) work without an account and override the mode flow.
  if (route.kind === 'observe') {
    return (
      <LangContext.Provider value={lang}>
        <ObserverScreen
          token={route.token}
          lang={lang}
          onLang={setLang}
          onHelp={() => setHelpOpen(true)}
          onExit={() => {
            location.hash = '';
            setRoute({ kind: 'home' });
          }}
        />
        {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      </LangContext.Provider>
    );
  }

  // Password-reset links from the reset email (#/reset/<token>) — no account needed.
  if (route.kind === 'reset') {
    return (
      <LangContext.Provider value={lang}>
        <ResetScreen
          token={route.token}
          onDone={() => {
            location.hash = '';
            setRoute({ kind: 'home' });
            setMode('online');
          }}
        />
      </LangContext.Provider>
    );
  }

  if (forgotOpen) {
    return (
      <LangContext.Provider value={lang}>
        <ForgotScreen onBack={() => setForgotOpen(false)} />
      </LangContext.Provider>
    );
  }

  return (
    <LangContext.Provider value={lang}>
      {mode === 'menu' && (
        <ModeScreen onHotseat={() => setMode('hotseat')} onOnline={() => setMode('online')} />
      )}
      {mode === 'hotseat' && <HotseatApp lang={lang} setLang={setLang} />}
      {mode === 'online' && !user && (
        <AuthScreen
          lang={lang}
          onLang={setLang}
          onAuthed={(u) => {
            setUser(u);
            setNotice(null);
          }}
          onForgot={() => setForgotOpen(true)}
        />
      )}
      {mode === 'online' && user && !gameId && !notice && (
        <LobbyScreen
          user={user}
          onActive={(id) => {
            setNotice(null);
            setGameId(id);
          }}
          onLoggedOut={() => setUser(null)}
        />
      )}
      {mode === 'online' && user && gameId && (
        <OnlineGameScreen
          gameId={gameId}
          lang={lang}
          onLang={setLang}
          onHelp={() => setHelpOpen(true)}
          onLeave={leaveGame}
        />
      )}
      {mode === 'online' && user && notice && <NoticeScreen message={notice} onBack={() => setNotice(null)} />}
      {mode === 'online' && helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </LangContext.Provider>
  );
}
