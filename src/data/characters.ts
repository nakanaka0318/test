import type { CharacterDef, RangeShape, SkillDef, Tunable } from '../types';

function t(id: string, label: string, category: Tunable['category'], base: number, unit: Tunable['unit'] = ''): Tunable {
  return { id, label, category, base, current: base, unit };
}

const shapes = {
  self: (): RangeShape => ({ kind: 'self', facingAware: false, originatesFromSelf: true }),
  circleSmall: (): RangeShape => ({ kind: 'circle', radius: 2, facingAware: false, originatesFromSelf: false }),
  circleMed: (): RangeShape => ({ kind: 'circle', radius: 4, facingAware: false, originatesFromSelf: false }),
  circleMedExpanded: (): RangeShape => ({ kind: 'circle', radius: 6, facingAware: false, originatesFromSelf: false }),
  circleLarge: (): RangeShape => ({ kind: 'circle', radius: 6, facingAware: false, originatesFromSelf: false }),
  circleLargeExpanded: (): RangeShape => ({ kind: 'circle', radius: 8, facingAware: false, originatesFromSelf: false }),
  fanSmall: (): RangeShape => ({ kind: 'fan', radius: 3, angleDeg: 90, facingAware: true, originatesFromSelf: true }),
  fanMed: (): RangeShape => ({ kind: 'fan', radius: 4, angleDeg: 110, facingAware: true, originatesFromSelf: true }),
  lineNormal: (): RangeShape => ({ kind: 'line', w: 1, h: 5, facingAware: true, originatesFromSelf: true }),
  lineNormalExpanded: (): RangeShape => ({ kind: 'line', w: 1, h: 8, facingAware: true, originatesFromSelf: true }),
  lineLong: (): RangeShape => ({ kind: 'line', w: 1, h: 9, facingAware: true, originatesFromSelf: true }),
  lineLongExpanded: (): RangeShape => ({ kind: 'line', w: 1, h: 13, facingAware: true, originatesFromSelf: true }),
  rectSmall: (): RangeShape => ({ kind: 'rect', w: 2, h: 3, facingAware: true, originatesFromSelf: true }),
  rectSmallExpanded: (): RangeShape => ({ kind: 'rect', w: 3, h: 5, facingAware: true, originatesFromSelf: true }),
  rect3x6: (): RangeShape => ({ kind: 'rect', w: 3, h: 6, facingAware: true, originatesFromSelf: true }),
  rect5x2: (): RangeShape => ({ kind: 'rect', w: 5, h: 2, facingAware: true, originatesFromSelf: true }),
  squareMed: (size: number): RangeShape => ({ kind: 'square', size, facingAware: false, originatesFromSelf: false }),
};

function skill(def: SkillDef): SkillDef {
  return def;
}

