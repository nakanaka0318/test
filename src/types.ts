// 汎用の型定義。ナーフ/アッパーの対象となる数値は Tunable として保持し、
// base(初期値)とcurrent(現在値)を分離して管理する。

export type Category =
  | 'hp'        // hp
  | 'move'      // 移動ポイント
  | 'value'     // ダメージ/シールド/毒/距離などの効果量
  | 'usage'     // 1試合の使用回数
  | 'percent'   // %表記のもの
  | 'atk'       // 攻撃力(基礎値)
  | 'cooldown'; // クールダウン

export interface Tunable {
  id: string;
  label: string;
  category: Category;
  base: number;
  current: number;
  unit: '' | '%' | '回' | 'ターン';
}

export type Team = 'A' | 'B';
export type Facing = 'N' | 'E' | 'S' | 'W';
export type RangeShapeKind = 'circle' | 'square' | 'rect' | 'line' | 'fan' | 'self' | 'none';

export interface RangeShape {
  kind: RangeShapeKind;
  // circle/fan use radius, square uses size(半径), rect uses w/h(向いてる方向に対して)
  radius?: number;
  size?: number;
  w?: number;
  h?: number;
  angleDeg?: number; // 扇形の開き角度
  facingAware: boolean;
  originatesFromSelf: boolean; // 自分中心か、選択セル中心か
}

export type Targeting =
  | 'self'
  | 'ally'
  | 'enemy'
  | 'any-char'
  | 'aoe-self'      // 自分中心の範囲、対象選択不要 → ダブルタップ発動
  | 'aoe-farthest'   // 一番遠い敵など自動選択
  | 'clone'         // 分身選択
  | 'tile';         // マス選択

export interface SkillDef {
  id: string;
  name: string;
  kind: 'skill' | 'quick';
  descriptionTemplate: string; // {{tunableId}} を埋め込みで置換
  cooldownTunableId?: string;
  usesPerMatchTunableId?: string;
  targeting: Targeting;
  activationHint: string;
  range?: RangeShape;
  effectId: string; // engine/skillEffects.ts 内の実装キー
}

export interface CharacterDef {
  id: string;
  name: string;
  passiveName: string;
  passiveDescriptionTemplate: string;
  tunables: Record<string, Tunable>;
  skills: SkillDef[]; // skill1~4 (1つのみ使用可)
  quickSkill: SkillDef;
}

export type NerfBuffTier = 'small' | 'medium' | 'large';
export type NerfBuffDir = 'nerf' | 'buff';

export interface PatchLine {
  characterId: string;
  characterName: string;
  tier: NerfBuffTier;
  dir: NerfBuffDir;
  changes: string[]; // 人間可読な変更内容（複数）
}

export interface PatchNote {
  id: string;
  version: number;
  createdAt: string;
  lines: PatchLine[]; // ランダム順で保持
  resultSummary: string;
}
