import { create } from 'zustand';
import type { BattleState } from '../engine/battleTypes';
import {
  createBattle, currentUnit, endTurn as engineEndTurn, setFacing as engineSetFacing,
  tryMoveStep, performQuickSkill as engineUseQuickSkill, performSkill as engineUseSkill,
} from '../engine/battleEngine';
import type { BattleSetup } from '../engine/battleEngine';
import { npcTakeTurn } from '../engine/npc';
import type { EffectCtx } from '../engine/skillEffects';
import type { Facing } from '../types';

interface PendingSkillInfo {
  skillId: string;
  kind: 'skill' | 'quick';
  needsTarget: boolean;
}

interface BattleStoreState {
  battle: BattleState | null;
  pending: PendingSkillInfo | null;
  start: (setup: BattleSetup) => void;
  moveStep: (facing: Facing) => void;
  rotate: (facing: Facing) => void;
  setMoveMode: (active: boolean) => void;
  armSkill: (skillId: string, kind: 'skill' | 'quick', needsTarget: boolean) => void;
  cancelPending: () => void;
  confirmArmed: () => void;
  targetSkill: (ctx: EffectCtx) => void;
  endTurn: () => void;
  runNpcTurnOnce: () => boolean;
  reset: () => void;
}

function touch(set: (fn: (s: BattleStoreState) => Partial<BattleStoreState>) => void) {
  set(s => ({ battle: s.battle ? { ...s.battle } : null }));
}

export const useBattleStore = create<BattleStoreState>((set, get) => ({
  battle: null,
  pending: null,
  start: (setup) => {
    const battle = createBattle(setup);
    set({ battle, pending: null });
  },
  moveStep: (facing) => {
    const battle = get().battle;
    if (!battle) return;
    const unit = currentUnit(battle);
    tryMoveStep(battle, unit.uid, facing);
    touch(set);
  },
  rotate: (facing) => {
    const battle = get().battle;
    if (!battle) return;
    const unit = currentUnit(battle);
    engineSetFacing(battle, unit.uid, facing);
    touch(set);
  },
  setMoveMode: (active) => {
    const battle = get().battle;
    if (!battle) return;
    battle.moveModeActive = active;
    if (active) set({ pending: null });
    touch(set);
  },
  armSkill: (skillId, kind, needsTarget) => {
    const battle = get().battle;
    if (battle) { battle.moveModeActive = false; }
    set({ pending: { skillId, kind, needsTarget } });
    touch(set);
  },
  cancelPending: () => set({ pending: null }),
  confirmArmed: () => {
    const battle = get().battle;
    const pending = get().pending;
    if (!battle || !pending || pending.needsTarget) return;
    const unit = currentUnit(battle);
    if (pending.kind === 'skill') engineUseSkill(battle, unit.uid, pending.skillId, {});
    else engineUseQuickSkill(battle, unit.uid, {});
    set({ pending: null });
    touch(set);
  },
  targetSkill: (ctx) => {
    const battle = get().battle;
    const pending = get().pending;
    if (!battle || !pending || !pending.needsTarget) return;
    const unit = currentUnit(battle);
    if (pending.kind === 'skill') engineUseSkill(battle, unit.uid, pending.skillId, ctx);
    else engineUseQuickSkill(battle, unit.uid, ctx);
    set({ pending: null });
    touch(set);
  },
  endTurn: () => {
    const battle = get().battle;
    if (!battle) return;
    engineEndTurn(battle);
    set({ pending: null });
    touch(set);
  },
  runNpcTurnOnce: () => {
    const battle = get().battle;
    if (!battle || battle.winner) return false;
    const unit = currentUnit(battle);
    if (!unit.isNpc) return false;
    npcTakeTurn(battle);
    touch(set);
    return true;
  },
  reset: () => set({ battle: null, pending: null }),
}));
