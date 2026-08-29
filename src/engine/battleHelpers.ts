import type { BattleState, BattleUnit, TileType } from './battleTypes';
import { cellKey, inBounds, type Cell } from './grid';
import type { CharacterDef } from '../types';

export function log(state: BattleState, text: string) {
  state.log.push(text);
}

export function getTun(def: CharacterDef, id: string): number {
  return def.tunables[id]?.current ?? 0;
}

export function defOf(state: BattleState, unit: BattleUnit): CharacterDef {
  return state.charDefs[unit.uid];
}

export function aliveUnits(state: BattleState): BattleUnit[] {
  return state.units.filter(u => u.alive);
}

export function enemiesOf(state: BattleState, unit: BattleUnit): BattleUnit[] {
  return aliveUnits(state).filter(u => u.team !== unit.team);
}

export function alliesOf(state: BattleState, unit: BattleUnit, includeSelf = false): BattleUnit[] {
  return aliveUnits(state).filter(u => u.team === unit.team && (includeSelf || u.uid !== unit.uid));
}

export function tileAt(state: BattleState, c: Cell): TileType {
  return state.tiles[cellKey(c)] ?? 'normal';
}

export function setTile(state: BattleState, c: Cell, type: TileType) {
  if (c.x < 0 || c.y < 0 || c.x >= state.gridSize || c.y >= state.gridSize) return;
  state.tiles[cellKey(c)] = type;
}

export function unitAt(state: BattleState, c: Cell): BattleUnit | undefined {
  return aliveUnits(state).find(u => u.pos.x === c.x && u.pos.y === c.y);
}

export function effectiveAtk(unit: BattleUnit): number {
  return unit.atk + (unit.charId === 'poison' ? unit.poison : 0);
}

export function checkWin(state: BattleState) {
  if (state.winner) return;
  const aAlive = state.units.some(u => u.team === 'A' && u.alive);
  const bAlive = state.units.some(u => u.team === 'B' && u.alive);
  if (!aAlive) { state.winner = 'B'; state.phase = 'done'; log(state, '=== B チームの勝利！ ==='); }
  else if (!bAlive) { state.winner = 'A'; state.phase = 'done'; log(state, '=== A チームの勝利！ ==='); }
}

export function checkBlackTileDeath(state: BattleState, unit: BattleUnit) {
  if (!unit.alive) return;
  if (tileAt(state, unit.pos) === 'black') {
    unit.alive = false;
    unit.hp = 0;
    log(state, `${unit.name}は黒マスに触れて消滅した…`);
    checkWin(state);
  }
}

export function applyDamage(state: BattleState, target: BattleUnit, dmg: number, sourceLabel?: string) {
  if (!target.alive || dmg <= 0) return;
  let remaining = dmg;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, remaining);
    target.shield -= absorbed;
    remaining -= absorbed;
    if (absorbed > 0) log(state, `${target.name}のシールドが${absorbed}軽減した`);
  }
  if (remaining > 0) {
    target.hp = Math.max(0, target.hp - remaining);
    if (target.charId === 'fighter') {
      const gain = getTun(defOf(state, target), 'fighter.passiveAtkGain');
      target.atk += gain;
      log(state, `【野獣】${target.name}の攻撃力が+${gain}（現在${target.atk}）`);
    }
  }
  log(state, `${sourceLabel ? sourceLabel + ' → ' : ''}${target.name}に${dmg}ダメージ（残りHP${target.hp}/${target.maxHp}）`);
  if (target.hp <= 0 && target.alive) {
    target.alive = false;
    log(state, `${target.name}は倒れた！`);
    checkWin(state);
  }
}

export function applyHeal(state: BattleState, target: BattleUnit, amount: number, sourceLabel?: string) {
  if (!target.alive || amount <= 0) return;
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  log(state, `${sourceLabel ? sourceLabel + ' → ' : ''}${target.name}のHPが${amount}回復（${before}→${target.hp}）`);
}

export function applyShield(state: BattleState, target: BattleUnit, amount: number, sourceLabel?: string) {
  if (!target.alive || amount <= 0) return;
  target.shield += amount;
  log(state, `${sourceLabel ? sourceLabel + ' → ' : ''}${target.name}がシールド${amount}を獲得（現在${target.shield}）`);
}

export function dealDamageTo(
  state: BattleState,
  attacker: BattleUnit,
  target: BattleUnit,
  base: number,
  mult = 1,
  sourceLabel?: string,
) {
  if (!target.alive) return;
  let m = mult;
  const mark = target.statuses.find(s => s.id === 'hunterMark');
  if (mark) m *= 1 + (mark.value ?? 50) / 100;
  const total = Math.max(0, Math.round((base + effectiveAtk(attacker)) * m));
  applyDamage(state, target, total, sourceLabel ?? attacker.name);
  onFighterDealtDamage(state, attacker);
}

export function findAdjacentFreeCell(state: BattleState, target: Cell): Cell | null {
  const offsets = [
    { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 },
    { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 },
  ];
  for (const o of offsets) {
    const c = { x: target.x + o.x, y: target.y + o.y };
    if (inBounds(c) && !unitAt(state, c)) return c;
  }
  return null;
}

export function onFighterDealtDamage(state: BattleState, attacker: BattleUnit) {
  if (attacker.charId !== 'fighter') return;
  const shield = getTun(defOf(state, attacker), 'fighter.passiveShield');
  attacker.shield += shield;
  log(state, `【野獣】${attacker.name}がシールド${shield}を獲得（現在${attacker.shield}）`);
}

export function rollDice(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function euclideanNearestEnemy(state: BattleState, unit: BattleUnit): BattleUnit | undefined {
  const enemies = enemiesOf(state, unit);
  let best: BattleUnit | undefined;
  let bestDist = Infinity;
  for (const e of enemies) {
    const d = Math.hypot(e.pos.x - unit.pos.x, e.pos.y - unit.pos.y);
    if (d < bestDist) { bestDist = d; best = e; }
  }
  return best;
}

export function pickRandom<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}
