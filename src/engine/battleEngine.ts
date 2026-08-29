import type { BattleState, BattleUnit } from './battleTypes';
import { CORNERS, DIR_VEC, facingToward, inBounds, lineBetween, type Cell } from './grid';
import { GRID_SIZE, MOVE_POINTS_PER_CELL } from '../data/characters';
import type { CharacterDef, Facing, Team } from '../types';
import {
  alliesOf, applyShield, checkBlackTileDeath, checkWin, defOf, euclideanNearestEnemy,
  getTun, log, rollDice, tileAt, unitAt,
} from './battleHelpers';
import { EFFECTS, type EffectCtx } from './skillEffects';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface BattleSetup {
  mode: 'pvp' | 'pve';
  teamA: CharacterDef[]; // 2体
  teamB: CharacterDef[]; // 2体
  npcTeam: Team | null; // pveの場合 'B'
  globalGreenTilePoisonAmount: number;
}

function makeUnit(def: CharacterDef, team: Team, pos: Cell, isNpc: boolean): BattleUnit {
  const hp = getTun(def, `${def.id}.hp`);
  const move = getTun(def, `${def.id}.move`);
  const atk = getTun(def, `${def.id}.atk`);
  const cooldowns: Record<string, number> = {};
  const usesLeft: Record<string, number> = {};
  for (const s of def.skills) {
    if (s.cooldownTunableId) cooldowns[s.id] = 0;
    if (s.usesPerMatchTunableId) usesLeft[s.id] = getTun(def, s.usesPerMatchTunableId);
  }
  if (def.quickSkill.cooldownTunableId) cooldowns['quick'] = 0;
  if (def.quickSkill.usesPerMatchTunableId) usesLeft['quick'] = getTun(def, def.quickSkill.usesPerMatchTunableId);
  return {
    uid: `${team}-${def.id}`,
    charId: def.id,
    team,
    isNpc,
    name: def.name,
    pos,
    facing: facingToward(pos, { x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) }),
    hp, maxHp: hp,
    shield: 0,
    movePoints: move, maxMovePoints: move,
    poison: 0,
    atk,
    cooldowns, usesLeft,
    statuses: [],
    alive: true,
    clones: [],
    luck: def.id === 'gambler' ? rollDice(100) : 0,
    gamblerRangeSeed: Math.floor(Math.random() * 1000),
    usedSkillThisTurn: false,
    usedQuickThisTurn: false,
    nextTurnImmobile: false,
    immobileNow: false,
    nextTurnDamageUpPercent: 0,
  };
}

export function createBattle(setup: BattleSetup): BattleState {
  const corners = shuffle(CORNERS);
  const charDefs: Record<string, CharacterDef> = {};
  const teamAUnits = setup.teamA.map((def, i) => {
    const u = makeUnit(def, 'A', corners[i], setup.npcTeam === 'A');
    charDefs[u.uid] = def;
    return u;
  });
  const teamBUnits = setup.teamB.map((def, i) => {
    const u = makeUnit(def, 'B', corners[i + 2], setup.npcTeam === 'B');
    charDefs[u.uid] = def;
    return u;
  });
  const units = [...teamAUnits, ...teamBUnits];
  const firstIsA = Math.random() < 0.5;
  const order = firstIsA
    ? [teamAUnits[0].uid, teamBUnits[0].uid, teamAUnits[1].uid, teamBUnits[1].uid]
    : [teamBUnits[0].uid, teamAUnits[0].uid, teamBUnits[1].uid, teamAUnits[1].uid];

  const state: BattleState = {
    mode: setup.mode,
    gridSize: GRID_SIZE,
    tiles: {},
    units,
    charDefs,
    turnOrder: order,
    turnIndex: 0,
    turnCount: 1,
    log: [],
    phase: 'action',
    pendingSkill: null,
    winner: null,
    moveModeActive: false,
  };
  (state as unknown as { globalGreenTilePoisonAmount: number }).globalGreenTilePoisonAmount = setup.globalGreenTilePoisonAmount;
  log(state, `試合開始！先攻は${units.find(u => u.uid === order[0])?.name ?? ''}`);
  startUnitTurn(state, units.find(u => u.uid === order[0])!);
  return state;
}

export function currentUnit(state: BattleState): BattleUnit {
  return state.units.find(u => u.uid === state.turnOrder[state.turnIndex])!;
}