// ---------------- 勇者 ----------------
const hero: CharacterDef = {
  id: 'hero',
  name: '勇者',
  passiveName: '跳ね除ける路',
  passiveDescriptionTemplate: 'スキル使用時、{{hero.passivePercent}}の確率でもう一度スキルを発動できる。',
  tunables: {
    'hero.hp': t('hero.hp', 'HP', 'hp', 120),
    'hero.move': t('hero.move', '移動ポイント', 'move', 80),
    'hero.atk': t('hero.atk', '基礎攻撃力', 'atk', 0),
    'hero.passivePercent': t('hero.passivePercent', 'パッシブ再発動率', 'percent', 20, '%'),
    's1.dmg': t('s1.dmg', 'ブレイブスラッシュ ダメージ', 'value', 15),
    's2.shield': t('s2.shield', '英雄の加護 シールド', 'value', 10),
    's3.dmg': t('s3.dmg', '天地鳴動 ダメージ', 'value', 25),
    's3.cooldown': t('s3.cooldown', '天地鳴動 クールダウン', 'cooldown', 3, 'ターン'),
    's3.uses': t('s3.uses', '天地鳴動 使用回数', 'usage', 2, '回'),
    'quick.dmg': t('quick.dmg', 'テレポートスラッシュ ダメージ', 'value', 10),
    'quick.shield': t('quick.shield', 'テレポートスラッシュ シールド', 'value', 15),
    'quick.cooldown': t('quick.cooldown', 'テレポートスラッシュ クールダウン', 'cooldown', 3, 'ターン'),
  },
  skills: [
    skill({
      id: 's1', name: 'ブレイブスラッシュ', kind: 'skill',
      descriptionTemplate: '中範囲・扇形の範囲内にいる敵全てに{{s1.dmg}}ダメージを与える。',
      targeting: 'aoe-self', activationHint: 'スキルボタンを2回タップして発動（範囲は自分の向いている方向）',
      range: shapes.fanMed(), effectId: 'hero.s1',
    }),
    skill({
      id: 's2', name: '英雄の加護', kind: 'skill',
      descriptionTemplate: '味方キャラ全員に{{s2.shield}}シールドを付与する。',
      targeting: 'aoe-self', activationHint: 'スキルボタンを2回タップして発動',
      range: shapes.self(), effectId: 'hero.s2',
    }),
    skill({
      id: 's3', name: '天地鳴動', kind: 'skill',
      descriptionTemplate: '大範囲・円形の範囲内にいる敵全てに{{s3.dmg}}ダメージを与える。（クールダウン{{s3.cooldown}} / 1試合{{s3.uses}}回まで）',
      cooldownTunableId: 's3.cooldown', usesPerMatchTunableId: 's3.uses',
      targeting: 'aoe-self', activationHint: 'スキルボタンを2回タップして発動',
      range: shapes.circleLargeExpanded(), effectId: 'hero.s3',
    }),
  ],
  quickSkill: skill({
    id: 'quick', name: 'テレポートスラッシュ', kind: 'quick',
    descriptionTemplate: 'キャラを一体選びその近くに移動する。敵なら{{quick.dmg}}ダメージ、味方なら{{quick.shield}}シールドを付与する。（クールダウン{{quick.cooldown}}）',
    cooldownTunableId: 'quick.cooldown',
    targeting: 'any-char', activationHint: 'グリッド上のキャラをタップして対象を選択',
    range: shapes.self(), effectId: 'hero.quick',
  }),
};

// ---------------- タンク ----------------
const tank: CharacterDef = {
  id: 'tank',
  name: 'タンク',
  passiveName: '防御',
  passiveDescriptionTemplate: 'ターン終了時、中範囲・円形の範囲内にいるキャラの数×{{tank.passiveShield}}シールドを得る。',
  tunables: {
    'tank.hp': t('tank.hp', 'HP', 'hp', 130),
    'tank.move': t('tank.move', '移動ポイント', 'move', 70),
    'tank.atk': t('tank.atk', '基礎攻撃力', 'atk', 0),
    'tank.passiveShield': t('tank.passiveShield', 'パッシブ シールド係数', 'value', 5),
    's1.dmg': t('s1.dmg', '盤石 ダメージ', 'value', 14),
    's1.shield': t('s1.shield', '盤石 シールド', 'value', 8),
    's2.advance': t('s2.advance', '突破 前進ブロック数', 'value', 6),
    's2.dmg': t('s2.dmg', '突破 ダメージ', 'value', 22),
    's3.shield': t('s3.shield', '防禦 シールド', 'value', 20),
    's3.uses': t('s3.uses', '防禦 使用回数', 'usage', 3, '回'),
    'quick.shield': t('quick.shield', '飛び込む壁 シールド', 'value', 8),
    'quick.cooldown': t('quick.cooldown', '飛び込む壁 クールダウン', 'cooldown', 3, 'ターン'),
  },
  skills: [
    skill({
      id: 's1', name: '盤石', kind: 'skill',
      descriptionTemplate: '中範囲・円形の範囲内にいる敵に{{s1.dmg}}ダメージ、範囲内の味方に{{s1.shield}}シールドを与える。',
      targeting: 'aoe-self', activationHint: 'スキルボタンを2回タップして発動',
      range: shapes.circleMed(), effectId: 'tank.s1',
    }),
    skill({
      id: 's2', name: '突破', kind: 'skill',
      descriptionTemplate: '前方向に{{s2.advance}}ブロック前進し、範囲内の敵に{{s2.dmg}}ダメージを与える。',
      targeting: 'aoe-self', activationHint: 'スキルボタンを2回タップして発動（向いている方向へ前進）',
      range: shapes.rectSmallExpanded(), effectId: 'tank.s2',
    }),
    skill({
      id: 's3', name: '防禦', kind: 'skill',
      descriptionTemplate: '自分に{{s3.shield}}シールドを得る。（1試合{{s3.uses}}回まで）',
      usesPerMatchTunableId: 's3.uses',
      targeting: 'aoe-self', activationHint: 'スキルボタンを2回タップして発動',
      range: shapes.self(), effectId: 'tank.s3',
    }),
  ],
  quickSkill: skill({
    id: 'quick', name: '飛び込む壁', kind: 'quick',
    descriptionTemplate: '味方キャラの近くに移動し、味方に{{quick.shield}}シールドを与える。（クールダウン{{quick.cooldown}}）',
    cooldownTunableId: 'quick.cooldown',
    targeting: 'ally', activationHint: 'グリッド上の味方キャラをタップして対象を選択',
    range: shapes.self(), effectId: 'tank.quick',
  }),
};

