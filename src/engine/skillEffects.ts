import type { BattleState, BattleUnit } from './battleTypes';
import { cellsForShape, chebyshevDist, euclidDist, type Cell } from './grid';
import { GRID_SIZE } from '../data/characters';
import type { SkillDef } from '../types';
import {
  alliesOf, applyHeal, applyShield, checkBlackTileDeath, dealDamageTo, defOf,
  enemiesOf, findAdjacentFreeCell, getTun, log, pickRandom, rollDice, setTile, tileAt, unitAt,
} from './battleHelpers';

export interface EffectCtx {
  targetUid?: string;
  targetCell?: Cell;
  cloneIndex?: number;
}

type EffectFn = (state: BattleState, unit: BattleUnit, skill: SkillDef, ctx: EffectCtx) => void;

function findByUid(state: BattleState, uid?: string): BattleUnit | undefined {
  return uid ? state.units.find(u => u.uid === uid && u.alive) : undefined;
}

function farthestEnemy(state: BattleState, unit: BattleUnit): BattleUnit | undefined {
  const enemies = enemiesOf(state, unit);
  let best: BattleUnit | undefined;
  let bestDist = -1;
  for (const e of enemies) {
    const d = euclidDist(unit.pos, e.pos);
    if (d > bestDist) { bestDist = d; best = e; }
  }
  return best;
}

function archerPassiveMult(state: BattleState, archer: BattleUnit, target: BattleUnit): number {
  const def = defOf(state, archer);
  const dist = chebyshevDist(archer.pos, target.pos);
  if (dist > 20) return getTun(def, 'archer.passiveFar') / 100;
  if (dist > 10) return getTun(def, 'archer.passiveNear') / 100;
  return 1;
}

function magePassiveMult(state: BattleState, mage: BattleUnit): number {
  const def = defOf(state, mage);
  if (tileAt(state, mage.pos) === 'blue') return 1 + getTun(def, 'mage.passivePercent') / 100;
  return 1;
}

function consumeFighterBuff(unit: BattleUnit): number {
  if (unit.nextTurnDamageUpPercent > 0) {
    const m = 1 + unit.nextTurnDamageUpPercent / 100;
    unit.nextTurnDamageUpPercent = 0;
    return m;
  }
  return 1;
}

function addStatus(unit: BattleUnit, id: string, label: string, remainingTurns: number, value?: number) {
  unit.statuses = unit.statuses.filter(s => s.id !== id);
  unit.statuses.push({ id, label, remainingTurns, value });
}

// ---------------- 勇者 ----------------
const hero_s1: EffectFn = (state, unit, skill) => {
  const def = defOf(state, unit);
  const dmgBase = getTun(def, 's1.dmg');
  const cells = cellsForShape(unit.pos, unit.facing, skill.range!);
  const targets = cells.map(c => unitAt(state, c)).filter((u): u is BattleUnit => !!u && u.team !== unit.team);
  log(state, `${unit.name}のブレイブスラッシュ！対象${targets.length}体`);
  for (const t of targets) dealDamageTo(state, unit, t, dmgBase);
};
const hero_s2: EffectFn = (state, unit) => {
  const def = defOf(state, unit);
  const shieldVal = getTun(def, 's2.shield');
  log(state, `${unit.name}の英雄の加護！味方全員にシールド付与`);
  for (const a of alliesOf(state, unit, true)) applyShield(state, a, shieldVal, unit.name);
};
const hero_s3: EffectFn = (state, unit, skill) => {
  const def = defOf(state, unit);
  const dmgBase = getTun(def, 's3.dmg');
  const cells = cellsForShape(unit.pos, unit.facing, skill.range!);
  const targets = cells.map(c => unitAt(state, c)).filter((u): u is BattleUnit => !!u && u.team !== unit.team);
  log(state, `${unit.name}の天地鳴動！大地が揺れる…対象${targets.length}体`);
  for (const t of targets) dealDamageTo(state, unit, t, dmgBase);
};
const hero_quick: EffectFn = (state, unit, _skill, ctx) => {
  const target = findByUid(state, ctx.targetUid);
  if (!target) return;
  const def = defOf(state, unit);
  const cell = findAdjacentFreeCell(state, target.pos);
  if (cell) { unit.pos = cell; checkBlackTileDeath(state, unit); }
  if (target.team !== unit.team) {
    log(state, `${unit.name}のテレポートスラッシュ！${target.name}の側面へ！`);
    dealDamageTo(state, unit, target, getTun(def, 'quick.dmg'));
  } else {
    log(state, `${unit.name}が${target.name}のもとへ！`);
    applyShield(state, target, getTun(def, 'quick.shield'), unit.name);
  }
};

