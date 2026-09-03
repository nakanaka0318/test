/**
 * ゲーム全体のバランス定義。
 * 数値の調整はすべてこのファイルに集約する。
 */

export type EnemyKind = 'grunt' | 'runner' | 'flyer' | 'stinger' | 'brute' | 'titan';
export type TowerKind = 'gatling' | 'cannon' | 'frost' | 'tesla';
export type WeaponKind = 'rifle' | 'shotgun' | 'railgun';
export type Difficulty = 'easy' | 'normal' | 'hard';

/* ------------------------------------------------------------------ */
/* マップ                                                              */
/* ------------------------------------------------------------------ */

export const GRID_SIZE = 41; // 奇数（中央セルが存在する）
export const CELL_SIZE = 3.2;
export const MAP_EXTENT = (GRID_SIZE * CELL_SIZE) / 2;
export const PATH_HALF_WIDTH = 1; // 通路の半幅（セル数）→ 幅3セル
export const CORE_RADIUS = 4.2;
export const CORE_HEIGHT = 7.5;

/* ------------------------------------------------------------------ */
/* 難易度                                                              */
/* ------------------------------------------------------------------ */

export interface DifficultyDef {
  id: Difficulty;
  name: string;
  detail: string;
  enemyHp: number;
  enemyCount: number;
  enemySpeed: number;
  reward: number;
  coreHp: number;
  startCredits: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  easy: {
    id: 'easy',
    name: 'RECRUIT',
    detail: '敵は少なめ・資金は潤沢。操作に慣れたい人向け。',
    enemyHp: 0.8,
    enemyCount: 0.85,
    enemySpeed: 0.94,
    reward: 1.25,
    coreHp: 1600,
    startCredits: 500,
  },
  normal: {
    id: 'normal',
    name: 'SOLDIER',
    detail: '標準的な難易度。防衛と射撃の両立が求められる。',
    enemyHp: 1,
    enemyCount: 1,
    enemySpeed: 1,
    reward: 1,
    coreHp: 1200,
    startCredits: 380,
  },
  hard: {
    id: 'hard',
    name: 'VETERAN',
    detail: '大軍が押し寄せる。配置ミスが即崩壊に繋がる。',
    enemyHp: 1.35,
    enemyCount: 1.25,
    enemySpeed: 1.08,
    reward: 0.85,
    coreHp: 900,
    startCredits: 320,
  },
};

/* ------------------------------------------------------------------ */
/* プレイヤー                                                          */
/* ------------------------------------------------------------------ */

export const PLAYER = {
  maxHp: 120,
  eyeHeight: 1.72,
  radius: 0.55,
  walkSpeed: 9.2,
  sprintSpeed: 14.4,
  accel: 70,
  airAccel: 14,
  friction: 11,
  jumpSpeed: 8.4,
  gravity: 26,
  regenDelay: 5,
  regenRate: 12,
  respawnTime: 5,
  respawnCreditPenalty: 0.15,
  mouseSensitivity: 0.0022,
};

export interface WeaponDef {
  kind: WeaponKind;
  name: string;
  label: string;
  damage: number;
  pellets: number;
  spread: number; // ラジアン
  moveSpread: number;
  fireInterval: number;
  magSize: number;
  reloadTime: number;
  range: number;
  auto: boolean;
  recoil: number; // 縦反動（ラジアン）
  kick: number; // ビューモデルの後退量
  pierce: number; // 貫通体数
  critMultiplier: number;
  splash: number;
  color: number;
  tracerWidth: number;
}