// ---------------- アーチャー ----------------
const archer: CharacterDef = {
  id: 'archer',
  name: 'アーチャー',
  passiveName: 'ロングボウ',
  passiveDescriptionTemplate: 'ダメージを与えた敵が10マスより遠いなら{{archer.passiveNear}}、20マスより遠いなら{{archer.passiveFar}}のダメージ倍率になる。',
  tunables: {
    'archer.hp': t('archer.hp', 'HP', 'hp', 90),
    'archer.move': t('archer.move', '移動ポイント', 'move', 150),
    'archer.atk': t('archer.atk', '基礎攻撃力', 'atk', 0),
    'archer.passiveNear': t('archer.passiveNear', 'パッシブ倍率(10マス超)', 'percent', 150, '%'),
    'archer.passiveFar': t('archer.passiveFar', 'パッシブ倍率(20マス超)', 'percent', 200, '%'),
    's1.dmg': t('s1.dmg', 'クレッセントアロー ダメージ', 'value', 8),
    's2.percent': t('s2.percent', 'ハンターマーク 被ダメージ増加率', 'percent', 50, '%'),
    's2.cooldown': t('s2.cooldown', 'ハンターマーク クールダウン', 'cooldown', 3, 'ターン'),
    's3.dmg': t('s3.dmg', 'バックショット ダメージ', 'value', 6),
    's3.moveRecover': t('s3.moveRecover', 'バックショット 移動回復', 'value', 50),
    's3.cooldown': t('s3.cooldown', 'バックショット クールダウン', 'cooldown', 3, 'ターン'),
    'quick.moveSet': t('quick.moveSet', 'フリームーブ 移動ポイント', 'value', 1000),
    'quick.cooldown': t('quick.cooldown', 'フリームーブ クールダウン', 'cooldown', 5, 'ターン'),
    'quick.uses': t('quick.uses', 'フリームーブ 使用回数', 'usage', 2, '回'),
  },
  skills: [
    skill({
      id: 's1', name: 'クレッセントアロー', kind: 'skill',
      descriptionTemplate: '向いている方向に長い縦線の範囲内にいるキャラ全てに{{s1.dmg}}ダメージを与える。',
      targeting: 'aoe-self', activationHint: 'スキルボタンを2回タップして発動（向いている方向へ発射）',
      range: shapes.lineLongExpanded(), effectId: 'archer.s1',
    }),
    skill({
      id: 's2', name: 'ハンターマーク', kind: 'skill',
      descriptionTemplate: '一番遠い敵の被ダメージを{{s2.percent}}上げる（3ターン継続）。（クールダウン{{s2.cooldown}}）',
      cooldownTunableId: 's2.cooldown',
      targeting: 'aoe-farthest', activationHint: 'スキルボタンを2回タップして発動（自動的に一番遠い敵を対象化）',
      range: shapes.self(), effectId: 'archer.s2',
    }),
    skill({
      id: 's3', name: 'バックショット', kind: 'skill',
      descriptionTemplate: '小範囲・扇形の範囲内の敵に{{s3.dmg}}ダメージと次のターン移動不能を付与。自分の移動ポイントを{{s3.moveRecover}}回復。（クールダウン{{s3.cooldown}}）',
      cooldownTunableId: 's3.cooldown',
      targeting: 'aoe-self', activationHint: 'スキルボタンを2回タップして発動',
      range: shapes.fanSmall(), effectId: 'archer.s3',
    }),
  ],
  quickSkill: skill({
    id: 'quick', name: 'フリームーブ', kind: 'quick',
    descriptionTemplate: '自分の移動ポイントを{{quick.moveSet}}にする。（クールダウン{{quick.cooldown}} / 1試合{{quick.uses}}回まで）',
    cooldownTunableId: 'quick.cooldown', usesPerMatchTunableId: 'quick.uses',
    targeting: 'self', activationHint: 'クイックスキルボタンを2回タップして発動',
    range: shapes.self(), effectId: 'archer.quick',
  }),
};