// ---------------- タンク ----------------
const tank_s1: EffectFn = (state, unit, skill) => {
  const def = defOf(state, unit);
  const cells = cellsForShape(unit.pos, unit.facing, skill.range!);
  const enemies = cells.map(c => unitAt(state, c)).filter((u): u is BattleUnit => !!u && u.team !== unit.team);
  const allies = cells.map(c => unitAt(state, c)).filter((u): u is BattleUnit => !!u && u.team === unit.team);
  log(state, `${unit.name}の盤石！`);
  for (const e of enemies) dealDamageTo(state, unit, e, getTun(def, 's1.dmg'));
  for (const a of allies) applyShield(state, a, getTun(def, 's1.shield'), unit.name);
};
const tank_s2: EffectFn = (state, unit, skill) => {
  const def = defOf(state, unit);
  const advance = getTun(def, 's2.advance');
  const dir = { N: { x: 0, y: -1 }, S: { x: 0, y: 1 }, E: { x: 1, y: 0 }, W: { x: -1, y: 0 } }[unit.facing];
  let nx = unit.pos.x, ny = unit.pos.y;
  for (let i = 0; i < advance; i++) {
    const cx = nx + dir.x, cy = ny + dir.y;
    if (cx < 0 || cy < 0 || cx >= GRID_SIZE || cy >= GRID_SIZE) break;
    nx = cx; ny = cy;
  }
  unit.pos = { x: nx, y: ny };
  checkBlackTileDeath(state, unit);
  log(state, `${unit.name}の突破！前方${advance}マス突進！`);
  const cells = cellsForShape(unit.pos, unit.facing, skill.range!);
  const enemies = cells.map(c => unitAt(state, c)).filter((u): u is BattleUnit => !!u && u.team !== unit.team);
  for (const e of enemies) dealDamageTo(state, unit, e, getTun(def, 's2.dmg'));
};
const tank_s3: EffectFn = (state, unit) => {
  const def = defOf(state, unit);
  applyShield(state, unit, getTun(def, 's3.shield'), unit.name);
  log(state, `${unit.name}は防禦の構え！`);
};
const tank_quick: EffectFn = (state, unit, _skill, ctx) => {
  const target = findByUid(state, ctx.targetUid);
  if (!target) return;
  const def = defOf(state, unit);
  const cell = findAdjacentFreeCell(state, target.pos);
  if (cell) { unit.pos = cell; checkBlackTileDeath(state, unit); }
  applyShield(state, target, getTun(def, 'quick.shield'), unit.name);
  log(state, `${unit.name}が飛び込んで壁になった！`);
};

// ---------------- アーチャー ----------------
const archer_s1: EffectFn = (state, unit, skill) => {
  const def = defOf(state, unit);
  const cells = cellsForShape(unit.pos, unit.facing, skill.range!);
  const targets = cells.map(c => unitAt(state, c)).filter((u): u is BattleUnit => !!u);
  log(state, `${unit.name}のクレッセントアロー！対象${targets.length}体`);
  for (const t of targets) dealDamageTo(state, unit, t, getTun(def, 's1.dmg'), archerPassiveMult(state, unit, t));
};
const archer_s2: EffectFn = (state, unit) => {
  const def = defOf(state, unit);
  const target = farthestEnemy(state, unit);
  if (!target) return;
  addStatus(target, 'hunterMark', 'ハンターマーク', 3, getTun(def, 's2.percent'));
  log(state, `${unit.name}のハンターマーク！${target.name}に狙いを定めた（被ダメージ+${getTun(def, 's2.percent')}%・3ターン）`);
};
const archer_s3: EffectFn = (state, unit, skill) => {
  const def = defOf(state, unit);
  const cells = cellsForShape(unit.pos, unit.facing, skill.range!);
  const targets = cells.map(c => unitAt(state, c)).filter((u): u is BattleUnit => !!u && u.team !== unit.team);
  for (const t of targets) {
    dealDamageTo(state, unit, t, getTun(def, 's3.dmg'), archerPassiveMult(state, unit, t));
    t.nextTurnImmobile = true;
  }
  const recover = getTun(def, 's3.moveRecover');
  unit.movePoints = Math.min(unit.maxMovePoints, unit.movePoints + recover);
  log(state, `${unit.name}のバックショット！移動ポイント+${recover}`);
};
const archer_quick: EffectFn = (state, unit) => {
  const def = defOf(state, unit);
  unit.movePoints = getTun(def, 'quick.moveSet');
  log(state, `${unit.name}のフリームーブ！移動ポイントが${unit.movePoints}に！`);
};