export const WEAPONS: Record<WeaponKind, WeaponDef> = {
  rifle: {
    kind: 'rifle',
    name: 'VK-7 アサルトライフル',
    label: 'RIFLE',
    damage: 26,
    pellets: 1,
    spread: 0.007,
    moveSpread: 0.018,
    fireInterval: 0.093,
    magSize: 32,
    reloadTime: 1.55,
    range: 180,
    auto: true,
    recoil: 0.0105,
    kick: 0.055,
    pierce: 0,
    critMultiplier: 1.7,
    splash: 0,
    color: 0xffd27a,
    tracerWidth: 0.045,
  },
  shotgun: {
    kind: 'shotgun',
    name: 'MB-12 ブリーチャー',
    label: 'SHOTGUN',
    damage: 15,
    pellets: 10,
    spread: 0.062,
    moveSpread: 0.02,
    fireInterval: 0.72,
    magSize: 7,
    reloadTime: 2.35,
    range: 46,
    auto: false,
    recoil: 0.05,
    kick: 0.2,
    pierce: 1,
    critMultiplier: 1.4,
    splash: 0,
    color: 0xffbb66,
    tracerWidth: 0.035,
  },
  railgun: {
    kind: 'railgun',
    name: 'ARC-9 レールガン',
    label: 'RAILGUN',
    damage: 210,
    pellets: 1,
    spread: 0,
    moveSpread: 0.004,
    fireInterval: 1.35,
    magSize: 5,
    reloadTime: 2.6,
    range: 320,
    auto: false,
    recoil: 0.06,
    kick: 0.26,
    pierce: 6,
    critMultiplier: 2,
    splash: 3.2,
    color: 0x7ce9ff,
    tracerWidth: 0.11,
  },
};

export const WEAPON_ORDER: WeaponKind[] = ['rifle', 'shotgun', 'railgun'];

/* ------------------------------------------------------------------ */
/* 敵                                                                  */
/* ------------------------------------------------------------------ */

export interface EnemyRangedDef {
  damage: number;
  range: number;
  interval: number;
  speed: number;
  spread: number;
}

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  hp: number;
  speed: number;
  armor: number;
  reward: number;
  score: number;
  radius: number;
  height: number;
  flying: boolean;
  color: number;
  accent: number;
  /** コアへの攻撃 */
  coreDamage: number;
  attackInterval: number;
  attackRange: number;
  /** プレイヤーへの接触ダメージ */
  contactDamage: number;
  cost: number; // ウェーブ予算上のコスト
  ranged?: EnemyRangedDef;
  elite?: boolean;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  grunt: {
    kind: 'grunt',
    name: 'グラント',
    hp: 62,
    speed: 5.2,
    armor: 0,
    reward: 9,
    score: 10,
    radius: 0.62,
    height: 1.85,
    flying: false,
    color: 0xd8452f,
    accent: 0xff8a5c,
    coreDamage: 9,
    attackInterval: 1,
    attackRange: 3.2,
    contactDamage: 11,
    cost: 1,
  },
  runner: {
    kind: 'runner',
    name: 'ランナー',
    hp: 44,
    speed: 10.4,
    armor: 0,
    reward: 11,
    score: 14,
    radius: 0.5,
    height: 1.6,
    flying: false,
    color: 0xe8b229,
    accent: 0xfff08a,
    coreDamage: 7,
    attackInterval: 0.7,
    attackRange: 3,
    contactDamage: 9,
    cost: 1.2,
  },
  flyer: {
    kind: 'flyer',
    name: 'フライヤー',
    hp: 78,
    speed: 7.4,
    armor: 1,
    reward: 15,
    score: 20,
    radius: 0.75,
    height: 1.2,
    flying: true,
    color: 0xb44ce0,
    accent: 0xe8a8ff,
    coreDamage: 12,
    attackInterval: 1.1,
    attackRange: 5,
    contactDamage: 10,
    cost: 1.8,
  },
  stinger: {
    kind: 'stinger',
    name: 'スティンガー',
    hp: 96,
    speed: 4.6,
    armor: 2,
    reward: 18,
    score: 26,
    radius: 0.66,
    height: 1.95,
    flying: false,
    color: 0x2fa8a0,
    accent: 0x8cffe8,
    coreDamage: 11,
    attackInterval: 1.25,
    attackRange: 22,
    contactDamage: 8,
    cost: 2.2,
    ranged: { damage: 11, range: 34, interval: 1.5, speed: 42, spread: 0.035 },
  },
  brute: {
    kind: 'brute',
    name: 'ブルート',
    hp: 420,
    speed: 3.8,
    armor: 6,
    reward: 34,
    score: 55,
    radius: 1.15,
    height: 3.1,
    flying: false,
    color: 0x6a5acd,
    accent: 0xc0b6ff,
    coreDamage: 34,
    attackInterval: 1.4,
    attackRange: 4.2,
    contactDamage: 22,
    cost: 4.5,
    elite: true,
  },
  titan: {
    kind: 'titan',
    name: 'タイタン',
    hp: 3400,
    speed: 3.0,
    armor: 12,
    reward: 320,
    score: 500,
    radius: 2.4,
    height: 6.2,
    flying: false,
    color: 0xff3b30,
    accent: 0xffd166,
    coreDamage: 95,
    attackInterval: 1.7,
    attackRange: 6.5,
    contactDamage: 40,
    cost: 22,
    elite: true,
    ranged: { damage: 24, range: 40, interval: 2.4, speed: 34, spread: 0.05 },
  },
};

