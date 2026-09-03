import * as THREE from 'three';
import { CELL_SIZE, GRID_SIZE, PATH_HALF_WIDTH } from '../config';

export const CELL_EMPTY = 0;
export const CELL_PATH = 1;
export const CELL_BLOCKED = 2;
export const CELL_CORE = 3;

export type CellType = 0 | 1 | 2 | 3;

const HALF = (GRID_SIZE - 1) / 2;

export const cellToWorldX = (cx: number) => (cx - HALF) * CELL_SIZE;
export const cellToWorldZ = (cy: number) => (cy - HALF) * CELL_SIZE;
export const worldToCellX = (x: number) => Math.round(x / CELL_SIZE + HALF);
export const worldToCellZ = (z: number) => Math.round(z / CELL_SIZE + HALF);

export interface Lane {
  /** 侵攻経路（ワールド座標、y=0） */
  points: THREE.Vector3[];
  /** 出撃ゲートのワールド座標 */
  spawn: THREE.Vector3;
  /** 経路上での向き（ゲートの回転用） */
  angle: number;
}

export interface Prop {
  x: number;
  z: number;
  radius: number;
  height: number;
  kind: 'rock' | 'crate' | 'pillar';
  rotation: number;
}

/** 中心を軸に 90 度回転（グリッド座標） */
function rot(p: [number, number]): [number, number] {
  return [GRID_SIZE - 1 - p[1], p[0]];
}

const BASE_LANE: [number, number][] = [
  [20, 0],
  [20, 8],
  [31, 8],
  [31, 20],
  [20, 20],
];

export class GameMap {
  readonly cells: Uint8Array;
  /** 通路セルの進行方向（ラジアン、コアに向かう向き） */
  readonly pathDir: Float32Array;
  readonly lanes: Lane[] = [];
  readonly props: Prop[] = [];
  readonly coreCell: [number, number] = [HALF, HALF];

  constructor() {
    this.cells = new Uint8Array(GRID_SIZE * GRID_SIZE);
    this.pathDir = new Float32Array(GRID_SIZE * GRID_SIZE);

    // 4 本のレーンを 90 度ずつ回転させて生成する
    let lanePts: [number, number][] = BASE_LANE;
    for (let i = 0; i < 4; i++) {
      this.carveLane(lanePts);
      const pts = lanePts.map((p) => new THREE.Vector3(cellToWorldX(p[0]), 0, cellToWorldZ(p[1])));
      const dir = pts[1].clone().sub(pts[0]);
      this.lanes.push({
        points: pts,
        spawn: pts[0].clone(),
        angle: Math.atan2(dir.x, dir.z),
      });
      lanePts = lanePts.map(rot);
    }

    // 外周を壁で囲う（ゲート部分は開ける）
    for (let i = 0; i < GRID_SIZE; i++) {
      for (const [x, y] of [
        [i, 0],
        [i, GRID_SIZE - 1],
        [0, i],
        [GRID_SIZE - 1, i],
      ] as [number, number][]) {
        if (this.get(x, y) !== CELL_PATH) this.set(x, y, CELL_BLOCKED);
      }
    }

    // コア周辺
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        if (dx * dx + dy * dy <= 5) this.set(HALF + dx, HALF + dy, CELL_CORE);
      }
    }

    this.scatterProps();
  }

  get(x: number, y: number): CellType {
    if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return CELL_BLOCKED;
    return this.cells[y * GRID_SIZE + x] as CellType;
  }

  set(x: number, y: number, v: CellType) {
    if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return;
    this.cells[y * GRID_SIZE + x] = v;
  }

  isBuildable(x: number, y: number): boolean {
    return this.get(x, y) === CELL_EMPTY;
  }

  private carveLane(pts: [number, number][]) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      const angle = Math.atan2(x1 - x0, y1 - y0);
      for (let s = 0; s <= steps; s++) {
        const t = steps === 0 ? 0 : s / steps;
        const cx = Math.round(x0 + (x1 - x0) * t);
        const cy = Math.round(y0 + (y1 - y0) * t);
        for (let dx = -PATH_HALF_WIDTH; dx <= PATH_HALF_WIDTH; dx++) {
          for (let dy = -PATH_HALF_WIDTH; dy <= PATH_HALF_WIDTH; dy++) {
            this.set(cx + dx, cy + dy, CELL_PATH);
            const idx = (cy + dy) * GRID_SIZE + (cx + dx);
            if (idx >= 0 && idx < this.pathDir.length) this.pathDir[idx] = angle;
          }
        }
      }
    }
  }

  /** 岩・コンテナなどの障害物を配置（見た目とカバーを兼ねる） */
  private scatterProps() {
    const candidates: [number, number][] = [];
    for (let y = 3; y < GRID_SIZE - 3; y++) {
      for (let x = 3; x < GRID_SIZE - 3; x++) {
        if (this.get(x, y) !== CELL_EMPTY) continue;
        // 通路に隣接するセルは建築用に残す
        let nearPath = false;
        for (let dx = -1; dx <= 1 && !nearPath; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (this.get(x + dx, y + dy) === CELL_PATH) {
              nearPath = true;
              break;
            }
          }
        }
        if (!nearPath) candidates.push([x, y]);
      }
    }

    // 決定論的に間引いて配置する
    let seed = 0x1a2b3c4d;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const kinds: Prop['kind'][] = ['rock', 'crate', 'pillar'];
    for (const [x, y] of candidates) {
      if (rnd() > 0.055) continue;
      if (this.get(x, y) !== CELL_EMPTY) continue;
      const kind = kinds[Math.floor(rnd() * kinds.length)];
      this.set(x, y, CELL_BLOCKED);
      this.props.push({
        x: cellToWorldX(x),
        z: cellToWorldZ(y),
        radius: kind === 'pillar' ? 0.85 : 1.25,
        height: kind === 'pillar' ? 5.5 : kind === 'crate' ? 1.9 : 1.5 + rnd() * 1.2,
        kind,
        rotation: rnd() * Math.PI * 2,
      });
    }
  }
}