// ---------------- メイジ ----------------
const mage: CharacterDef = {
  id: 'mage',
  name: 'メイジ',
  passiveName: '魔法陣',
  passiveDescriptionTemplate: '青ブロック上にいる時、与えるダメージが{{mage.passivePercent}}アップする。青ブロック上でターン終了時、攻撃力+{{mage.passiveAtkGain}}。',
  tunables: {
    'mage.hp': t('mage.hp', 'HP', 'hp', 100),
    'mage.move': t('mage.move', '移動ポイント', 'move', 104),
    'mage.atk': t('mage.atk', '基礎攻撃力', 'atk', 0),
    'mage.passivePercent': t('mage.passivePercent', 'パッシブ ダメージ増加率', 'percent', 100, '%'),
    'mage.passiveAtkGain': t('mage.passiveAtkGain', 'パッシブ 攻撃力上昇', 'value', 2),
    's1.dmg': t('s1.dmg', 'マジックショット ダメージ', 'value', 6),
    's1.atkGain': t('s1.atkGain', 'マジックショット 攻撃力上昇', 'value', 2),
    's2.cooldown': t('s2.cooldown', '魔法陣召喚 クールダウン', 'cooldown', 3, 'ターン'),
    's3.dmg': t('s3.dmg', 'エクスプロージョン ダメージ', 'value', 6),
    'quick.uses': t('quick.uses', '位置交換 使用回数', 'usage', 4, '回'),
  },
  skills: [
    skill({
      id: 's1', name: 'マジックショット', kind: 'skill',
      descriptionTemplate: '選択した敵に{{s1.dmg}}ダメージを与え、自身の攻撃力+{{s1.atkGain}}。',
      targeting: 'enemy', activationHint: 'スキルボタンをタップし、グリッド上の敵キャラをタップして対象を選択',
      range: shapes.self(), effectId: 'mage.s1',
    }),
    skill({
      id: 's2', name: '魔法陣召喚', kind: 'skill',
      descriptionTemplate: '自身の足元に5×5の青ブロックを召喚する。（クールダウン{{s2.cooldown}}）',
      cooldownTunableId: 's2.cooldown',
      targeting: 'aoe-self', activationHint: 'スキルボタンを2回タップして発動',
      range: shapes.squareMed(2), effectId: 'mage.s2',
    }),
    skill({
      id: 's3', name: 'エクスプロージョン', kind: 'skill',
      descriptionTemplate: '大範囲・円形の範囲内にいる敵全てに{{s3.dmg}}ダメージを与える。',
      targeting: 'aoe-self', activationHint: 'スキルボタンを2回タップして発動',
      range: shapes.circleLarge(), effectId: 'mage.s3',
    }),
  ],
  quickSkill: skill({
    id: 'quick', name: '位置交換', kind: 'quick',
    descriptionTemplate: 'キャラを一体選び、そのキャラと位置を交換する。（1試合{{quick.uses}}回まで）',
    usesPerMatchTunableId: 'quick.uses',
    targeting: 'any-char', activationHint: 'グリッド上のキャラをタップして対象を選択',
    range: shapes.self(), effectId: 'mage.quick',
  }),
};