// ---------------- メイジ ----------------
const mage_s1: EffectFn = (state, unit, _skill, ctx) => {
  const target = findByUid(state, ctx.targetUid);
  if (!target) return;
  const def = defOf(state, unit);
  dealDamageTo(state, unit, target, getTun(def, 's1.dmg'), magePassiveMult(state, unit));
  unit.atk += getTun(def, 's1.atkGain');
  log(state, `${unit.name}のマジックショット！攻撃力+${getTun(def, 's1.atkGain')}（現在${unit.atk}）`);
};
const mage_s2: EffectFn = (state, unit, skill) => {
  const cells = cellsForShape(unit.pos, unit.facing, skill.range!);
  for (const c of cells) setTile(state, c, 'blue');
  log(state, `${unit.name}の魔法陣召喚！足元に青ブロック展開`);
};
const mage_s3: EffectFn = (state, unit, skill) => {
  const def = defOf(state, unit);
  const cells = cellsForShape(unit.pos, unit.facing, skill.range!);
  const targets = cells.map(c => unitAt(state, c)).filter((u): u is BattleUnit => !!u && u.team !== unit.team);
  log(state, `${unit.name}のエクスプロージョン！対象${targets.length}体`);
  const mult = magePassiveMult(state, unit);
  for (const t of targets) dealDamageTo(state, unit, t, getTun(def, 's3.dmg'), mult);
};
const mage_quick: EffectFn = (state, unit, _skill, ctx) => {
  const target = findByUid(state, ctx.targetUid);
  if (!target) return;
  const tmp = unit.pos;
  unit.pos = target.pos;
  target.pos = tmp;
  log(state, `${unit.name}と${target.name}が位置を交換した！`);
  checkBlackTileDeath(state, unit);
  checkBlackTileDeath(state, target);
};

// ---------------- ファイター ----------------
const fighter_s1: EffectFn = (state, unit, skill) => {
  const def = defOf(state, unit);
  const mult = consumeFighterBuff(unit);
  const cells = cellsForShape(unit.pos, unit.facing, skill.range!);
  const targets = cells.map(c => unitAt(state, c)).filter((u): u is BattleUnit => !!u && u.team !== unit.team);
  log(state, `${unit.name}の「おらあ！」対象${targets.length}体`);
  for (const t of targets) dealDamageTo(state, unit, t, getTun(def, 's1.dmg'), mult);
  for (const c of cells) {
    const cur = tileAt(state, c);
    if (cur === 'normal') setTile(state, c, 'red');
    else if (cur === 'red') { setTile(state, c, 'black'); log(state, '地面が黒く染まっていく…'); }
  }
  for (const c of cells) { const u = unitAt(state, c); if (u) checkBlackTileDeath(state, u); }
};
const fighter_s2: EffectFn = (state, unit, skill) => {
  const def = defOf(state, unit);
  const mult = consumeFighterBuff(unit);
  const cells = cellsForShape(unit.pos, unit.facing, skill.range!);
  const targets = cells.map(c => unitAt(state, c)).filter((u): u is BattleUnit => !!u && u.team !== unit.team);
  log(state, `${unit.name}の「すわー！」対象${targets.length}体`);
  for (const t of targets) { dealDamageTo(state, unit, t, getTun(def, 's2.dmg'), mult); t.nextTurnImmobile = true; }
};
const fighter_s3: EffectFn = (state, unit) => {
  const def = defOf(state, unit);
  const cost = getTun(def, 's3.hpCost');
  unit.hp = Math.max(0, unit.hp - cost);
  unit.atk += getTun(def, 'fighter.passiveAtkGain');
  unit.nextTurnDamageUpPercent = getTun(def, 's3.dmgUpPercent');
  log(state, `${unit.name}の「どえわー！」HP-${cost}、次の攻撃ダメージ+${unit.nextTurnDamageUpPercent}%！`);
  if (unit.hp <= 0) { unit.alive = false; log(state, `${unit.name}は力尽きた…`); }
};
const fighter_quick: EffectFn = (state, unit) => {
  const def = defOf(state, unit);
  const cost = getTun(def, 'quick.hpCost');
  unit.hp = Math.max(0, unit.hp - cost);
  unit.atk += getTun(def, 'fighter.passiveAtkGain');
  unit.shield += getTun(def, 'quick.shieldGain');
  unit.nextTurnImmobile = false;
  unit.immobileNow = false;
  log(state, `${unit.name}の「おおん！」HP-${cost}、シールド+${getTun(def, 'quick.shieldGain')}、拘束解除！`);
  if (unit.hp <= 0) { unit.alive = false; log(state, `${unit.name}は力尽きた…`); }
};

