import * as THREE from 'three';

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const randRange = (a: number, b: number) => a + Math.random() * (b - a);
export const randInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** フレームレート非依存の指数補間 */
export const damp = (a: number, b: number, lambda: number, dt: number) =>
  lerp(a, b, 1 - Math.exp(-lambda * dt));

export const smoothstep = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** ランダムな単位ベクトル（球面一様） */
export function randomDirection(out: THREE.Vector3): THREE.Vector3 {
  const z = Math.random() * 2 - 1;
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return out.set(r * Math.cos(a), z, r * Math.sin(a));
}

/** 円錐状にランダムなばらつきを与える */
export function spreadDirection(dir: THREE.Vector3, spread: number, out: THREE.Vector3): THREE.Vector3 {
  out.copy(dir);
  if (spread <= 0) return out;
  const up = Math.abs(dir.y) > 0.95 ? UNIT_X : UNIT_Y;
  TMP_A.crossVectors(dir, up).normalize();
  TMP_B.crossVectors(dir, TMP_A).normalize();
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * spread;
  out.addScaledVector(TMP_A, Math.cos(a) * r).addScaledVector(TMP_B, Math.sin(a) * r).normalize();
  return out;
}

const UNIT_X = new THREE.Vector3(1, 0, 0);
const UNIT_Y = new THREE.Vector3(0, 1, 0);
const TMP_A = new THREE.Vector3();
const TMP_B = new THREE.Vector3();

/** 装甲を考慮したダメージ計算（最低でも 25% は通る） */
export function applyArmor(damage: number, armor: number): number {
  return Math.max(damage * 0.25, damage - armor);
}

/** 使い回し用オブジェクトプール */
export class Pool<T> {
  private items: T[] = [];
  private factory: () => T;
  constructor(factory: () => T, prefill = 0) {
    this.factory = factory;
    for (let i = 0; i < prefill; i++) this.items.push(factory());
  }
  obtain(): T {
    return this.items.pop() ?? this.factory();
  }
  release(item: T) {
    this.items.push(item);
  }
}