// ---------------- ファイター ----------------
const fighter: CharacterDef = {
  id: 'fighter',
  name: 'ファイター',
  passiveName: '野獣',
  passiveDescriptionTemplate: '敵にダメージを与えるたびに{{fighter.passiveShield}}シールドを得る。hpを失うたびに攻撃力+{{fighter.passiveAtkGain}}。',
  tunables: {
    'fighter.hp': t('fighter.hp', 'HP', 'hp', 100),
    'fighter.move': t('fighter.move', '移動ポイント', 'move', 64),
    'fighter.atk': t('fighter.atk', '基礎攻撃力', 'atk', 0),
    'fighter.passiveShield': t('fighter.passiveShield', 'パッシブ シールド', 'value', 6),
    'fighter.passiveAtkGain': t('fighter.passiveAtkGain', 'パッシブ 攻撃力上昇', 'value', 2),
    's1.dmg': t('s1.dmg', 'おらあ ダメージ', 'value', 12),
    's2.dmg': t('s2.dmg', 'すわー ダメージ', 'value', 6),
    's3.hpCost': t('s3.hpCost', 'どえわー HP消費', 'value', 14),
    's3.dmgUpPercent': t('s3.dmgUpPercent', 'どえわー ダメージ増加率', 'percent', 100, '%'),
    's3.cooldown': t('s3.cooldown', 'どえわー クールダウン', 'cooldown', 3, 'ターン'),
    'quick.hpCost': t('quick.hpCost', 'おおん HP消費', 'value', 8),
    'quick.shieldGain': t('quick.shieldGain', 'おおん シールド', 'value', 14),
    'quick.uses': t('quick.uses', 'おおん 使用回数', 'usage', 3, '回'),
  },
  skills: [
    skill({
      id: 's1', name: 'おらあ', kind: 'skill',
      descriptionTemplate: '前方3×6にいる敵に{{s1.dmg}}ダメージ。範囲マスが通常状態なら赤マスに、赤マスなら黒マスにする。',
      targeting: 'aoe-self', activationHint: 'スキルボタンを2回タップして発動（向いている方向へ）',
      range: shapes.rect3x6(), effectId: 'fighter.s1',
    }),
    skill({
      id: 's2', name: 'すわー', kind: 'skill',
      descriptionTemplate: '前方5×2にいる敵に{{s2.dmg}}ダメージと次のターン移動不能を付与。',
      targeting: 'aoe-self', activationHint: 'スキルボタンを2回タップして発動',
      range: shapes.rect5x2(), effectId: 'fighter.s2',
    }),
    skill({
      id: 's3', name: 'どえわー', kind: 'skill',
      descriptionTemplate: 'hpを{{s3.hpCost}}失う。次のターン攻撃ダメージ{{s3.dmgUpPercent}}アップ。（クールダウン{{s3.cooldown}}）',
      cooldownTunableId: 's3.cooldown',
      targeting: 'aoe-self', activationHint: 'スキルボタンを2回タップして発動',
      range: shapes.self(), effectId: 'fighter.s3',
    }),
  ],
  quickSkill: skill({
    id: 'quick', name: 'おおん', kind: 'quick',
    descriptionTemplate: 'hpを{{quick.hpCost}}失い、{{quick.shieldGain}}シールドを得て移動不能を解除する。（1試合{{quick.uses}}回まで）',
    usesPerMatchTunableId: 'quick.uses',
    targeting: 'aoe-self', activationHint: 'クイックスキルボタンを2回タップして発動',
    range: shapes.self(), effectId: 'fighter.quick',
  }),
};

