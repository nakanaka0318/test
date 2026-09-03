import { DIFFICULTIES } from '../game/config';
import type { Quality } from '../game/core/Engine';
import { useUiStore } from '../game/state';
import { getGame } from './gameRef';

const QUALITIES: Quality[] = ['low', 'medium', 'high'];

export default function PauseMenu() {
  const s = useUiStore();
  const game = getGame();

  return (
    <div className="overlay">
      <div className="menu" style={{ width: 'min(620px, 92vw)' }}>
        <div className="menu-eyebrow">Paused</div>
        <h1 style={{ fontSize: 34 }}>作戦一時停止</h1>
        <p className="menu-sub">
          WAVE {s.wave} / {s.totalWaves} — 難易度 {DIFFICULTIES[s.difficulty].name} ／ スコア {s.score}
        </p>

        <div className="section-title">グラフィック品質</div>
        <div className="btn-row">
          {QUALITIES.map((q) => (
            <button
              key={q}
              type="button"
              className={`btn${s.quality === q ? ' primary' : ''}`}
              onClick={() => game?.setQuality(q)}
            >
              {q.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="section-title">サウンド</div>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => game?.toggleMute()}>
            {s.muted ? 'ミュート解除' : 'ミュート'}
          </button>
        </div>

        <div className="start-row">
          <button type="button" className="btn-start" onClick={() => game?.setPaused(false)}>
            戦線に戻る
          </button>
          <button type="button" className="btn danger" style={{ flex: 'none', padding: '12px 26px' }} onClick={() => game?.toMenu()}>
            作戦を放棄
          </button>
        </div>
        <p className="mini-note">Esc でも復帰できます。戻るとマウスが再度ロックされます。</p>
      </div>
    </div>
  );
}