/* ------------------------------------------------------------------ */
/* タワー                                                              */
/* ------------------------------------------------------------------ */

export interface TowerLevelDef {
  damage: number;
  range: number;
  fireInterval: number;
  /** cannon: 爆発半径 / frost: 減速率 / tesla: 連鎖数 */
  special: number;
}

export interface TowerDef {
  kind: TowerKind;
  name: string;
  label: string;
  desc: string;
  hotkey: string;
  cost: number;
  upgradeCost: number[]; // Lv2, Lv3 へのコスト
  sellRatio: number;
  targetsAir: boolean;
  projectileSpeed: number;
  color: number;
  accent: number;
  levels: TowerLevelDef[];
}

export const TOWERS: Record<TowerKind, TowerDef> = {
  gatling: {
    kind: 'gatling',
    name: 'ガトリング砲',
    label: 'GATLING',
    desc: '高速連射で単体を削る基本タワー。対空可。',
    hotkey: '1',
    cost: 80,
    upgradeCost: [95, 175],
    sellRatio: 0.6,
    targetsAir: true,
    projectileSpeed: 130,
    color: 0x4aa3ff,
    accent: 0xa8dcff,
    levels: [
      { damage: 10, range: 20, fireInterval: 0.12, special: 0 },
      { damage: 16, range: 23, fireInterval: 0.105, special: 0 },
      { damage: 25, range: 26, fireInterval: 0.088, special: 0 },
    ],
  },
  cannon: {
    kind: 'cannon',
    name: 'キャノン砲',
    label: 'CANNON',
    desc: '着弾点に範囲ダメージ。密集した地上敵に強い。',
    hotkey: '2',
    cost: 145,
    upgradeCost: [150, 260],
    sellRatio: 0.6,
    targetsAir: false,
    projectileSpeed: 52,
    color: 0xff8c42,
    accent: 0xffd6a5,
    levels: [
      { damage: 58, range: 24, fireInterval: 1.5, special: 4.6 },
      { damage: 92, range: 27, fireInterval: 1.35, special: 5.4 },
      { damage: 148, range: 30, fireInterval: 1.2, special: 6.4 },
    ],
  },
  frost: {
    kind: 'frost',
    name: 'フロストビーム',
    label: 'FROST',
    desc: '照射した敵を減速させ続ける。単体火力は低い。',
    hotkey: '3',
    cost: 115,
    upgradeCost: [110, 190],
    sellRatio: 0.6,
    targetsAir: true,
    projectileSpeed: 0,
    color: 0x59e0ff,
    accent: 0xd6f7ff,
    levels: [
      { damage: 15, range: 18, fireInterval: 0.1, special: 0.42 },
      { damage: 24, range: 21, fireInterval: 0.1, special: 0.52 },
      { damage: 38, range: 24, fireInterval: 0.1, special: 0.62 },
    ],
  },
  tesla: {
    kind: 'tesla',
    name: 'テスラコイル',
    label: 'TESLA',
    desc: '雷撃が敵から敵へ連鎖する。群れの処理に最適。',
    hotkey: '4',
    cost: 210,
    upgradeCost: [200, 330],
    sellRatio: 0.6,
    targetsAir: true,
    projectileSpeed: 0,
    color: 0xc36bff,
    accent: 0xf0d4ff,
    levels: [
      { damage: 44, range: 19, fireInterval: 1.1, special: 4 },
      { damage: 66, range: 21, fireInterval: 0.95, special: 5 },
      { damage: 100, range: 24, fireInterval: 0.85, special: 7 },
    ],
  },
};