// ---------------- アサシン ----------------
const assassin: CharacterDef = {
  id: 'assassin',
  name: 'アサシン',
  passiveName: 'スピーカー',
  passiveDescriptionTemplate: '分身がいる場合、範囲攻撃使用時、全ての分身からも同じ範囲攻撃が発生する。',
  tunables: {
    'assassin.hp': t('assassin.hp', 'HP', 'hp', 90),
    'assassin.move': t('assassin.move', '移動ポイント', 'move', 70),
    'assassin.atk': t('assassin.atk', '基礎攻撃力', 'atk', 0),
    's1.dmg': t('s1.dmg', '斬技 ダメージ', 'value', 11),
    's2.dmg': t('s2.dmg', 'プラチナスター ダメージ', 'value', 7),
    's2.cooldown': t('s2.cooldown', 'プラチナスター クールダウン', 'cooldown', 2, 'ターン'),
    's3.dmgAoe': t('s3.dmgAoe', 'スキルビート 範囲ダメージ', 'value', 3),
    's3.dmgPerAlly': t('s3.dmgPerAlly', 'スキルビート 追加ダメージ係数', 'value', 2),
    's3.cooldown': t('s3.cooldown', 'スキルビート クールダウン', 'cooldown', 3, 'ターン'),
    's4.heal': t('s4.heal', '分身移動 HP回復', 'value', 15),
    'quick.uses': t('quick.uses', '分身召喚 使用回数', 'usage', 6, '回'),
  },
  skills: [
    skill({
      id: 's1', name: '斬技', kind: 'skill',
      descriptionTemplate: '普通の長さの縦線の範囲内にいる敵に{{s1.dmg}}ダメージを与える。',
      targeting: 'aoe-self', activationHint: 'スキルボタンを2回タップして発動（向いている方向へ）',
      range: shapes.lineNormalExpanded(), effectId: 'assassin.s1',
    }),
    skill({
      id: 's2', name: 'プラチナスター', kind: 'skill',
      descriptionTemplate: '一番遠い敵の目の前に移動し、{{s2.dmg}}ダメージを与える。（クールダウン{{s2.cooldown}}）',
      cooldownTunableId: 's2.cooldown',
      targeting: 'aoe-farthest', activationHint: 'スキルボタンを2回タップして発動',
      range: shapes.self(), effectId: 'assassin.s2',
    }),
    skill({
      id: 's3', name: 'スキルビート', kind: 'skill',
      descriptionTemplate: '大範囲・円形にいる敵全てに{{s3.dmgAoe}}ダメージ、範囲内にいる[味方と分身の総数]×{{s3.dmgPerAlly}}ダメージを一番近くの敵に追加で与える。（クールダウン{{s3.cooldown}}）',
      cooldownTunableId: 's3.cooldown',
      targeting: 'aoe-self', activationHint: 'スキルボタンを2回タップして発動',
      range: shapes.circleLarge(), effectId: 'assassin.s3',
    }),
    skill({
      id: 's4', name: '分身移動', kind: 'skill',
      descriptionTemplate: '分身を1つ選びそこに移動する。その後、選んだ分身を破壊し、自分のhpを{{s4.heal}}回復する。',
      targeting: 'clone', activationHint: 'グリッド上の自分の分身をタップして選択',
      range: shapes.self(), effectId: 'assassin.s4',
    }),
  ],
  quickSkill: skill({
    id: 'quick', name: '分身召喚', kind: 'quick',
    descriptionTemplate: '自分の今いる場所に分身を召喚する（最大3体、3体いる場合は使用不可）。（1試合{{quick.uses}}回まで）',
    usesPerMatchTunableId: 'quick.uses',
    targeting: 'self', activationHint: 'クイックスキルボタンを2回タップして発動',
    range: shapes.self(), effectId: 'assassin.quick',
  }),
};

// ---------------- ヒーラー ----------------
const healer: CharacterDef = {
  id: 'healer',
  name: 'ヒーラー',
  passiveName: 'ヒーラーさんは後ろに立ちたい',
  passiveDescriptionTemplate: 'ターン終了時、自分と敵を結ぶ直線上にいる味方を{{healer.passiveHeal}}回復する。',
  tunables: {
    'healer.hp': t('healer.hp', 'HP', 'hp', 70),
    'healer.move': t('healer.move', '移動ポイント', 'move', 144),
    'healer.atk': t('healer.atk', '基礎攻撃力', 'atk', 0),
    'healer.passiveHeal': t('healer.passiveHeal', 'パッシブ 回復量', 'value', 8),
    's1.dmg': t('s1.dmg', '攻撃して回復したい ダメージ', 'value', 6),
    's1.healAll': t('s1.healAll', '攻撃して回復したい 味方回復', 'value', 3),
    's2.heal': t('s2.heal', '強く生きたい 回復', 'value', 6),
    's2.atkGain': t('s2.atkGain', '強く生きたい 攻撃力上昇', 'value', 2),
    's2.cooldown': t('s2.cooldown', '強く生きたい クールダウン', 'cooldown', 2, 'ターン'),
    's3.dmgAoe': t('s3.dmgAoe', '奇跡を起こしたい 全体ダメージ', 'value', 2),
    'quick.uses': t('quick.uses', '警戒付与 使用回数', 'usage', 3, '回'),
  },
  skills: [
    skill({
      id: 's1', name: '攻撃して回復したい', kind: 'skill',
      descriptionTemplate: '選択した敵に{{s1.dmg}}ダメージ、味方全てを{{s1.healAll}}回復する。',
      targeting: 'enemy', activationHint: 'スキルボタンをタップし、グリッド上の敵キャラをタップして対象を選択',
      range: shapes.self(), effectId: 'healer.s1',
    }),
    skill({
      id: 's2', name: '強く生きたい', kind: 'skill',
      descriptionTemplate: '味方を{{s2.heal}}回復し、攻撃力+{{s2.atkGain}}。（クールダウン{{s2.cooldown}}）',
      cooldownTunableId: 's2.cooldown',
      targeting: 'ally', activationHint: 'スキルボタンをタップし、グリッド上の味方キャラをタップして対象を選択',
      range: shapes.self(), effectId: 'healer.s2',
    }),
    skill({
      id: 's3', name: '奇跡を起こしたい', kind: 'skill',
      descriptionTemplate: '自分の場所に味方を移動させ、さらに敵全てに{{s3.dmgAoe}}ダメージを与える。',
      targeting: 'ally', activationHint: 'スキルボタンをタップし、グリッド上の味方キャラをタップして対象を選択',
      range: shapes.self(), effectId: 'healer.s3',
    }),
  ],
  quickSkill: skill({
    id: 'quick', name: '警戒付与', kind: 'quick',
    descriptionTemplate: 'キャラを一体選び、敵キャラなら次のターン移動不能を付与、味方なら移動不能を解除する。（1試合{{quick.uses}}回まで）',
    usesPerMatchTunableId: 'quick.uses',
    targeting: 'any-char', activationHint: 'グリッド上のキャラをタップして対象を選択',
    range: shapes.self(), effectId: 'healer.quick',
  }),
};

