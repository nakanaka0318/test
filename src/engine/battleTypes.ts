import type { Cell } from './grid';
import type { CharacterDef, Facing, Team } from '../types';

export type TileType = 'normal' | 'blue' | 'red' | 'green' | 'black';

export interface StatusEffect {
  id: string; // 'hunterMark' | 'immobile' | 'dmgUpNextTurn' | 'moveLockNextTurn' ...
  label: string;
  remainingTurns: number; // このステータス保持者の残りターン数
  value?: number; // 付加数値（%など）
}

export interface BattleUnit {
  uid: string;
  charId: string;
  team: Team;
  isNpc: boolean;
  name: string;
  pos: Cell;
  facing: Facing;
  hp: number;
  maxHp: number;
  shield: number;
  movePoints: number;
  maxMovePoints: number;
  poison: number;
  atk: number; // 現在の攻撃力（基礎攻撃力+試合中の上昇分）
  cooldowns: Record<string, number>;
  usesLeft: Record<string, number>;
  statuses: StatusEffect[];
  alive: boolean;
  clones: Cell[];
  luck: number; // ギャンブラー運値
  gamblerRangeSeed: number;
  usedSkillThisTurn: boolean;
  usedQuickThisTurn: boolean;
  nextTurnImmobile: boolean;
  immobileNow: boolean;
  nextTurnDamageUpPercent: number; // ファイターどえわー用
}

export interface BattleState {
  mode: 'pvp' | 'pve';
  gridSize: number;
  tiles: Record<string, TileType>;
  units: BattleUnit[];
  charDefs: Record<string, CharacterDef>; // uid -> このバトル開始時点の現在ステータス
  turnOrder: string[]; // uid の並び
  turnIndex: number;
  turnCount: number;
  log: string[];
  phase: 'move' | 'action' | 'targeting' | 'done';
  pendingSkill: { skillId: string; kind: 'skill' | 'quick'; armed: boolean } | null;
  winner: Team | null;
  moveModeActive: boolean;
}