export const TOWER_ORDER: TowerKind[] = ['gatling', 'cannon', 'frost', 'tesla'];

/* ------------------------------------------------------------------ */
/* コア／経済                                                          */
/* ------------------------------------------------------------------ */

export const ECONOMY = {
  waveClearBase: 45,
  waveClearPerWave: 14,
  skipBonusPerSecond: 4,
  repairCost: 90,
  repairAmount: 140,
  killAssistShare: 1,
};

export const CORE = {
  overloadDamageRadius: 0,
};

/* ------------------------------------------------------------------ */
/* ウェーブ                                                            */
/* ------------------------------------------------------------------ */

export const TOTAL_WAVES = 20;
export const PREP_TIME_FIRST = 25;
export const PREP_TIME = 13;

export interface SpawnGroup {
  kind: EnemyKind;
  count: number;
  gate: number;
  delay: number;
  interval: number;
}

export interface WaveDef {
  index: number;
  groups: SpawnGroup[];
  total: number;
  hpScale: number;
  boss: boolean;
  headline: string;
}

/** 決定論的な擬似乱数（ウェーブ構成を毎回同じにする） */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const UNLOCK: Record<EnemyKind, number> = {
  grunt: 1,
  runner: 3,
  flyer: 5,
  stinger: 7,
  brute: 9,
  titan: 99,
};

export function buildWaves(difficulty: Difficulty): WaveDef[] {
  const diff = DIFFICULTIES[difficulty];
  const rand = lcg(0x5eed1234);
  const waves: WaveDef[] = [];

  for (let w = 1; w <= TOTAL_WAVES; w++) {
    const boss = w % 5 === 0;
    const gates = w <= 2 ? 1 : w <= 5 ? 2 : w <= 10 ? 3 : 4;
    let budget = (7 + w * 4.2 + Math.pow(w, 1.72)) * diff.enemyCount;
    const pool = (Object.keys(UNLOCK) as EnemyKind[]).filter(
      (k) => k !== 'titan' && UNLOCK[k] <= w,
    );
    const groups: SpawnGroup[] = [];
    let total = 0;

    if (boss) {
      const titans = w >= 20 ? 3 : w >= 15 ? 2 : 1;
      for (let i = 0; i < titans; i++) {
        groups.push({
          kind: 'titan',
          count: 1,
          gate: Math.floor(rand() * gates),
          delay: 4 + i * 9,
          interval: 1,
        });
        total += 1;
      }
      budget *= 0.72;
    }

    let guard = 0;
    while (budget > 0 && guard++ < 64) {
      const kind = pool[Math.floor(rand() * pool.length)];
      const def = ENEMIES[kind];
      const maxCount = Math.max(1, Math.floor(budget / def.cost));
      const count = Math.max(1, Math.min(maxCount, 3 + Math.floor(rand() * (4 + w * 0.6))));
      budget -= count * def.cost;
      groups.push({
        kind,
        count,
        gate: Math.floor(rand() * gates),
        delay: rand() * (5 + w * 0.9),
        interval: 0.34 + rand() * 0.5,
      });
      total += count;
    }

    groups.sort((a, b) => a.delay - b.delay);

    waves.push({
      index: w,
      groups,
      total,
      hpScale: (1 + (w - 1) * 0.135) * diff.enemyHp,
      boss,
      headline: boss ? 'タイタン級を確認' : gates >= 4 ? '全ゲートから侵攻' : `${gates}方向から侵攻`,
    });
  }
  return waves;
}