// ---------------- ポイズン ----------------
const poison: CharacterDef = {
  id: 'poison',
  name: 'ポイズン',
  passiveName: '毒マスター',
  passiveDescriptionTemplate: '自分に付与されている毒の数だけ攻撃力が上昇する。緑マスにいるキャラはターン開始時毒{{poison.greenTilePoison}}を得る。',
  tunables: {
    'poison.hp': t('poison.hp', 'HP', 'hp', 100),
    'poison.move': t('poison.move', '移動ポイント', 'move', 100),
    'poison.atk': t('poison.atk', '基礎攻撃力', 'atk', 0),
    'poison.greenTilePoison': t('poison.greenTilePoison', '緑マス 毒付与量', 'value', 5),
    's1.poison': t('s1.poison', 'ポイズンクラスター 毒付与量', 'value', 2),
    's2.dmg': t('s2.dmg', 'ポイズンビン ダメージ', 'value', 8),
    's3.healMultiplier': t('s3.healMultiplier', '血清 回復係数', 'value', 2),
    's3.uses': t('s3.uses', '血清 使用回数', 'usage', 2, '回'),
    'quick.cooldown': t('quick.cooldown', '毒写 クールダウン', 'cooldown', 3, 'ターン'),
  },
  skills: [
    skill({
      id: 's1', name: 'ポイズンクラスター', kind: 'skill',
      descriptionTemplate: '選んだ敵に毒{{s1.poison}}を付与し、周囲3×3マスを緑マスにする。',
      targeting: 'enemy', activationHint: 'スキルボタンをタップし、グリッド上の敵キャラをタップして対象を選択',
      range: shapes.self(), effectId: 'poison.s1',
    }),
    skill({
      id: 's2', name: 'ポイズンビン', kind: 'skill',
      descriptionTemplate: '円形中範囲にいる敵全てに{{s2.dmg}}ダメージを与え、そのエリア全てを緑マスにする。',
      targeting: 'aoe-self', activationHint: 'スキルボタンを2回タップして発動',
      range: shapes.circleMedExpanded(), effectId: 'poison.s2',
    }),
    skill({
      id: 's3', name: '血清', kind: 'skill',
      descriptionTemplate: '自分に付与されている毒×{{s3.healMultiplier}}のhpを回復し、自身の毒を解除する。（1試合{{s3.uses}}回まで）',
      usesPerMatchTunableId: 's3.uses',
      targeting: 'aoe-self', activationHint: 'スキルボタンを2回タップして発動',
      range: shapes.self(), effectId: 'poison.s3',
    }),
  ],
  quickSkill: skill({
    id: 'quick', name: '毒写', kind: 'quick',
    descriptionTemplate: '選んだキャラの毒の数分、自身に毒を付与する。選んだキャラは毒を解除する。（クールダウン{{quick.cooldown}}）',
    cooldownTunableId: 'quick.cooldown',
    targeting: 'any-char', activationHint: 'グリッド上のキャラをタップして対象を選択',
    range: shapes.self(), effectId: 'poison.quick',
  }),
};