// ---------------- アサシン ----------------
const assassin_s1: EffectFn = (state, unit, skill) => {
  const def = defOf(state, unit);
  const origins = [unit.pos, ...unit.clones];
  let count = 0;
  for (const origin of origins) {
    const cells = cellsForShape(origin, unit.facing, skill.range!);
    const targets = cells.map(c => unitAt(state, c)).filter((u): u is BattleUnit => !!u && u.team !== unit.team);
    for (const t of targets) { dealDamageTo(state, unit, t, getTun(def, 's1.dmg')); count++; }
  }
  log(state, `${unit.name}の斬技！（分身含め${origins.length}箇所から発動、命中${count}件）`);
};
const assassin_s2: EffectFn = (state, unit) => {
  const def = defOf(state, unit);
  const target = farthestEnemy(state, unit);
  if (!target) return;
  const cell = findAdjacentFreeCell(state, target.pos);
  if (cell) { unit.pos = cell; checkBlackTileDeath(state, unit); }
  log(state, `${unit.name}のプラチナスター！${target.name}の目の前へ瞬間移動！`);
  dealDamageTo(state, unit, target, getTun(def, 's2.dmg'));
};
const assassin_s3: EffectFn = (state, unit, skill) => {
  const def = defOf(state, unit);
  const origins = [unit.pos, ...unit.clones];
  const hitSet = new Map<string, BattleUnit>();
  for (const origin of origins) {
    const cells = cellsForShape(origin, unit.facing, skill.range!);
    for (const c of cells) {
      const u = unitAt(state, c);
      if (u && u.team !== unit.team) { dealDamageTo(state, unit, u, getTun(def, 's3.dmgAoe')); hitSet.set(u.uid, u); }
    }
  }
  const allyCloneCount = alliesOf(state, unit, true).length + unit.clones.length;
  const nearest = [...hitSet.values()].sort((a, b) => euclidDist(unit.pos, a.pos) - euclidDist(unit.pos, b.pos))[0];
  if (nearest) {
    const bonus = allyCloneCount * getTun(def, 's3.dmgPerAlly');
    log(state, `${unit.name}のスキルビート！追加ダメージ係数×${allyCloneCount}`);
    dealDamageTo(state, unit, nearest, bonus);
  }
};
const assassin_s4: EffectFn = (state, unit, _skill, ctx) => {
  if (ctx.cloneIndex === undefined || !unit.clones[ctx.cloneIndex]) return;
  const def = defOf(state, unit);
  const clonePos = unit.clones[ctx.cloneIndex];
  unit.pos = clonePos;
  unit.clones = unit.clones.filter((_, i) => i !== ctx.cloneIndex);
  applyHeal(state, unit, getTun(def, 's4.heal'), unit.name);
  checkBlackTileDeath(state, unit);
  log(state, `${unit.name}が分身の場所へ移動し、分身を破壊した！`);
};
const assassin_quick: EffectFn = (state, unit) => {
  if (unit.clones.length >= 3) { log(state, `${unit.name}の分身はすでに3体展開中！`); return; }
  unit.clones.push({ ...unit.pos });
  log(state, `${unit.name}が分身を召喚した！（現在${unit.clones.length}体）`);
};

