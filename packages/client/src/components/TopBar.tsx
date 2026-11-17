import { useT } from '../i18n';
import { RULESET, type StoreState } from '../game/store';

interface TopBarProps {
  store: StoreState;
  lang: 'en' | 'ru';
  onLang: (lang: 'en' | 'ru') => void;
  onReset: () => void;
  onHelp: () => void;
}

export function TopBar({ store, lang, onLang, onReset, onHelp }: TopBarProps) {
  const t = useT();
  const acting = store.phase.kind === 'planning' ? store.phase.side : null;
  const limit = RULESET.turnLimit ?? 50;
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-dot" />
        <span className="neon-logo">{t('app.title')}</span>
      </div>
      <div className="topbar-center">
        {acting && (
          <span className={`changes-counter ${acting}`}>
            {t('topbar.policyChanges', {
              used: store.draft.changes.length,
              max: RULESET.maxPolicyChangesPerTurn,
            })}
          </span>
        )}
        <span className="turn-tracker">
          {t('topbar.turn', { turn: store.game.turn, limit })}
        </span>
      </div>
      <div className="topbar-actions">
        <div className="lang-switch" role="group" aria-label={t('topbar.language')}>
          <button className={lang === 'en' ? 'active' : ''} onClick={() => onLang('en')}>
            EN
          </button>
          <button className={lang === 'ru' ? 'active' : ''} onClick={() => onLang('ru')}>
            РУ
          </button>
        </div>
        <button className="ghost-btn" onClick={onHelp} aria-label={t('topbar.help')}>
          ?
        </button>
        <button className="ghost-btn" onClick={onReset}>
          {t('topbar.reset')}
        </button>
      </div>
    </header>
  );
}
