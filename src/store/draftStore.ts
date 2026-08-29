import { create } from 'zustand';
import { CHARACTERS } from '../data/characters';
import type { Team } from '../types';

export type DraftStepKind = 'ban' | 'pick';
export interface DraftStep {
  kind: DraftStepKind;
  side: 'first' | 'second';
  count: number;
}

export const DRAFT_SEQUENCE: DraftStep[] = [
  { kind: 'ban', side: 'first', count: 1 },
  { kind: 'ban', side: 'second', count: 1 },
  { kind: 'pick', side: 'first', count: 1 },
  { kind: 'pick', side: 'second', count: 2 },
  { kind: 'pick', side: 'first', count: 1 },
];

interface DraftState {
  mode: 'pvp' | 'pve' | null;
  npcTeam: Team | null; // pveの場合、NPCが操作するチーム
  firstTeam: Team; // 'first'側が実際にはどちらのチームか
  stepIndex: number;
  bans: string[];
  picksA: string[];
  picksB: string[];
  log: string[];
  finished: boolean;
  startDraft: (mode: 'pvp' | 'pve') => void;
  sideTeam: (side: 'first' | 'second') => Team;
  isNpcTurn: () => boolean;
  currentStep: () => DraftStep | null;
  availableChars: () => string[];
  choose: (charId: string) => void;
  autoResolveIfNpc: () => void;
  resetDraft: () => void;
}

export const useDraftStore = create<DraftState>((set, get) => ({
  mode: null,
  npcTeam: null,
  firstTeam: 'A',
  stepIndex: 0,
  bans: [],
  picksA: [],
  picksB: [],
  log: [],
  finished: false,
  startDraft: (mode) => {
    const firstTeam: Team = Math.random() < 0.5 ? 'A' : 'B';
    const npcTeam: Team | null = mode === 'pve' ? 'B' : null;
    set({
      mode, npcTeam, firstTeam, stepIndex: 0, bans: [], picksA: [], picksB: [], finished: false,
      log: [`先攻は${firstTeam === 'A' ? 'Aチーム' : 'Bチーム'}に決定！`],
    });
  },
  sideTeam: (side) => {
    const { firstTeam } = get();
    if (side === 'first') return firstTeam;
    return firstTeam === 'A' ? 'B' : 'A';
  },
  isNpcTurn: () => {
    const { npcTeam, stepIndex } = get();
    if (!npcTeam) return false;
    const step = DRAFT_SEQUENCE[stepIndex];
    if (!step) return false;
    return get().sideTeam(step.side) === npcTeam;
  },
  currentStep: () => DRAFT_SEQUENCE[get().stepIndex] ?? null,
  availableChars: () => {
    const { bans, picksA, picksB } = get();
    const taken = new Set([...bans, ...picksA, ...picksB]);
    return CHARACTERS.map(c => c.id).filter(id => !taken.has(id));
  },
  choose: (charId) => {
    const state = get();
    const step = DRAFT_SEQUENCE[state.stepIndex];
    if (!step) return;
    const team = state.sideTeam(step.side);
    const name = CHARACTERS.find(c => c.id === charId)?.name ?? charId;
    const teamLabel = team === 'A' ? 'Aチーム' : 'Bチーム';
    if (step.kind === 'ban') {
      set(s => ({ bans: [...s.bans, charId], log: [...s.log, `${teamLabel}が「${name}」をBAN`] }));
    } else if (team === 'A') {
      set(s => ({ picksA: [...s.picksA, charId], log: [...s.log, `${teamLabel}が「${name}」をPICK`] }));
    } else {
      set(s => ({ picksB: [...s.picksB, charId], log: [...s.log, `${teamLabel}が「${name}」をPICK`] }));
    }
    advanceStep();
  },
  autoResolveIfNpc: () => {
    const state = get();
    if (state.finished) return;
    if (!state.isNpcTurn()) return;
    const avail = state.availableChars();
    if (avail.length === 0) return;
    const pick = avail[Math.floor(Math.random() * avail.length)];
    state.choose(pick);
  },
  resetDraft: () => set({
    mode: null, npcTeam: null, firstTeam: 'A', stepIndex: 0, bans: [], picksA: [], picksB: [], log: [], finished: false,
  }),
}));

function advanceStep() {
  const state = useDraftStore.getState();
  const step = DRAFT_SEQUENCE[state.stepIndex];
  if (!step) return;
  // ban/pickそれぞれ別カウントで、現在のステップ内での選択数を求める
  const sameKindBefore = DRAFT_SEQUENCE.slice(0, state.stepIndex)
    .filter(s => s.kind === step.kind)
    .reduce((n, s) => n + s.count, 0);
  const totalSameKindNow = step.kind === 'ban' ? state.bans.length : (state.picksA.length + state.picksB.length);
  const doneInCurrentStep = totalSameKindNow - sameKindBefore;
  if (doneInCurrentStep >= step.count) {
    if (state.stepIndex + 1 >= DRAFT_SEQUENCE.length) {
      useDraftStore.setState({ finished: true });
    } else {
      useDraftStore.setState({ stepIndex: state.stepIndex + 1 });
    }
  }
}
