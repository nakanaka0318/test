import type { Category, CharacterDef, NerfBuffDir, NerfBuffTier, PatchLine, Tunable } from '../types';

export type TunableState = Record<string, Record<string, Tunable>>; // charId -> tunableId -> Tunable

export function cloneTunableState(characters: CharacterDef[]): TunableState {
  const state: TunableState = {};
  for (const c of characters) {
    state[c.id] = {};
    for (const [id, tu] of Object.entries(c.tunables)) {
      state[c.id][id] = { ...tu };
    }
  }
  return state;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[randInt(0, arr.length - 1)];
}

function byCategory(tunables: Record<string, Tunable>, cats: Category[]): Tunable[] {
  return Object.values(tunables).filter(t => cats.includes(t.category));
}

function applyOne(tu: Tunable, tier: NerfBuffTier, dir: NerfBuffDir): string {
  const sign = dir === 'buff' ? 1 : -1;
  const before = tu.current;
  switch (tu.category) {
    case 'hp':
    case 'move': {
      const range = tier === 'small' ? [1, 10] : tier === 'medium' ? [3, 13] : [5, 15];
      const delta = sign * randInt(range[0], range[1]);
      tu.current = Math.max(1, tu.current + delta);
      break;
    }
    case 'value': {
      const range = tier === 'small' ? [10, 20] : tier === 'medium' ? [10, 30] : [10, 40];
      const pct = randInt(range[0], range[1]);
      const delta = sign * Math.max(1, Math.round((tu.base * pct) / 100));
      tu.current = Math.max(0, tu.current + delta);
      break;
    }
    case 'usage': {
      let amount = 1;
      if (tier === 'large') amount = pick([1, 2]) ?? 1;
      tu.current = Math.max(0, tu.current + sign * amount);
      break;
    }
    case 'percent': {
      const mult = dir === 'buff' ? (tier === 'large' ? 1.4 : 1.25) : (tier === 'large' ? 0.6 : 0.75);
      tu.current = Math.max(0, Math.round(tu.current * mult));
      break;
    }
    case 'atk': {
      tu.current = tu.current + sign * 1;
      break;
    }
    case 'cooldown': {
      // クールダウンは増える=弱体化、減る=強化 のため符号が逆
      tu.current = Math.max(1, tu.current - sign * 1);
      break;
    }
  }
  const after = tu.current;
  const unit = tu.unit || '';
  return `${tu.label}: ${before}${unit} → ${after}${unit} (${after - before >= 0 ? '+' : ''}${after - before}${unit})`;
}

function bracketsFor(tier: NerfBuffTier): Category[][] {
  if (tier === 'small') return [['hp', 'move'], ['value']];
  if (tier === 'medium') return [['hp', 'move'], ['usage', 'value'], ['percent']];
  return [['hp', 'move'], ['usage', 'value'], ['percent'], ['atk', 'cooldown']];
}

export function applyNerfBuff(
  state: TunableState,
  charId: string,
  charName: string,
  tier: NerfBuffTier,
  dir: NerfBuffDir,
): PatchLine {
  const tunables = state[charId];
  const changes: string[] = [];
  for (const bracket of bracketsFor(tier)) {
    const candidates = byCategory(tunables, bracket);
    const target = pick(candidates);
    if (!target) continue; // 該当する値がないキャラは何も行われない
    changes.push(applyOne(target, tier, dir));
  }
  return { characterId: charId, characterName: charName, tier, dir, changes };
}

const TIER_LABEL: Record<NerfBuffTier, string> = { small: '小', medium: '中', large: '大' };
const DIR_LABEL: Record<NerfBuffDir, string> = { nerf: 'ナーフ', buff: 'アッパー' };

export function tierDirLabel(tier: NerfBuffTier, dir: NerfBuffDir): string {
  return `${TIER_LABEL[tier]}${DIR_LABEL[dir]}`;
}

export interface PostBattleInput {
  characters: CharacterDef[];
  winnerCharIds: string[]; // 勝ったチームの全キャラ(2体)
  loserCharIds: string[]; // 負けたチームの全キャラ(2体)
  banPickCharIds: string[]; // バン・ピックされた全キャラ(重複なし)
}

export interface PostBattleResult {
  state: TunableState;
  lines: PatchLine[];
  summary: string;
}

export function runPostBattle(state: TunableState, input: PostBattleInput): PostBattleResult {
  const nameOf = (id: string) => input.characters.find(c => c.id === id)?.name ?? id;
  const lines: PatchLine[] = [];
  const touched = new Set<string>();

  // 1. 勝者チーム: ランダム1体は大ナーフ、残りは中ナーフ
  const winners = [...input.winnerCharIds];
  const bigNerfTarget = pick(winners)!;
  for (const id of winners) {
    const tier = id === bigNerfTarget ? 'large' : 'medium';
    lines.push(applyNerfBuff(state, id, nameOf(id), tier, 'nerf'));
    touched.add(id);
  }

  // 2. 敗者チーム: ランダム1体のみ中アッパー
  const loserBuffTarget = pick(input.loserCharIds);
  if (loserBuffTarget) {
    lines.push(applyNerfBuff(state, loserBuffTarget, nameOf(loserBuffTarget), 'medium', 'buff'));
    touched.add(loserBuffTarget);
  }

  // 3. バンピックされたキャラからランダム1体ずつ小ナーフ・小アッパー
  const banPickPool = [...input.banPickCharIds];
  const smallNerfTarget = pick(banPickPool);
  if (smallNerfTarget) {
    lines.push(applyNerfBuff(state, smallNerfTarget, nameOf(smallNerfTarget), 'small', 'nerf'));
    touched.add(smallNerfTarget);
  }
  const smallBuffPool = banPickPool.filter(id => id !== smallNerfTarget);
  const smallBuffTarget = pick(smallBuffPool.length > 0 ? smallBuffPool : banPickPool);
  if (smallBuffTarget) {
    lines.push(applyNerfBuff(state, smallBuffTarget, nameOf(smallBuffTarget), 'small', 'buff'));
    touched.add(smallBuffTarget);
  }

  // 4. ナーフ・アッパーが行われていないキャラ: 2体小アッパー or 1体大アッパー
  const untouched = input.characters.map(c => c.id).filter(id => !touched.has(id));
  if (untouched.length > 0) {
    const mode = pick(['twoSmall', 'oneLarge'] as const)!;
    if (mode === 'twoSmall') {
      const shuffled = [...untouched].sort(() => Math.random() - 0.5);
      const targets = shuffled.slice(0, 2);
      for (const id of targets) {
        lines.push(applyNerfBuff(state, id, nameOf(id), 'small', 'buff'));
        touched.add(id);
      }
    } else {
      const target = pick(untouched)!;
      lines.push(applyNerfBuff(state, target, nameOf(target), 'large', 'buff'));
      touched.add(target);
    }
  }

  // パッチノートの順番はランダム
  const shuffledLines = [...lines].sort(() => Math.random() - 0.5);

  const summary = `勝者: ${input.winnerCharIds.map(nameOf).join('・')} / 敗者: ${input.loserCharIds.map(nameOf).join('・')}`;

  return { state, lines: shuffledLines, summary };
}
