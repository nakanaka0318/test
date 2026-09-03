import { ECONOMY, TOWERS, TOWER_ORDER, type TowerKind } from '../game/config';
import { useUiStore } from '../game/state';
import { getGame } from './gameRef';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export default function BuildOverlay() {
  const s = useUiStore();
  const game = getGame();
  if (!s.buildMode) return null;

  const select = (k: TowerKind) => game?.setSelectedKind(k);
  const sel = s.selectedTower;

  return (
    <div className="build-root">
      <div className="build-banner">建設モード — 左クリックで設置 / タワーを選択</div>

      <div className="hud-panel build-side">
        <span className="label">操作</span>
        <ul>
          <li>マウス移動でマス選択、左クリックで設置</li>
          <li>設置済みタワーをクリックで詳細表示</li>
          <li><kbd>U</kbd> 強化 / <kbd>X</kbd> 売却</li>
          <li><kbd>G</kbd> コア修復（{ECONOMY.repairCost} CR で +{ECONOMY.repairAmount}）</li>
          <li><kbd>Tab</kbd> で戦闘に復帰</li>
        </ul>
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button type="button" className="btn" onClick={() => game?.repairCore()}>
            コア修復 {ECONOMY.repairCost}
          </button>
          <button type="button" className="btn primary" onClick={() => game?.setBuildMode(false)}>
            戦闘へ
          </button>
        </div>
      </div>

      {sel && (
        <div className="hud-panel tower-info">
          <h3 style={{ color: hex(TOWERS[sel.kind].color) }}>
            {TOWERS[sel.kind].name} <span className="label">Lv{sel.level + 1}</span>
          </h3>
          <div className="label">{TOWERS[sel.kind].desc}</div>
          <div className="tower-info-stats">
            <span>ダメージ</span>
            <span>{sel.damage}</span>
            <span>射程</span>
            <span>{sel.range.toFixed(0)} m</span>
            <span>連射間隔</span>
            <span>{sel.fireInterval.toFixed(2)} s</span>
            <span>耐久</span>
            <span>
              {sel.hp} / {sel.maxHp}
            </span>
          </div>
          <div className="btn-row">
            <button
              type="button"
              className="btn"
              disabled={sel.upgradeCost <= 0 || s.credits < sel.upgradeCost}
              onClick={() => game?.upgradeSelected()}
            >
              {sel.upgradeCost > 0 ? `強化 ${sel.upgradeCost}` : 'MAX'}
            </button>
            <button type="button" className="btn danger" onClick={() => game?.sellSelected()}>
              売却 +{sel.sellValue}
            </button>
          </div>
        </div>
      )}

      <div className="build-bar">
        {TOWER_ORDER.map((k) => {
          const t = TOWERS[k];
          const poor = s.credits < t.cost;
          return (
            <button
              key={k}
              type="button"
              className={`tower-card${s.selectedKind === k ? ' on' : ''}${poor ? ' poor' : ''}`}
              style={{ ['--tc' as string]: hex(t.color) }}
              onClick={() => select(k)}
            >
              <div className="tower-card-head">
                <span className="tower-card-name">{t.name}</span>
                <span className="tower-card-key">{t.hotkey}</span>
              </div>
              <div className="tower-card-desc">{t.desc}</div>
              <div className="tower-card-cost">{t.cost} CR</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