// ---------------- ギャンブラー ----------------
const gambler: CharacterDef = {
  id: 'gambler',
  name: 'ギャンブラー',
  passiveName: '運命のダイス',
  passiveDescriptionTemplate: 'ターン開始時、1d100でダイスを振る。出た目を運値とする。',
  tunables: {
    'gambler.hp': t('gambler.hp', 'HP', 'hp', 100),
    'gambler.move': t('gambler.move', '移動ポイント', 'move', 114),
    'gambler.atk': t('gambler.atk', '基礎攻撃力', 'atk', 0),
    's1.dmg': t('s1.dmg', 'Destiny ダメージ', 'value', 5),
    's1.luckDrop': t('s1.luckDrop', 'Destiny 運値減少量', 'value', 10),
    's1.atkGain': t('s1.atkGain', 'Destiny 攻撃力上昇', 'value', 1),
    's2.uses': t('s2.uses', 'Providence 使用回数', 'usage', 2, '回'),
    's3.hpHeal': t('s3.hpHeal', 'Random Fortune HP回復', 'value', 30),
    's3.atkGain': t('s3.atkGain', 'Random Fortune 攻撃力上昇', 'value', 5),
    's3.cooldown': t('s3.cooldown', 'Random Fortune クールダウン', 'cooldown', 4, 'ターン'),
    'quick.uses': t('quick.uses', 'ダイスロール 使用回数', 'usage', 4, '回'),
  },
  skills: [
    skill({
      id: 's1', name: 'Destiny', kind: 'skill',
      descriptionTemplate: '毎ターン完全ランダムな範囲にいる敵全てに{{s1.dmg}}ダメージを与える。その後[運値]%の確率で運値を{{s1.luckDrop}}減らし、攻撃力+{{s1.atkGain}}して範囲を変更し、もう一度スキル1を使用できる。',
      targeting: 'aoe-self', activationHint: 'スキルボタンを2回タップして発動（範囲はランダム決定）',
      range: shapes.circleMed(), effectId: 'gambler.s1',
    }),
    skill({
      id: 's2', name: 'Providence', kind: 'skill',
      descriptionTemplate: '自分のhpを[運値]%の確率で全回復する。失敗時、このキャラは死亡する。（1試合{{s2.uses}}回まで）',
      usesPerMatchTunableId: 's2.uses',
      targeting: 'aoe-self', activationHint: 'スキルボタンを2回タップして発動（リスクあり、確認表示あり）',
      range: shapes.self(), effectId: 'gambler.s2',
    }),
    skill({
      id: 's3', name: 'Random Fortune', kind: 'skill',
      descriptionTemplate: '[運値]%の確率で味方ランダム1体のクールダウンを全復活、攻撃力+{{s3.atkGain}}、hp{{s3.hpHeal}}回復。失敗時、対象が敵ランダム1体になる。（クールダウン{{s3.cooldown}}）',
      cooldownTunableId: 's3.cooldown',
      targeting: 'aoe-self', activationHint: 'スキルボタンを2回タップして発動',
      range: shapes.self(), effectId: 'gambler.s3',
    }),
  ],
  quickSkill: skill({
    id: 'quick', name: 'ダイスロール', kind: 'quick',
    descriptionTemplate: 'ダイスを振り直し、運値とスキル1の攻撃範囲を変化させる。（1試合{{quick.uses}}回まで）',
    usesPerMatchTunableId: 'quick.uses',
    targeting: 'self', activationHint: 'クイックスキルボタンを2回タップして発動',
    range: shapes.self(), effectId: 'gambler.quick',
  }),
};

export const CHARACTERS: CharacterDef[] = [hero, tank, archer, mage, fighter, assassin, healer, poison, gambler];
export const CHARACTER_MAP: Record<string, CharacterDef> = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));

export const GRID_SIZE = 15;
export const MOVE_POINTS_PER_CELL = 10;