export function startUnitTurn(state: BattleState, unit: BattleUnit) {
  if (!unit.alive) return;
  unit.shield = 0;
  unit.movePoints = unit.maxMovePoints;
  unit.usedSkillThisTurn = false;
  unit.usedQuickThisTurn = false;
  unit.immobileNow = unit.nextTurnImmobile;
  unit.nextTurnImmobile = false;
  log(state, `--- ${unit.name}（${unit.team}チーム）のターン ---`);

  if (unit.poison > 0) {
    const dmg = unit.poison;
    unit.hp = Math.max(0, unit.hp - dmg);
    unit.poison = Math.max(0, unit.poison - 1);
    log(state, `${unit.name}は毒で${dmg}ダメージ！（残りHP${unit.hp}、毒${unit.poison}）`);
    if (unit.hp <= 0) { unit.alive = false; log(state, `${unit.name}は毒に倒れた…`); checkWin(state); }
  }
  const greenAmt = (state as unknown as { globalGreenTilePoisonAmount: number }).globalGreenTilePoisonAmount ?? 5;
  if (unit.alive && tileAt(state, unit.pos) === 'green') {
    unit.poison += greenAmt;
    log(state, `${unit.name}は緑マスの毒気を吸収！毒+${greenAmt}（現在毒${unit.poison}）`);
  }
  if (unit.alive && unit.charId === 'gambler') {
    unit.luck = rollDice(100);
    log(state, `【1d100】${unit.name}の運命のダイス…出目は${unit.luck}！`);
  }
  for (const key of Object.keys(unit.cooldowns)) {
    if (unit.cooldowns[key] > 0) unit.cooldowns[key] -= 1;
  }
  unit.statuses = unit.statuses.filter(s => {
    s.remainingTurns -= 1;
    return s.remainingTurns > 0;
  });
  checkBlackTileDeath(state, unit);
  if (unit.immobileNow) log(state, `${unit.name}は移動不能状態！`);
}

function passiveEndOfTurn(state: BattleState, unit: BattleUnit) {
  if (!unit.alive) return;
  const def = defOf(state, unit);
  if (unit.charId === 'tank') {
    const r = 4;
    const inRange = state.units.filter(u => u.alive && Math.hypot(u.pos.x - unit.pos.x, u.pos.y - unit.pos.y) <= r);
    const gain = inRange.length * getTun(def, 'tank.passiveShield');
    applyShield(state, unit, gain, `${unit.name}【防御】`);
  }
  if (unit.charId === 'mage' && tileAt(state, unit.pos) === 'blue') {
    const gain = getTun(def, 'mage.passiveAtkGain');
    unit.atk += gain;
    log(state, `【魔法陣】${unit.name}の攻撃力+${gain}（現在${unit.atk}）`);
  }
  if (unit.charId === 'healer') {
    const nearest = euclideanNearestEnemy(state, unit);
    if (nearest) {
      const line = lineBetween(unit.pos, nearest.pos);
      const healAmt = getTun(def, 'healer.passiveHeal');
      for (const ally of alliesOf(state, unit, false)) {
        if (line.some(c => c.x === ally.pos.x && c.y === ally.pos.y)) {
          ally.hp = Math.min(ally.maxHp, ally.hp + healAmt);
          log(state, `【ヒーラーさんは後ろに立ちたい】${ally.name}のHPが${healAmt}回復`);
        }
      }
    }
  }
}

export function endTurn(state: BattleState) {
  if (state.phase === 'done') return;
  const unit = currentUnit(state);
  passiveEndOfTurn(state, unit);
  state.moveModeActive = false;
  state.pendingSkill = null;
  checkWin(state);
  if (state.winner) return;
  let next = state.turnIndex;
  for (let i = 0; i < state.turnOrder.length; i++) {
    next = (next + 1) % state.turnOrder.length;
    const cand = state.units.find(u => u.uid === state.turnOrder[next]);
    if (cand && cand.alive) break;
  }
  state.turnIndex = next;
  state.turnCount += 1;
  state.phase = 'action';
  startUnitTurn(state, currentUnit(state));
  checkWin(state);
}

