import { useState } from 'react';
import { DIFFICULTIES, TOWERS, TOWER_ORDER, type Difficulty } from '../game/config';
import type { Quality } from '../game/core/Engine';
import { getGame } from './gameRef';

const QUALITIES: Array<{ id: Quality; name: string; detail: string }> = [
  { id: 'high', name: 'HIGH', detail: '影・ブルーム・高解像度。GPU に余裕がある場合。' },
  { id: 'medium', name: 'MEDIUM', detail: 'バランス重視。多くの環境で 60fps。' },
  { id: 'low', name: 'LOW', detail: '影とポストエフェクトを無効化して最速。' },
];

const CONTROLS: Array<[string, string]> = [
  ['移動', 'W A S D'],
  ['ダッシュ', 'Shift'],
  ['ジャンプ', 'Space'],
  ['射撃', '左クリック'],
  ['エイム', '右クリック'],
  ['リロード', 'R'],
  ['武器切替', '1 / 2 / 3 / ホイール'],
  ['建設モード', 'Tab または B'],
  ['タワー選択（建設中）', '1 - 4'],
  ['アップグレード / 売却', 'U / X'],
  ['コア修復（建設中）', 'G'],
  ['ウェーブ即開始', 'Enter'],
  ['ミュート', 'M'],
  ['ポーズ', 'Esc'],
];

export default function MainMenu() {
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [quality, setQuality] = useState<Quality>('high');

  const start = () => {
    const g = getGame();
    if (!g) return;
    g.audio.resume();
    g.start(difficulty, quality);
  };

  return (
    <div className="overlay">
      <div className="menu">
        <div className="menu-eyebrow">Tower Defense Shooter</div>
        <h1>
          ラスト・バスティオン
          <br />
          CORE DEFENSE 3D
        </h1>
        <p className="menu-sub">
          四方のゲートから押し寄せる敵性ドローンの群れ。中央の<strong>エナジーコア</strong>を 20 ウェーブ守り抜け。
          あなたは自ら銃を取って前線に立ちながら、撃破報酬でタワーを建設・強化する
          <strong>一人称タワーディフェンスシューター</strong>の指揮官だ。
        </p>

        <div className="section-title">難易度</div>
        <div className="menu-grid">
          {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
            <button
              key={d}
              type="button"
              className={`opt-card${difficulty === d ? ' on' : ''}`}
              onClick={() => setDifficulty(d)}
            >
              <b>{DIFFICULTIES[d].name}</b>
              <span>{DIFFICULTIES[d].detail}</span>
            </button>
          ))}
        </div>

        <div className="section-title">グラフィック</div>
        <div className="menu-grid">
          {QUALITIES.map((q) => (
            <button
              key={q.id}
              type="button"
              className={`opt-card${quality === q.id ? ' on' : ''}`}
              onClick={() => setQuality(q.id)}
            >
              <b>{q.name}</b>
              <span>{q.detail}</span>
            </button>
          ))}
        </div>

        <div className="section-title">建設できるタワー</div>
        <div className="menu-grid">
          {TOWER_ORDER.map((k) => {
            const t = TOWERS[k];
            return (
              <div key={k} className="opt-card" style={{ cursor: 'default' }}>
                <b style={{ color: `#${t.color.toString(16).padStart(6, '0')}` }}>
                  {t.name} — {t.cost} CR
                </b>
                <span>{t.desc}</span>
              </div>
            );
          })}
        </div>

        <div className="section-title">操作</div>
        <div className="controls">
          {CONTROLS.map(([label, key]) => (
            <div key={label}>
              <span>{label}</span>
              <kbd>{key}</kbd>
            </div>
          ))}
        </div>

        <div className="start-row">
          <button type="button" className="btn-start" onClick={start}>
            出撃する
          </button>
          <p className="mini-note" style={{ margin: 0 }}>
            クリックでマウスがロックされます。Esc でポーズ。<br />
            準備フェーズ中に <kbd>Tab</kbd> で俯瞰視点に切り替え、タワーを配置しましょう。
          </p>
        </div>
      </div>
    </div>
  );
}
