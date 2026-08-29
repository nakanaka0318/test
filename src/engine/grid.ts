import { GRID_SIZE } from '../data/characters';
import type { Facing, RangeShape } from '../types';

export interface Cell { x: number; y: number; }

export const DIR_VEC: Record<Facing, Cell> = {
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  E: { x: 1, y: 0 },
  W: { x: -1, y: 0 },
};

export function cellKey(c: Cell): string {
  return `${c.x},${c.y}`;
}

export function inBounds(c: Cell): boolean {
  return c.x >= 0 && c.x < GRID_SIZE && c.y >= 0 && c.y < GRID_SIZE;
}

export function chebyshevDist(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function euclidDist(a: Cell, b: Cell): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 指定した形状(RangeShape)がグリッド上で占めるセル一覧を返す。
 * origin: 発動者の位置, facing: 発動者の向き, targetCell: originatesFromSelfがfalseの場合の中心
 */
export function cellsForShape(origin: Cell, facing: Facing, shape: RangeShape, targetCell?: Cell): Cell[] {
  const cells: Cell[] = [];
  const center = shape.originatesFromSelf ? origin : (targetCell ?? origin);
  switch (shape.kind) {
    case 'self': {
      cells.push({ ...origin });
      break;
    }
    case 'circle': {
      const r = shape.radius ?? 3;
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.round(Math.hypot(dx, dy)) <= r) cells.push({ x: center.x + dx, y: center.y + dy });
        }
      }
      break;
    }
    case 'square': {
      const s = shape.size ?? 2;
      for (let dx = -s; dx <= s; dx++) {
        for (let dy = -s; dy <= s; dy++) cells.push({ x: center.x + dx, y: center.y + dy });
      }
      break;
    }
    case 'rect': {
      const w = shape.w ?? 3;
      const h = shape.h ?? 3;
      const dir = DIR_VEC[facing];
      const perp: Cell = dir.x !== 0 ? { x: 0, y: 1 } : { x: 1, y: 0 };
      const half = Math.floor(w / 2);
      for (let along = 1; along <= h; along++) {
        for (let side = -half; side <= half; side++) {
          cells.push({ x: origin.x + dir.x * along + perp.x * side, y: origin.y + dir.y * along + perp.y * side });
        }
      }
      break;
    }
    case 'line': {
      const len = shape.h ?? 5;
      const dir = DIR_VEC[facing];
      for (let along = 1; along <= len; along++) {
        cells.push({ x: origin.x + dir.x * along, y: origin.y + dir.y * along });
      }
      break;
    }
    case 'fan': {
      const r = shape.radius ?? 3;
      const angle = shape.angleDeg ?? 90;
      const dir = DIR_VEC[facing];
      const baseAngle = Math.atan2(dir.y, dir.x);
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          const dist = Math.hypot(dx, dy);
          if (dist === 0 || dist > r) continue;
          const a = Math.atan2(dy, dx);
          let diff = Math.abs(a - baseAngle);
          if (diff > Math.PI) diff = 2 * Math.PI - diff;
          if (diff <= ((angle / 2) * Math.PI) / 180) cells.push({ x: origin.x + dx, y: origin.y + dy });
        }
      }
      break;
    }
    case 'none':
      break;
  }
  return cells.filter(inBounds);
}

/** originからtargetへ向かう直線上のセル一覧（ヒーラーのパッシブ判定などに使用） */
export function lineBetween(origin: Cell, target: Cell): Cell[] {
  const cells: Cell[] = [];
  const dx = Math.sign(target.x - origin.x);
  const dy = Math.sign(target.y - origin.y);
  if (Math.abs(target.x - origin.x) !== Math.abs(target.y - origin.y) && dx !== 0 && dy !== 0) {
    return cells; // 斜め45度以外は直線とみなさない
  }
  let cur = { x: origin.x + dx, y: origin.y + dy };
  let guard = 0;
  while ((cur.x !== target.x || cur.y !== target.y) && guard < GRID_SIZE * 2) {
    cells.push({ ...cur });
    cur = { x: cur.x + dx, y: cur.y + dy };
    guard++;
  }
  return cells;
}

export function facingToward(from: Cell, to: Cell): Facing {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'E' : 'W';
  return dy > 0 ? 'S' : 'N';
}

export const CORNERS: Cell[] = [
  { x: 0, y: 0 },
  { x: GRID_SIZE - 1, y: 0 },
  { x: 0, y: GRID_SIZE - 1 },
  { x: GRID_SIZE - 1, y: GRID_SIZE - 1 },
];
