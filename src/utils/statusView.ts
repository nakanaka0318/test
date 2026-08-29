import type { CharacterDef } from '../types';

/** current値をbase値に置き換えたキャラ定義を返す（初期ステータス表示用） */
export function withBaseAsCurrent(def: CharacterDef): CharacterDef {
  const tunables: CharacterDef['tunables'] = {};
  for (const [id, tu] of Object.entries(def.tunables)) {
    tunables[id] = { ...tu, current: tu.base };
  }
  return { ...def, tunables };
}

export function isModified(def: CharacterDef): boolean {
  return Object.values(def.tunables).some(t => t.current !== t.base);
}
