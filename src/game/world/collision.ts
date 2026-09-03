import * as THREE from 'three';
import { CELL_SIZE, CORE_HEIGHT, CORE_RADIUS, GRID_SIZE, MAP_EXTENT } from '../config';
import { CELL_BLOCKED, GameMap, cellToWorldX, cellToWorldZ } from './map';

const WALL_HEIGHT = 5.5;
const HALF = (GRID_SIZE - 1) / 2;

export interface WorldHit {
  distance: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  kind: 'ground' | 'wall' | 'core';
}

/** 地形・障害物との衝突（DDA によるグリッド走査） */
export class WorldCollision {
  private map: GameMap;

  constructor(map: GameMap) {
    this.map = map;
  }

  /** レイと地形の交差。無ければ null */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): WorldHit | null {
    let best: WorldHit | null = null;

    // 地面
    if (dir.y < -1e-5 && origin.y > 0) {
      const t = -origin.y / dir.y;
      if (t > 0 && t < maxDist) {
        best = {
          distance: t,
          point: new THREE.Vector3().copy(origin).addScaledVector(dir, t),
          normal: new THREE.Vector3(0, 1, 0),
          kind: 'ground',
        };
      }
    }

    // コア（円柱）
    const coreT = this.rayCylinder(origin, dir, 0, 0, CORE_RADIUS + 1.4, CORE_HEIGHT + 1.5);
    if (coreT > 0 && coreT < maxDist && (!best || coreT < best.distance)) {
      const p = new THREE.Vector3().copy(origin).addScaledVector(dir, coreT);
      best = {
        distance: coreT,
        point: p,
        normal: new THREE.Vector3(p.x, 0, p.z).normalize(),
        kind: 'core',
      };
    }

    // 壁・障害物
    const limit = best ? Math.min(best.distance, maxDist) : maxDist;
    const wall = this.raycastWalls(origin, dir, limit);
    if (wall && (!best || wall.distance < best.distance)) best = wall;

    return best;
  }

  private rayCylinder(
    ro: THREE.Vector3,
    rd: THREE.Vector3,
    cx: number,
    cz: number,
    radius: number,
    height: number,
  ): number {
    const ox = ro.x - cx;
    const oz = ro.z - cz;
    const a = rd.x * rd.x + rd.z * rd.z;
    if (a < 1e-8) return -1;
    const b = 2 * (ox * rd.x + oz * rd.z);
    const c = ox * ox + oz * oz - radius * radius;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return -1;
    const sq = Math.sqrt(disc);
    for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
      if (t <= 0) continue;
      const y = ro.y + rd.y * t;
      if (y >= 0 && y <= height) return t;
    }
    return -1;
  }

  private raycastWalls(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): WorldHit | null {
    let x = Math.floor(origin.x / CELL_SIZE + HALF + 0.5);
    let z = Math.floor(origin.z / CELL_SIZE + HALF + 0.5);
    const stepX = dir.x > 0 ? 1 : -1;
    const stepZ = dir.z > 0 ? 1 : -1;
    const invX = dir.x !== 0 ? 1 / Math.abs(dir.x) : Infinity;
    const invZ = dir.z !== 0 ? 1 / Math.abs(dir.z) : Infinity;

    const cellMinX = (x - HALF - 0.5) * CELL_SIZE;
    const cellMinZ = (z - HALF - 0.5) * CELL_SIZE;
    let tMaxX =
      dir.x === 0
        ? Infinity
        : ((dir.x > 0 ? cellMinX + CELL_SIZE - origin.x : origin.x - cellMinX) / Math.abs(dir.x));
    let tMaxZ =
      dir.z === 0
        ? Infinity
        : ((dir.z > 0 ? cellMinZ + CELL_SIZE - origin.z : origin.z - cellMinZ) / Math.abs(dir.z));
    const tDeltaX = CELL_SIZE * invX;
    const tDeltaZ = CELL_SIZE * invZ;

    let t = 0;
    let axis: 'x' | 'z' = 'x';
    for (let i = 0; i < 220 && t < maxDist; i++) {
      if (x >= 0 && z >= 0 && x < GRID_SIZE && z < GRID_SIZE && this.map.get(x, z) === CELL_BLOCKED) {
        const y = origin.y + dir.y * t;
        if (y >= 0 && y <= WALL_HEIGHT) {
          return {
            distance: t,
            point: new THREE.Vector3().copy(origin).addScaledVector(dir, t),
            normal:
              axis === 'x'
                ? new THREE.Vector3(-Math.sign(dir.x), 0, 0)
                : new THREE.Vector3(0, 0, -Math.sign(dir.z)),
            kind: 'wall',
          };
        }
      }
      if (tMaxX < tMaxZ) {
        t = tMaxX;
        tMaxX += tDeltaX;
        x += stepX;
        axis = 'x';
      } else {
        t = tMaxZ;
        tMaxZ += tDeltaZ;
        z += stepZ;
        axis = 'z';
      }
    }
    return null;
  }

  /** 円と地形の押し出し（XZ 平面） */
  resolveCircle(pos: THREE.Vector3, radius: number) {
    const cx = Math.round(pos.x / CELL_SIZE + HALF);
    const cz = Math.round(pos.z / CELL_SIZE + HALF);
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const gx = cx + dx;
        const gz = cz + dz;
        if (this.map.get(gx, gz) !== CELL_BLOCKED) continue;
        const minX = cellToWorldX(gx) - CELL_SIZE / 2;
        const maxX = minX + CELL_SIZE;
        const minZ = cellToWorldZ(gz) - CELL_SIZE / 2;
        const maxZ = minZ + CELL_SIZE;
        const nx = Math.max(minX, Math.min(pos.x, maxX));
        const nz = Math.max(minZ, Math.min(pos.z, maxZ));
        const ddx = pos.x - nx;
        const ddz = pos.z - nz;
        const distSq = ddx * ddx + ddz * ddz;
        if (distSq >= radius * radius) continue;
        const dist = Math.sqrt(distSq);
        if (dist < 1e-5) {
          // セル中心から押し出す
          const ox = pos.x - cellToWorldX(gx);
          const oz = pos.z - cellToWorldZ(gz);
          const l = Math.hypot(ox, oz) || 1;
          pos.x += (ox / l) * radius;
          pos.z += (oz / l) * radius;
        } else {
          pos.x += (ddx / dist) * (radius - dist);
          pos.z += (ddz / dist) * (radius - dist);
        }
      }
    }

    // コア
    const coreDist = Math.hypot(pos.x, pos.z);
    const coreR = CORE_RADIUS + 1.6 + radius;
    if (coreDist < coreR && pos.y < CORE_HEIGHT) {
      const l = coreDist || 1;
      pos.x = (pos.x / l) * coreR;
      pos.z = (pos.z / l) * coreR;
    }

    const bound = MAP_EXTENT - CELL_SIZE - radius;
    pos.x = Math.max(-bound, Math.min(bound, pos.x));
    pos.z = Math.max(-bound, Math.min(bound, pos.z));
  }
}