// ---------------- ヒーラー ----------------
const healer_s1: EffectFn = (state, unit, _skill, ctx) => {
  const target = findByUid(state, ctx.targetUid);
  if (!target) return;
  const def = defOf(state, unit);
  dealDamageTo(state, unit, target, getTun(def, 's1.dmg'));
  const healAmt = getTun(def, 's1.healAll');
  for (const a of alliesOf(state, unit, true)) applyHeal(state, a, healAmt, unit.name);
  log(state, `${unit.name}の「攻撃して回復したい」！`);
};
const healer_s2: EffectFn = (state, unit, _skill, ctx) => {
  const target = findByUid(state, ctx.targetUid) ?? unit;
  const def = defOf(state, unit);
  applyHeal(state, target, getTun(def, 's2.heal'), unit.name);
  target.atk += getTun(def, 's2.atkGain');
  log(state, `${unit.name}の「強く生きたい」！${target.name}の攻撃力+${getTun(def, 's2.atkGain')}`);
};
const healer_s3: EffectFn = (state, unit, _skill, ctx) => {
  const target = findByUid(state, ctx.targetUid);
  const def = defOf(state, unit);
  if (target) {
    target.pos = { ...unit.pos };
    checkBlackTileDeath(state, target);
    log(state, `${unit.name}の「奇跡を起こしたい」！${target.name}を自分の場所へ！`);
  }
  const dmgAoe = getTun(def, 's3.dmgAoe');
  for (const e of enemiesOf(state, unit)) dealDamageTo(state, unit, e, dmgAoe);
};
const healer_quick: EffectFn = (state, unit, _skill, ctx) => {
  const target = findByUid(state, ctx.targetUid);
  if (!target) return;
  if (target.team !== unit.team) {
    target.nextTurnImmobile = true;
    log(state, `${unit.name}の警戒付与！${target.name}は次のターン動けない`);
  } else {
    target.nextTurnImmobile = false;
    target.immobileNow = false;
    log(state, `${unit.name}の警戒付与！${target.name}の拘束を解除`);
  }
};

// ---------------- ポイズン ----------------
const poison_s1: EffectFn = (state, unit, _skill, ctx) => {
  const target = findByUid(state, ctx.targetUid);
  if (!target) return;
  const def = defOf(state, unit);
  const stack = getTun(def, 's1.poison');
  target.poison += stack;
  log(state, `${unit.name}のポイズンクラスター！${target.name}に毒${stack}（現在毒${target.poison}）`);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) setTile(state, { x: target.pos.x + dx, y: target.pos.y + dy }, 'green');
};
const poison_s2: EffectFn = (state, unit, skill) => {
  const def = defOf(state, unit);
  const cells = cellsForShape(unit.pos, unit.facing, skill.range!);
  const targets = cells.map(c => unitAt(state, c)).filter((u): u is BattleUnit => !!u && u.team !== unit.team);
  log(state, `${unit.name}のポイズンビン！対象${targets.length}体`);
  for (const t of targets) dealDamageTo(state, unit, t, getTun(def, 's2.dmg'));
  for (const c of cells) setTile(state, c, 'green');
};
const poison_s3: EffectFn = (state, unit) => {
  const def = defOf(state, unit);
  const heal = unit.poison * getTun(def, 's3.healMultiplier');
  applyHeal(state, unit, heal, `${unit.name}の血清`);
  log(state, `${unit.name}の毒(${unit.poison})を解除した`);
  unit.poison = 0;
};
const poison_quick: EffectFn = (state, unit, _skill, ctx) => {
  const target = findByUid(state, ctx.targetUid);
  if (!target) return;
  unit.poison += target.poison;
  log(state, `${unit.name}の毒写！${target.name}の毒${target.poison}を自身へ（現在毒${unit.poison}）`);
  target.poison = 0;
};

