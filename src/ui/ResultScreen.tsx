import { DIFFICULTIES } from '../game/config';
import { useUiStore } from '../game/state';
import { getGame } from './gameRef';

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ResultScreen() {
  const s = useUiStore();
  const game = getGame();
  const win = s.phase === 'victory';
  const st = s.stats;

  return (
    <div className="overlay">
      <div className="menu" style={{ width: 'min(720px, 92vw)' }}>
        <div className="menu-eyebrow">{win ? 'Mission Complete' : 'Core Lost'}</div>
        <h1 className={`result-title ${win ? 'win' : 'lose'}`}>{win ? 'コア防衛成功' : 'コア破壊'}</h1>
        <p className="menu-sub">
          {win
            ? `全 ${s.totalWaves} ウェーブの侵攻を退けた。エナジーコアは残存 ${s.coreHp} / ${s.coreMaxHp}。`
            : `WAVE ${st?.wavesCleared ?? 0} まで持ちこたえたが、コアは沈黙した。配置と資金配分を見直して再挑戦しよう。`}
        </p>

        <div className="stat-grid">
          <div className="stat">
            <b>{st?.wavesCleared ?? 0}</b>
            <span>Waves Cleared</span>
          </div>
          <div className="stat">
            <b>{st?.score ?? 0}</b>
            <span>Score</span>
          </div>
          <div className="stat">
            <b>{st?.kills ?? 0}</b>
            <span>Kills</span>
          </div>
          <div className="stat">
            <b>{Math.round((st?.accuracy ?? 0) * 100)}%</b>
            <span>Accuracy</span>
          </div>
          <div className="stat">
            <b>{st?.damageDealt ?? 0}</b>
            <span>Damage</span>
          </div>
          <div className="stat">
            <b>{st?.towersBuilt ?? 0}</b>
            <span>Towers Built</span>
          </div>
          <div className="stat">
            <b>{fmtTime(st?.timeSeconds ?? 0)}</b>
            <span>Time</span>
          </div>
          <div className="stat">
            <b>{DIFFICULTIES[s.difficulty].name}</b>
            <span>Difficulty</span>
          </div>
        </div>

        <div className="start-row">
          <button type="button" className="btn-start" onClick={() => game?.start(s.difficulty, s.quality)}>
            再挑戦
          </button>
          <button
            type="button"
            className="btn"
            style={{ flex: 'none', padding: '12px 26px' }}
            onClick={() => game?.toMenu()}
          >
            メインメニューへ
          </button>
        </div>
      </div>
    </div>
  );
}
