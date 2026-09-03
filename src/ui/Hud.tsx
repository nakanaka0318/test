import { WEAPONS, WEAPON_ORDER } from '../game/config';
import { useUiStore } from '../game/state';

function pct(v: number, max: number) {
  return `${Math.max(0, Math.min(100, (v / Math.max(max, 1)) * 100))}%`;
}

export default function Hud() {
  const s = useUiStore();
  const coreRatio = s.coreHp / Math.max(1, s.coreMaxHp);
  const hpRatio = s.playerHp / Math.max(1, s.playerMaxHp);
  const critical = coreRatio < 0.3;
  const boss = s.wave % 5 === 0 && s.wave > 0;
  const ammoLow = s.ammo <= Math.ceil(s.magSize * 0.25);

  return (
    <div className="hud">
      {/* ウェーブ */}
      <div className={`hud-panel hud-wave${boss ? ' boss' : ''}`}>
        <div className="hud-wave-top">
          <span className="label">Wave</span>
          <span className="hud-wave-num">{String(s.wave).padStart(2, '0')}</span>
          <span className="hud-wave-total">/ {s.totalWaves}</span>
        </div>
        <div className="hud-wave-head">{s.phase === 'prep' ? '防衛準備フェーズ' : s.waveHeadline}</div>
        <div className="hud-wave-meta">
          {s.phase === 'prep' ? (
            <>
              <span>開始まで</span>
              <span>{s.waveTimer.toFixed(1)}s</span>
            </>
          ) : (
            <>
              <span>残存 {s.enemiesRemaining}</span>
              <span>戦域 {s.enemiesAlive}</span>
            </>
          )}
        </div>
        {s.phase === 'prep' && (
          <div className="bar" style={{ marginTop: 6 }}>
            <span style={{ width: pct(s.waveTimer, s.wave === 0 ? 25 : 13), background: 'var(--hud-amber)' }} />
          </div>
        )}
      </div>

      {/* コア */}
      <div className={`hud-panel hud-core${critical ? ' critical' : ''}`}>
        <div className="hud-core-row">
          <span className="label">Energy Core Integrity</span>
          <span className="hud-core-value">
            {s.coreHp} / {s.coreMaxHp}
          </span>
        </div>
        <div className="bar">
          <span
            style={{
              width: pct(s.coreHp, s.coreMaxHp),
              background: critical
                ? 'linear-gradient(90deg,#ff2d1f,#ff7a5a)'
                : 'linear-gradient(90deg,#2ad4ff,#7cf3ff)',
              boxShadow: '0 0 14px rgba(90,220,255,0.5)',
            }}
          />
        </div>
      </div>

      {/* 資源 */}
      <div className="hud-panel hud-res">
        <div className="hud-res-row credits">
          <span className="label">Credits</span>
          <b>{s.credits}</b>
        </div>
        <div className="hud-res-row">
          <span className="label">Score</span>
          <b>{s.score}</b>
        </div>
        <div className="hud-res-row">
          <span className="label">Kills</span>
          <b>{s.kills}</b>
        </div>
        <div className="hud-res-row">
          <span className="label">Towers</span>
          <b>{s.towerCount}</b>
        </div>
        <div className="fps">{s.fps} FPS</div>
      </div>

      {/* 体力 */}
      <div className="hud-panel hud-vitals">
        <div className="hud-vitals-row">
          <span className="label">Vitals</span>
          <span className="hud-hp-value" style={{ color: hpRatio < 0.35 ? 'var(--hud-red)' : 'var(--hud-green)' }}>
            {s.playerHp}
          </span>
        </div>
        <div className="bar">
          <span
            style={{
              width: pct(s.playerHp, s.playerMaxHp),
              background:
                hpRatio < 0.35 ? 'linear-gradient(90deg,#ff3524,#ff8168)' : 'linear-gradient(90deg,#39e08e,#8dffcf)',
            }}
          />
        </div>
      </div>

      {/* 武器 */}
      <div className="hud-panel hud-weapon">
        <div className="hud-weapon-name">{WEAPONS[s.weapon].name}</div>
        <div className={`hud-ammo${ammoLow ? ' low' : ''}`}>
          {s.reloading ? 'RELOAD' : s.ammo}
          {!s.reloading && <small> / {s.magSize}</small>}
        </div>
        {s.reloading && (
          <div className="bar reload-bar">
            <span style={{ width: `${s.reloadProgress * 100}%`, background: 'var(--hud-amber)' }} />
          </div>
        )}
        <div className="hud-weapon-list">
          {WEAPON_ORDER.map((w, i) => (
            <span key={w} className={`hud-weapon-chip${w === s.weapon ? ' on' : ''}`}>
              {i + 1} {WEAPONS[w].label}
            </span>
          ))}
        </div>
      </div>

      {!s.buildMode && (
        <div className="hud-hint">
          <kbd>Tab</kbd> 建設モード
          {s.phase === 'prep' && (
            <>
              {' · '}
              <kbd>Enter</kbd> ウェーブ即開始
            </>
          )}
        </div>
      )}

      {/* トースト */}
      <div className="toasts">
        {s.toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>

      {/* 戦闘不能 */}
      {!s.playerAlive && (
        <div className="respawn">
          <div>
            <h2>DOWN</h2>
            <p>
              再出撃まで {s.respawnIn.toFixed(1)} 秒
              <br />
              タワーが防衛を継続しています
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
