import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CHARACTERS } from '../data/characters';
import { cloneTunableState, runPostBattle, type PostBattleInput, type TunableState } from '../engine/nerfBuff';
import type { CharacterDef, PatchNote, Tunable } from '../types';

interface GameState {
  tunableState: TunableState;
  patchNotes: PatchNote[];
  getCurrentCharacter: (charId: string) => CharacterDef;
  applyPostBattle: (input: Omit<PostBattleInput, 'characters'>) => PatchNote;
  resetAll: () => void;
}

function withCurrentTunables(def: CharacterDef, tunables: Record<string, Tunable>): CharacterDef {
  return {
    ...def,
    tunables,
  };
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      tunableState: cloneTunableState(CHARACTERS),
      patchNotes: [],
      getCurrentCharacter: (charId: string) => {
        const def = CHARACTERS.find(c => c.id === charId)!;
        return withCurrentTunables(def, get().tunableState[charId]);
      },
      applyPostBattle: (input) => {
        const state = get().tunableState;
        const cloned: TunableState = JSON.parse(JSON.stringify(state));
        const result = runPostBattle(cloned, { ...input, characters: CHARACTERS });
        const version = get().patchNotes.length + 1;
        const note: PatchNote = {
          id: `patch-${version}-${Date.now()}`,
          version,
          createdAt: new Date().toISOString(),
          lines: result.lines,
          resultSummary: result.summary,
        };
        set(s => ({ tunableState: result.state, patchNotes: [...s.patchNotes, note] }));
        return note;
      },
      resetAll: () => {
        set({ tunableState: cloneTunableState(CHARACTERS), patchNotes: [] });
      },
    }),
    { name: 'patch-battle-game-save' },
  ),
);

export function getCharacterList(tunableState: TunableState): CharacterDef[] {
  return CHARACTERS.map(def => withCurrentTunables(def, tunableState[def.id]));
}
