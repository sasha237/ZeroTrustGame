import { useT } from '../i18n';

/** Turn scrubber (A-21): range input + prev/next + jump-to-latest. */
export function ReplayBar({
  turn,
  total,
  onScrub,
}: {
  turn: number;
  total: number;
  onScrub: (turn: number | null) => void;
}) {
  const t = useT();
  return (
    <div className="replay-bar">
      <button className="ghost-btn" disabled={turn <= 1} onClick={() => onScrub(turn - 1)} aria-label={t('replay.prev')}>
        ‹
      </button>
      <input
        type="range"
        min={1}
        max={total}
        value={turn}
        onChange={(e) => onScrub(Number(e.target.value))}
        aria-label={t('replay.turnOf', { turn, total })}
      />
      <button className="ghost-btn" disabled={turn >= total} onClick={() => onScrub(turn + 1)} aria-label={t('replay.next')}>
        ›
      </button>
      <span className="replay-label">{t('replay.turnOf', { turn, total })}</span>
      {turn < total && (
        <button className="link-btn" onClick={() => onScrub(null)}>
          {t('replay.latest')}
        </button>
      )}
    </div>
  );
}
