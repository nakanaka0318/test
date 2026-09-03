import { create } from 'zustand';
import type { Difficulty, TowerKind, WeaponKind } from './config';
import type { Quality } from './core/Engine';

export type Phase = 'menu' | 'prep' | 'wave' | 'paused' | 'victory' | 'defeat';

export interface SelectedTowerInfo {
  id: number;
  kind: TowerKind;
  level: number;
  maxLevel: number;
  damage: number;
  range: number;
  fireInterval: number;
  upgradeCost: number;
  sellValue: number;
  hp: number;
  maxHp: number;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'warn' | 'good';
}

export interface RunStats {
  kills: number;
  score: number;
  wavesCleared: number;
  accuracy: number;
  damageDealt: number;
  towersBuilt: number;
  timeSeconds: number;
}

export interface UiState {
  phase: Phase;
  started: boolean;
  difficulty: Difficulty;
  quality: Quality;

  wave: number;
  totalWaves: number;
  waveTimer: number;
  waveHeadline: string;
  enemiesAlive: number;
  enemiesRemaining: number;

  credits: number;
  score: number;
  kills: number;
  coreHp: number;
  coreMaxHp: number;

  playerHp: number;
  playerMaxHp: number;
  playerAlive: boolean;
  respawnIn: number;

  weapon: WeaponKind;
  ammo: number;
  magSize: number;
  reloading: boolean;
  reloadProgress: number;

  buildMode: boolean;
  selectedKind: TowerKind;
  selectedTower: SelectedTowerInfo | null;
  towerCount: number;

  pointerLocked: boolean;
  muted: boolean;
  showHelp: boolean;
  toasts: Toast[];
  stats: RunStats | null;
  fps: number;
}

const initial: UiState = {
  phase: 'menu',
  started: false,
  difficulty: 'normal',
  quality: 'high',

  wave: 0,
  totalWaves: 20,
  waveTimer: 0,
  waveHeadline: '',
  enemiesAlive: 0,
  enemiesRemaining: 0,

  credits: 0,
  score: 0,
  kills: 0,
  coreHp: 1200,
  coreMaxHp: 1200,

  playerHp: 120,
  playerMaxHp: 120,
  playerAlive: true,
  respawnIn: 0,

  weapon: 'rifle',
  ammo: 32,
  magSize: 32,
  reloading: false,
  reloadProgress: 0,

  buildMode: false,
  selectedKind: 'gatling',
  selectedTower: null,
  towerCount: 0,

  pointerLocked: false,
  muted: false,
  showHelp: false,
  toasts: [],
  stats: null,
  fps: 60,
};

export const useUiStore = create<UiState>(() => ({ ...initial }));

/** 値が変わったフィールドだけ更新する（不要な再描画を避ける） */
export function patchUi(partial: Partial<UiState>) {
  const cur = useUiStore.getState();
  let changed = false;
  for (const k of Object.keys(partial) as Array<keyof UiState>) {
    if (cur[k] !== partial[k]) {
      changed = true;
      break;
    }
  }
  if (changed) useUiStore.setState(partial);
}

export function resetUi() {
  useUiStore.setState({ ...initial });
}

let toastId = 1;
export function pushToast(text: string, tone: Toast['tone'] = 'info') {
  const t: Toast = { id: toastId++, text, tone };
  const list = [...useUiStore.getState().toasts, t].slice(-4);
  useUiStore.setState({ toasts: list });
  window.setTimeout(() => {
    useUiStore.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) }));
  }, 3200);
}
