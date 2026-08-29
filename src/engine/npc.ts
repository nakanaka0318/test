import type { BattleState } from './battleTypes';
import { chebyshevDist } from './grid';
import type { Facing } from '../types';
import { alliesOf, defOf, enemiesOf } from './battleHelpers';
import { canUseSkill, currentUnit, endTurn, tryMoveStep, performQuickSkill, performSkill } from './battleEngine';
import type { EffectCtx } from './skillEffects';

function stepFacing(from: { x: number; y: number }, to: { x: number; y: number }): Facing {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'E' : 'W';
  return dy >= 0 ? 'S' : 'N';
}

/** PvEのNPC(敵チーム)の1ターン分の行動を自動で決定・実行する簡易AI */
export function npcTakeTurn(state: BattleState) {
  const unit = currentUnit(state);
  if (!unit.isNpc || !unit.alive || state.winner) return;

  const enemies = enemiesOf(state, unit);
  const nearestEnemy = enemies.sort((a, b) => chebyshevDist(unit.pos, a.pos) - chebyshevDist(unit.pos, b.pos))[0];

  // 1. 移動: 近くの敵との距離が3以下になるまで、または移動ポイントが尽きるまで接近する
  if (nearestEnemy) {
    let guard = 0;
    while (unit.movePoints >= 10 && chebyshevDist(unit.pos, nearestEnemy.pos) > 3 && guard < 30) {
      const facing = stepFacing(unit.pos, nearestEnemy.pos);
      const moved = tryMoveStep(state, unit.uid, facing);
      if (!moved) {
        // 主軸方向が塞がっている場合、副軸方向を試す
        const alt: Facing[] = (['N', 'S', 'E', 'W'] as Facing[]).filter(f => f !== facing);
        let altMoved = false;
        for (const f of alt) {
          if (tryMoveStep(state, unit.uid, f)) { altMoved = true; break; }
        }
        if (!altMoved) break;
      }
      guard++;
    }
  }

  const def = defOf(state, unit);

  const buildCtx = (targeting: string): EffectCtx => {
    if (targeting === 'enemy') return { targetUid: nearestEnemy?.uid };
    if (targeting === 'ally') {
      const allies = alliesOf(state, unit, true).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      return { targetUid: allies[0]?.uid };
    }
    if (targeting === 'any-char') {
      if (unit.hp / unit.maxHp < 0.5) {
        const allies = alliesOf(state, unit, true).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
        return { targetUid: allies[0]?.uid ?? unit.uid };
      }
      return { targetUid: nearestEnemy?.uid };
    }
    if (targeting === 'clone') return { cloneIndex: unit.clones.length > 0 ? 0 : undefined };
    return {};
  };

  // 2. スキル使用（使用可能な最初の1つ）
  for (const skill of def.skills) {
    const check = canUseSkill(state, unit, skill.id, false);
    if (!check.ok) continue;
    performSkill(state, unit.uid, skill.id, buildCtx(skill.targeting));
    break;
  }

  // 3. クイックスキル使用
  if (!state.winner) {
    const qcheck = canUseSkill(state, unit, 'quick', true);
    if (qcheck.ok) {
      performQuickSkill(state, unit.uid, buildCtx(def.quickSkill.targeting));
    }
  }

  // 4. ターン終了
  if (!state.winner) endTurn(state);
}