export function tryMoveStep(state: BattleState, uid: string, facing: Facing): boolean {
  const unit = state.units.find(u => u.uid === uid);
  if (!unit || !unit.alive) return false;
  if (unit.uid !== currentUnit(state).uid) return false;
  if (unit.immobileNow) return false;
  if (unit.movePoints < MOVE_POINTS_PER_CELL) return false;
  const dir = DIR_VEC[facing];
  const dest: Cell = { x: unit.pos.x + dir.x, y: unit.pos.y + dir.y };
  if (!inBounds(dest)) return false;
  if (unitAt(state, dest)) return false;
  unit.pos = dest;
  unit.facing = facing;
  unit.movePoints -= MOVE_POINTS_PER_CELL;
  checkBlackTileDeath(state, unit);
  return true;
}

export function setFacing(state: BattleState, uid: string, facing: Facing) {
  const unit = state.units.find(u => u.uid === uid);
  if (unit) unit.facing = facing;
}

export function canUseSkill(state: BattleState, unit: BattleUnit, skillId: string, isQuick: boolean): { ok: boolean; reason?: string } {
  if (unit.uid !== currentUnit(state).uid) return { ok: false, reason: '自分のターンではありません' };
  const def = defOf(state, unit);
  if (isQuick) {
    if (unit.usedQuickThisTurn) return { ok: false, reason: 'このターンは使用済み' };
    const s = def.quickSkill;
    if (s.cooldownTunableId && (unit.cooldowns['quick'] ?? 0) > 0) return { ok: false, reason: `クールダウン中(残り${unit.cooldowns['quick']})` };
    if (s.usesPerMatchTunableId && (unit.usesLeft['quick'] ?? 0) <= 0) return { ok: false, reason: '使用回数上限' };
    return { ok: true };
  }
  if (unit.usedSkillThisTurn) return { ok: false, reason: 'このターンはスキル使用済み' };
  const s = def.skills.find(sk => sk.id === skillId);
  if (!s) return { ok: false, reason: '不明なスキル' };
  if (s.cooldownTunableId && (unit.cooldowns[skillId] ?? 0) > 0) return { ok: false, reason: `クールダウン中(残り${unit.cooldowns[skillId]})` };
  if (s.usesPerMatchTunableId && (unit.usesLeft[skillId] ?? 0) <= 0) return { ok: false, reason: '使用回数上限' };
  return { ok: true };
}

export function performSkill(state: BattleState, uid: string, skillId: string, ctx: EffectCtx) {
  const unit = state.units.find(u => u.uid === uid);
  if (!unit) return;
  const def = defOf(state, unit);
  const skill = def.skills.find(s => s.id === skillId);
  if (!skill) return;
  const check = canUseSkill(state, unit, skillId, false);
  if (!check.ok) { log(state, `${skill.name}は使用できません（${check.reason}）`); return; }

  const fn = EFFECTS[skill.effectId];
  if (fn) fn(state, unit, skill, ctx);

  if (skill.cooldownTunableId) unit.cooldowns[skillId] = getTun(def, skill.cooldownTunableId);
  if (skill.usesPerMatchTunableId) unit.usesLeft[skillId] = Math.max(0, (unit.usesLeft[skillId] ?? 1) - 1);

  checkWin(state);
  if (state.winner) { state.pendingSkill = null; return; }

  if (unit.charId === 'hero' && unit.alive) {
    const chance = getTun(def, 'hero.passivePercent');
    const roll = rollDice(100);
    if (roll <= chance) {
      log(state, `【跳ね除ける路】ダイス${roll}≦${chance}！${unit.name}はもう一度スキルを発動できる！`);
      unit.usedSkillThisTurn = false;
    } else {
      unit.usedSkillThisTurn = true;
    }
  } else {
    unit.usedSkillThisTurn = true;
  }
  state.pendingSkill = null;
}

export function performQuickSkill(state: BattleState, uid: string, ctx: EffectCtx) {
  const unit = state.units.find(u => u.uid === uid);
  if (!unit) return;
  const def = defOf(state, unit);
  const skill = def.quickSkill;
  const check = canUseSkill(state, unit, 'quick', true);
  if (!check.ok) { log(state, `${skill.name}は使用できません（${check.reason}）`); return; }

  const fn = EFFECTS[skill.effectId];
  if (fn) fn(state, unit, skill, ctx);

  if (skill.cooldownTunableId) unit.cooldowns['quick'] = getTun(def, skill.cooldownTunableId);
  if (skill.usesPerMatchTunableId) unit.usesLeft['quick'] = Math.max(0, (unit.usesLeft['quick'] ?? 1) - 1);

  checkWin(state);
  unit.usedQuickThisTurn = true;
  state.pendingSkill = null;
}