// ---------------- ギャンブラー ----------------
function gambler_s1_impl(state: BattleState, unit: BattleUnit, skill: SkillDef, depth: number) {
  const def = defOf(state, unit);
  const seed = unit.gamblerRangeSeed;
  const offset = { x: ((seed * 37) % 11) - 5, y: ((seed * 53) % 11) - 5 };
  const center = {
    x: Math.max(0, Math.min(GRID_SIZE - 1, unit.pos.x + offset.x)),
    y: Math.max(0, Math.min(GRID_SIZE - 1, unit.pos.y + offset.y)),
  };
  const cells = cellsForShape(unit.pos, unit.facing, skill.range!, center);
  const targets = cells.map(c => unitAt(state, c)).filter((u): u is BattleUnit => !!u && u.team !== unit.team);
  log(state, `【ダイス目${unit.luck}】${unit.name}のDestiny！範囲(${center.x},${center.y})中心 対象${targets.length}体`);
  for (const t of targets) dealDamageTo(state, unit, t, getTun(def, 's1.dmg'));
  if (depth >= 5) { log(state, 'Destinyの連鎖が収まった…'); return; }
  const roll = rollDice(100);
  if (roll <= unit.luck) {
    unit.luck = Math.max(0, unit.luck - getTun(def, 's1.luckDrop'));
    unit.atk += getTun(def, 's1.atkGain');
    unit.gamblerRangeSeed += 1;
    log(state, `【ダイス${roll}≦運値】Destiny再発動！運値${unit.luck}・攻撃力+${getTun(def, 's1.atkGain')}`);
    gambler_s1_impl(state, unit, skill, depth + 1);
  } else {
    log(state, `【ダイス${roll}>運値】Destinyの連鎖は途切れた`);
  }
}
const gambler_s1: EffectFn = (state, unit, skill) => gambler_s1_impl(state, unit, skill, 0);

const gambler_s2: EffectFn = (state, unit) => {
  const roll = rollDice(100);
  log(state, `【ダイス${roll} / 運値${unit.luck}】${unit.name}のProvidence…`);
  if (roll <= unit.luck) {
    unit.hp = unit.maxHp;
    log(state, `成功！${unit.name}のHPが全回復した！`);
  } else {
    unit.alive = false;
    unit.hp = 0;
    log(state, `失敗…${unit.name}は運命に見放され倒れた…`);
  }
};

const gambler_s3: EffectFn = (state, unit) => {
  const def = defOf(state, unit);
  const roll = rollDice(100);
  log(state, `【ダイス${roll} / 運値${unit.luck}】${unit.name}のRandom Fortune…`);
  const success = roll <= unit.luck;
  const pool = success ? alliesOf(state, unit, true) : enemiesOf(state, unit);
  const target = pickRandom(pool);
  if (!target) return;
  for (const key of Object.keys(target.cooldowns)) target.cooldowns[key] = 0;
  target.atk += getTun(def, 's3.atkGain');
  applyHeal(state, target, getTun(def, 's3.hpHeal'), 'Random Fortune');
  log(state, `${success ? '成功' : '失敗し敵に幸運が！'}：${target.name}のクールダウン全復活・攻撃力+${getTun(def, 's3.atkGain')}`);
};

const gambler_quick: EffectFn = (state, unit) => {
  unit.luck = rollDice(100);
  unit.gamblerRangeSeed += 7;
  log(state, `【ダイスロール】${unit.name}が振り直し…新しい運値は${unit.luck}！`);
};

export const EFFECTS: Record<string, EffectFn> = {
  'hero.s1': hero_s1, 'hero.s2': hero_s2, 'hero.s3': hero_s3, 'hero.quick': hero_quick,
  'tank.s1': tank_s1, 'tank.s2': tank_s2, 'tank.s3': tank_s3, 'tank.quick': tank_quick,
  'archer.s1': archer_s1, 'archer.s2': archer_s2, 'archer.s3': archer_s3, 'archer.quick': archer_quick,
  'mage.s1': mage_s1, 'mage.s2': mage_s2, 'mage.s3': mage_s3, 'mage.quick': mage_quick,
  'fighter.s1': fighter_s1, 'fighter.s2': fighter_s2, 'fighter.s3': fighter_s3, 'fighter.quick': fighter_quick,
  'assassin.s1': assassin_s1, 'assassin.s2': assassin_s2, 'assassin.s3': assassin_s3, 'assassin.s4': assassin_s4, 'assassin.quick': assassin_quick,
  'healer.s1': healer_s1, 'healer.s2': healer_s2, 'healer.s3': healer_s3, 'healer.quick': healer_quick,
  'poison.s1': poison_s1, 'poison.s2': poison_s2, 'poison.s3': poison_s3, 'poison.quick': poison_quick,
  'gambler.s1': gambler_s1, 'gambler.s2': gambler_s2, 'gambler.s3': gambler_s3, 'gambler.quick': gambler_quick,
};
