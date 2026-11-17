import { useT } from '../i18n';

export function ModeScreen({
  onHotseat,
  onOnline,
}: {
  onHotseat: () => void;
  onOnline: () => void;
}) {
  const t = useT();
  return (
    <div className="app">
      <main className="main center-message">
        <div className="mode-card">
          <h1 className="mode-title">{t('app.title')}</h1>
          <p className="mode-sub">{t('mode.subtitle')}</p>
          <button className="submit-btn big" onClick={onHotseat}>
            {t('mode.hotseat')}
          </button>
          <button className="submit-btn big online" onClick={onOnline}>
            {t('mode.online')}
          </button>
        </div>
      </main>
    </div>
  );
}
