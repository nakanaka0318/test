import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBattleStore } from '../store/battleStore';
import { useDraftStore } from '../store/draftStore';
import { useGameStore } from '../store/gameStore';
import { currentUnit } from '../engine/battleEngine';
import { alliesOf, defOf, enemiesOf } from '../engine/battleHelpers';
import { cellsForShape, type Cell } from '../engine/grid';
import GridField from '../components/GridField';
import Joystick from '../components/Joystick';
import { renderTemplate } from '../utils/renderTemplate';
import type { Facing, Team } from '../types';

const DIR_LABEL: Record<Facing, string> = { N: '▲', S: '▼', E: '▶', W: '◀' };

export default function Battle() {
  const navigate = useNavigate();
  const battle = useBattleStore(s => s.battle);
  const pending = useBattleStore(s => s.pending);
  const moveStep = useBattleStore(s => s.moveStep);
  const rotate = useBattleStore(s => s.rotate);
  const setMoveMode = useBattleStore(s => s.setMoveMode);
  const armSkill = useBattleStore(s => s.armSkill);
  const cancelPending = useBattleStore(s => s.cancelPending);
  const confirmArmed = useBattleStore(s => s.confirmArmed);
  const targetSkill = useBattleStore(s => s.targetSkill);
  const endTurn = useBattleStore(s => s.endTurn);
  const runNpcTurnOnce = useBattleStore(s => s.runNpcTurnOnce);
  const resetBattle = useBattleStore(s => s.reset);
  const draft = useDraftStore();
  const applyPostBattle = useGameStore(s => s.applyPostBattle);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!battle && !resolved) navigate('/mode-select');
  }, [battle, resolved, navigate]);

  // NPCの自動行動
  useEffect(() => {
    if (!battle || battle.winner) return;
    const unit = currentUnit(battle);
    if (!unit.isNpc) return;
    const timer = setTimeout(() => runNpcTurnOnce(), 650);
    return () => clearTimeout(timer);
  }, [battle, battle?.turnCount, battle?.turnIndex, runNpcTurnOnce]);

  const unit = battle ? currentUnit(battle) : null;
  const def = battle && unit ? defOf(battle, unit) : null;

  const previewCells: Cell[] = useMemo(() => {
    if (!battle || !unit || !def || !pending) return [];
    const skill = pending.kind === 'skill'
      ? def.skills.find(s => s.id === pending.skillId)
      : def.quickSkill;
    if (!skill?.range || skill.range.kind === 'none') return [];
    if (pending.needsTarget) return [];
    return cellsForShape(unit.pos, unit.facing, skill.range);
  }, [battle, unit, def, pending]);

  const targetableUids = useMemo(() => {
    if (!battle || !unit || !def || !pending || !pending.needsTarget) return [];
    const skill = pending.kind === 'skill'
      ? def.skills.find(s => s.id === pending.skillId)
      : def.quickSkill;
    if (!skill) return [];
    if (skill.targeting === 'enemy') return enemiesOf(battle, unit).map(u => u.uid);
    if (skill.targeting === 'ally') return alliesOf(battle, unit, true).map(u => u.uid);
    if (skill.targeting === 'any-char') return battle.units.filter(u => u.alive).map(u => u.uid);
    return [];
  }, [battle, unit, def, pending]);

  const targetableClones = !!(pending?.kind === 'skill' && def?.skills.find(s => s.id === pending.skillId)?.targeting === 'clone');

  if (!battle || !unit || !def) {
    return <div className="screen"><p>バトルを準備しています…</p></div>;
  }

  const isHumanTurn = !unit.isNpc;

  const handleFinish = () => {
    if (!battle.winner || resolved) return;
    setResolved(true);
    const winnerTeam: Team = battle.winner;
    const loserTeam: Team = winnerTeam === 'A' ? 'B' : 'A';
    const winnerCharIds = battle.units.filter(u => u.team === winnerTeam).map(u => u.charId);
    const loserCharIds = battle.units.filter(u => u.team === loserTeam).map(u => u.charId);
    const banPickCharIds = Array.from(new Set([...draft.bans, ...draft.picksA, ...draft.picksB]));
    const note = applyPostBattle({ winnerCharIds, loserCharIds, banPickCharIds });
    resetBattle();
    draft.resetDraft();
    navigate(`/patch-notes/${note.id}`);
  };

  return (
    <div className="screen battle-screen">
      <div className="turn-order">
        {battle.turnOrder.map(uid => {
          const u = battle.units.find(x => x.uid === uid)!;
          return (
            <div key={uid} className={`slot team-${u.team}${u.uid === unit.uid ? ' current' : ''}${!u.alive ? ' dead' : ''}`}>
              {u.name}
            </div>
          );
        })}
      </div>

      <GridField
        battle={battle}
        previewCells={previewCells}
        targetableUids={targetableUids}
        targetableClones={targetableClones}
        onUnitTap={(uid) => targetSkill({ targetUid: uid })}
        onCloneTap={(index) => targetSkill({ cloneIndex: index })}
      />

      <div className="passive-box">
        <b>パッシブ：{def.passiveName}</b>
        <div>{renderTemplate(def, def.passiveDescriptionTemplate)}</div>
      </div>

      {pending && (
        <div className="hint-bar">
          {pending.needsTarget ? '対象をグリッド上でタップしてください' : 'もう一度タップして発動を確定してください'}
          <button className="back-btn" style={{ marginLeft: 8 }} onClick={cancelPending}>キャンセル</button>
        </div>
      )}
      {!isHumanTurn && <div className="hint-bar">NPCが行動中…</div>}

      <div className="action-row">
        <button
          className="btn"
          disabled={!isHumanTurn || unit.immobileNow || unit.movePoints < 10}
          onClick={() => setMoveMode(!battle.moveModeActive)}
        >
          {battle.moveModeActive ? '移動終了' : '移動開始'}{unit.immobileNow ? '（移動不能）' : ''}
        </button>
        <button className="btn primary" disabled={!isHumanTurn} onClick={endTurn}>ターン終了</button>
      </div>

      <div className="panel" style={{ padding: 8 }}>
        <div className="subtitle" style={{ marginBottom: 4 }}>向き変更（コスト無し）</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['N', 'W', 'S', 'E'] as Facing[]).map(f => (
            <button
              key={f}
              className={`skill-btn${unit.facing === f ? ' armed' : ''}`}
              style={{ flex: 1, textAlign: 'center' }}
              disabled={!isHumanTurn}
              onClick={() => rotate(f)}
            >
              {DIR_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="skill-grid">
        <div className="subtitle">スキル（1ターンに1つのみ）</div>
        {def.skills.map(sk => {
          const isArmed = pending?.kind === 'skill' && pending.skillId === sk.id;
          const usesLeft = sk.usesPerMatchTunableId ? unit.usesLeft[sk.id] : undefined;
          const cooldown = sk.cooldownTunableId ? unit.cooldowns[sk.id] : undefined;
          const needsTarget = sk.targeting === 'enemy' || sk.targeting === 'ally' || sk.targeting === 'any-char' || sk.targeting === 'clone';
          const disabled = !isHumanTurn || unit.usedSkillThisTurn || (cooldown ?? 0) > 0 || (usesLeft !== undefined && usesLeft <= 0);
          return (
            <button
              key={sk.id}
              className={`skill-btn${isArmed ? ' armed' : ''}`}
              disabled={disabled}
              onClick={() => {
                if (isArmed && !needsTarget) confirmArmed();
                else armSkill(sk.id, 'skill', needsTarget);
              }}
            >
              <div className="row1">
                <span>{sk.name}</span>
                <span className="meta">
                  {cooldown !== undefined && `CD${cooldown}`}
                  {usesLeft !== undefined && ` 残${usesLeft}回`}
                </span>
              </div>
              <div className="desc">{renderTemplate(def, sk.descriptionTemplate)}</div>
              <div className="hint">{sk.activationHint}</div>
            </button>
          );
        })}
        <div className="subtitle">クイックスキル</div>
        {(() => {
          const sk = def.quickSkill;
          const isArmed = pending?.kind === 'quick';
          const usesLeft = sk.usesPerMatchTunableId ? unit.usesLeft['quick'] : undefined;
          const cooldown = sk.cooldownTunableId ? unit.cooldowns['quick'] : undefined;
          const needsTarget = sk.targeting === 'enemy' || sk.targeting === 'ally' || sk.targeting === 'any-char' || sk.targeting === 'clone';
          const disabled = !isHumanTurn || unit.usedQuickThisTurn || (cooldown ?? 0) > 0 || (usesLeft !== undefined && usesLeft <= 0);
          return (
            <button
              className={`skill-btn quick-skill-box${isArmed ? ' armed' : ''}`}
              disabled={disabled}
              onClick={() => {
                if (isArmed && !needsTarget) confirmArmed();
                else armSkill('quick', 'quick', needsTarget);
              }}
            >
              <div className="row1">
                <span>{sk.name}</span>
                <span className="meta">
                  {cooldown !== undefined && `CD${cooldown}`}
                  {usesLeft !== undefined && ` 残${usesLeft}回`}
                </span>
              </div>
              <div className="desc">{renderTemplate(def, sk.descriptionTemplate)}</div>
              <div className="hint">{sk.activationHint}</div>
            </button>
          );
        })()}
      </div>

      <div className="log-panel">
        {battle.log.map((l, i) => <div className="entry" key={i}>{l}</div>)}
      </div>

      <div className="footer-status">
        <div>
          <div><b>{unit.name}</b>（{unit.team}チーム）</div>
          <div>HP {unit.hp}/{unit.maxHp}　シールド{unit.shield}　毒{unit.poison}　攻撃力{unit.atk}</div>
        </div>
        <div className="mp">MP {unit.movePoints}/{unit.maxMovePoints}</div>
      </div>

      <Joystick
        active={isHumanTurn && battle.moveModeActive && !unit.immobileNow}
        onStep={(f) => moveStep(f)}
      />

      {battle.winner && (
        <div className="winner-banner">
          <h2>{battle.winner === 'A' ? 'Aチーム' : 'Bチーム'}の勝利！</h2>
          <p className="subtitle">勝者は大ナーフ・中ナーフ、敗者は1体のみ中アッパー。バン・ピックされたキャラも小ナーフ・小アッパーされます。</p>
          <button className="btn primary" onClick={handleFinish}>パッチノートを生成する</button>
        </div>
      )}
    </div>
  );
}
