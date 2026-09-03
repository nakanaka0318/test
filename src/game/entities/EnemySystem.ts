import * as THREE from 'three';
import {
  CELL_SIZE,
  CORE_RADIUS,
  ENEMIES,
  MAP_EXTENT,
  type EnemyDef,
  type EnemyKind,
} from '../config';
import { applyArmor, clamp, damp, randRange } from '../core/util';
import type { AudioManager } from '../core/Audio';
import type { Effects } from '../fx/Effects';
import type { HealthBars } from '../fx/HealthBars';
import type { GameMap } from '../world/map';
import type { Projectiles } from './Projectiles';
import type { PlayerController } from './PlayerController';
import type { TowerSystem } from './TowerSystem';
import { FLASH_MATERIAL, createEnemyModel, type EnemyModel } from './enemyModels';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  def: EnemyDef;
  active: boolean;
  hp: number;
  maxHp: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  model: EnemyModel;
  lane: number;
  wp: number;
  lateral: number;
  altitude: number;
  radius: number;
  height: number;
  flying: boolean;
  yaw: number;
  slowFactor: number;
  slowTimer: number;
  attackCd: number;
  rangedCd: number;
  flash: number;
  dying: number;
  walk: number;
  bornAt: number;
  spawnFade: number;
}

interface HitResult {
  enemy: Enemy;
  distance: number;
  point: THREE.Vector3;
  crit: boolean;
}

export interface EnemyUpdateContext {
  dt: number;
  player: PlayerController;
  towers: TowerSystem;
  projectiles: Projectiles;
  effects: Effects;
  audio: AudioManager;
  corePos: THREE.Vector3;
  damageCore: (amount: number) => void;
  onKill: (enemy: Enemy, byPlayer: boolean) => void;
  healthBars: HealthBars;
  camQuat: THREE.Quaternion;
  cameraPos: THREE.Vector3;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _oa = new THREE.Vector3();
const _ba = new THREE.Vector3();
const _perp = new THREE.Vector3();

/** XZ 平面の空間ハッシュ（近傍探索用） */
class SpatialHash {
  private cell: number;
  private cols: number;
  private buckets: number[][];

  constructor(cell: number, extent: number) {
    this.cell = cell;
    this.cols = Math.ceil((extent * 2 + 40) / cell) + 1;
    this.buckets = Array.from({ length: this.cols * this.cols }, () => []);
  }

  private idx(x: number, z: number) {
    const cx = clamp(Math.floor((x + MAP_EXTENT + 20) / this.cell), 0, this.cols - 1);
    const cz = clamp(Math.floor((z + MAP_EXTENT + 20) / this.cell), 0, this.cols - 1);
    return cz * this.cols + cx;
  }

  clear() {
    for (const b of this.buckets) b.length = 0;
  }

  insert(x: number, z: number, id: number) {
    this.buckets[this.idx(x, z)].push(id);
  }

  forEachNear(x: number, z: number, radius: number, cb: (id: number) => void) {
    const r = Math.ceil(radius / this.cell);
    const cx = clamp(Math.floor((x + MAP_EXTENT + 20) / this.cell), 0, this.cols - 1);
    const cz = clamp(Math.floor((z + MAP_EXTENT + 20) / this.cell), 0, this.cols - 1);
    for (let dz = -r; dz <= r; dz++) {
      const zz = cz + dz;
      if (zz < 0 || zz >= this.cols) continue;
      for (let dx = -r; dx <= r; dx++) {
        const xx = cx + dx;
        if (xx < 0 || xx >= this.cols) continue;
        const bucket = this.buckets[zz * this.cols + xx];
        for (let i = 0; i < bucket.length; i++) cb(bucket[i]);
      }
    }
  }
}

/** レイとカプセルの交差判定（iq 方式） */
function rayCapsule(
  ro: THREE.Vector3,
  rd: THREE.Vector3,
  pa: THREE.Vector3,
  pb: THREE.Vector3,
  ra: number,
): number {
  _ba.subVectors(pb, pa);
  _oa.subVectors(ro, pa);
  const baba = _ba.dot(_ba);
  const bard = _ba.dot(rd);
  const baoa = _ba.dot(_oa);
  const rdoa = rd.dot(_oa);
  const oaoa = _oa.dot(_oa);
  let a = baba - bard * bard;
  let b = baba * rdoa - baoa * bard;
  let c = baba * oaoa - baoa * baoa - ra * ra * baba;
  let h = b * b - a * c;
  if (h >= 0) {
    const t = (-b - Math.sqrt(h)) / a;
    const y = baoa + t * bard;
    if (y > 0 && y < baba) return t;
    // 端の球
    const oc = y <= 0 ? _oa : _c.subVectors(ro, pb);
    b = rd.dot(oc);
    c = oc.dot(oc) - ra * ra;
    h = b * b - c;
    if (h > 0) return -b - Math.sqrt(h);
  }
  return -1;
}

export class EnemySystem {
  readonly list: Enemy[] = [];
  private pools = new Map<EnemyKind, Enemy[]>();
  private scene: THREE.Scene;
  private map: GameMap;
  private hash = new SpatialHash(CELL_SIZE * 1.5, MAP_EXTENT);
  private nextId = 1;
  private castShadows: boolean;
  private time = 0;

  aliveCount = 0;
  /** 直近フレームで最もコアに近い敵の距離（BGM 用） */
  closestThreat = Infinity;

  constructor(scene: THREE.Scene, map: GameMap, castShadows: boolean) {
    this.scene = scene;
    this.map = map;
    this.castShadows = castShadows;
  }

  spawn(kind: EnemyKind, lane: number, hpScale: number): Enemy {
    const def = ENEMIES[kind];
    const pool = this.pools.get(kind) ?? [];
    let e = pool.pop();
    if (!e) {
      const model = createEnemyModel(kind, this.castShadows || def.elite === true);
      e = {
        id: 0,
        kind,
        def,
        active: false,
        hp: 0,
        maxHp: 0,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        model,
        lane: 0,
        wp: 1,
        lateral: 0,
        altitude: 0,
        radius: def.radius,
        height: def.height,
        flying: def.flying,
        yaw: 0,
        slowFactor: 1,
        slowTimer: 0,
        attackCd: 0,
        rangedCd: 0,
        flash: 0,
        dying: 0,
        walk: Math.random() * 10,
        bornAt: 0,
        spawnFade: 0,
      };
    }
    this.pools.set(kind, pool);

    const laneDef = this.map.lanes[lane % this.map.lanes.length];
    e.id = this.nextId++;
    e.active = true;
    e.lane = lane % this.map.lanes.length;
    e.wp = 1;
    e.maxHp = def.hp * hpScale;
    e.hp = e.maxHp;
    e.lateral = randRange(-CELL_SIZE * 1.15, CELL_SIZE * 1.15);
    e.altitude = def.flying ? randRange(7.5, 11.5) : 0;
    e.slowFactor = 1;
    e.slowTimer = 0;
    e.attackCd = randRange(0, 0.6);
    e.rangedCd = randRange(0.4, 1.6);
    e.flash = 0;
    e.dying = 0;
    e.spawnFade = 0.45;
    e.bornAt = this.time;
    e.vel.set(0, 0, 0);
    e.pos.copy(laneDef.spawn);
    e.pos.x += randRange(-CELL_SIZE, CELL_SIZE);
    e.pos.z += randRange(-CELL_SIZE, CELL_SIZE);
    e.pos.y = e.altitude;
    e.yaw = laneDef.angle;
    e.model.root.position.copy(e.pos);
    e.model.root.rotation.set(0, e.yaw, 0);
    e.model.root.scale.setScalar(0.01);
    e.model.root.visible = true;
    e.model.body.material = e.model.body.userData.baseMaterial ?? e.model.body.material;
    this.scene.add(e.model.root);
    this.list.push(e);
    return e;
  }

  private recycle(e: Enemy) {
    e.active = false;
    this.scene.remove(e.model.root);
    const pool = this.pools.get(e.kind) ?? [];
    pool.push(e);
    this.pools.set(e.kind, pool);
  }

  clear() {
    for (const e of this.list) this.recycle(e);
    this.list.length = 0;
    this.aliveCount = 0;
    this.pendingKills.length = 0;
  }

  capsuleA(e: Enemy, out: THREE.Vector3) {
    return out.set(e.pos.x, e.flying ? e.pos.y - e.height * 0.3 : e.pos.y + e.radius, e.pos.z);
  }

  capsuleB(e: Enemy, out: THREE.Vector3) {
    return out.set(
      e.pos.x,
      e.flying ? e.pos.y + e.height * 0.3 : e.pos.y + Math.max(e.height - e.radius, e.radius + 0.05),
      e.pos.z,
    );
  }

  centerOf(e: Enemy, out: THREE.Vector3) {
    return out.set(e.pos.x, e.flying ? e.pos.y : e.pos.y + e.height * 0.55, e.pos.z);
  }

  /* ---------------- 判定 ---------------- */

  /** レイキャスト（プレイヤーのヒットスキャン用）。距離順のヒット配列を返す */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, maxHits: number): HitResult[] {
    const hits: HitResult[] = [];
    for (const e of this.list) {
      if (!e.active || e.dying > 0) continue;
      // 大まかな球で足切り
      _a.set(e.pos.x - origin.x, e.pos.y + e.height * 0.5 - origin.y, e.pos.z - origin.z);
      const along = _a.dot(dir);
      if (along < -e.height || along > maxDist + e.height) continue;
      const perpSq = _a.lengthSq() - along * along;
      const rr = e.radius + e.height * 0.5;
      if (perpSq > rr * rr) continue;

      this.capsuleA(e, _b);
      this.capsuleB(e, _c);
      const t = rayCapsule(origin, dir, _b, _c, e.radius);
      if (t > 0 && t < maxDist) {
        const point = new THREE.Vector3().copy(origin).addScaledVector(dir, t);
        const critY = e.flying ? e.pos.y + e.height * 0.12 : e.pos.y + e.height * 0.68;
        hits.push({ enemy: e, distance: t, point, crit: point.y >= critY });
      }
      if (hits.length > 64) break;
    }
    hits.sort((x, y) => x.distance - y.distance);
    return hits.slice(0, maxHits);
  }

  /** 線分と敵の当たり判定（実体弾用） */
  sweepHit(from: THREE.Vector3, to: THREE.Vector3, radius: number): Enemy | null {
    _d.subVectors(to, from);
    const len = _d.length();
    if (len < 1e-5) return null;
    _d.divideScalar(len);
    let best: Enemy | null = null;
    let bestT = Infinity;
    for (const e of this.list) {
      if (!e.active || e.dying > 0) continue;
      this.capsuleA(e, _b);
      this.capsuleB(e, _c);
      const t = rayCapsule(from, _d, _b, _c, e.radius + radius);
      if (t >= 0 && t <= len && t < bestT) {
        bestT = t;
        best = e;
      }
    }
    return best;
  }

  /** 範囲ダメージ */
  splashDamage(center: THREE.Vector3, radius: number, damage: number, byPlayer = false) {
    for (const e of this.list) {
      if (!e.active || e.dying > 0) continue;
      this.centerOf(e, _a);
      const d = _a.distanceTo(center);
      if (d > radius + e.radius) continue;
      const falloff = clamp(1 - (d - e.radius) / radius, 0.28, 1);
      this.damage(e, damage * falloff, false, byPlayer ? 'player' : 'tower');
    }
  }

  /** 範囲内の敵を列挙（タワーの索敵用） */
  queryRange(x: number, z: number, radius: number, includeAir: boolean, cb: (e: Enemy) => void) {
    this.hash.forEachNear(x, z, radius + 2, (id) => {
      const e = this.list[id];
      if (!e || !e.active || e.dying > 0) return;
      if (!includeAir && e.flying) return;
      const dx = e.pos.x - x;
      const dz = e.pos.z - z;
      if (dx * dx + dz * dz <= radius * radius) cb(e);
    });
  }

  /* ---------------- ダメージ ---------------- */

  private pendingKills: Array<[Enemy, boolean]> = [];

  damage(e: Enemy, amount: number, _crit: boolean, source: 'player' | 'tower') {
    if (!e.active || e.dying > 0) return 0;
    const dealt = Math.min(e.hp, applyArmor(amount, e.def.armor));
    e.hp -= dealt;
    e.flash = 0.07;
    if (e.model.body.material !== FLASH_MATERIAL) {
      if (!e.model.body.userData.baseMaterial) e.model.body.userData.baseMaterial = e.model.body.material;
      e.model.body.material = FLASH_MATERIAL;
    }
    if (e.hp <= 0) {
      e.dying = 0.55;
      e.hp = 0;
      this.pendingKills.push([e, source === 'player']);
    }
    return dealt;
  }

  slow(e: Enemy, factor: number, duration: number) {
    e.slowFactor = Math.min(e.slowFactor, 1 - factor);
    e.slowTimer = Math.max(e.slowTimer, duration);
  }

  /* ---------------- 更新 ---------------- */

  update(ctx: EnemyUpdateContext) {
    const { dt, effects } = ctx;
    this.time += dt;
    this.closestThreat = Infinity;

    // 前フレームで退場した個体を除去してからハッシュを作る
    // （ハッシュはインデックス参照なので、更新中はリストを変更しない）
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (!this.list[i].active) this.list.splice(i, 1);
    }
    this.hash.clear();
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (e.dying <= 0) this.hash.insert(e.pos.x, e.pos.z, i);
    }

    let alive = 0;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];

      if (e.flash > 0) {
        e.flash -= dt;
        if (e.flash <= 0 && e.model.body.userData.baseMaterial) {
          e.model.body.material = e.model.body.userData.baseMaterial as THREE.Material;
        }
      }

      if (e.dying > 0) {
        e.dying -= dt;
        const k = clamp(e.dying / 0.55, 0, 1);
        e.model.root.scale.setScalar(k * k);
        e.model.root.rotation.z += dt * 6 * (1 - k);
        e.model.root.position.y -= dt * (e.flying ? 12 : 1.5);
        if (e.dying <= 0) this.recycle(e);
        continue;
      }

      alive++;
      this.stepEnemy(e, i, ctx);

      // HPバー
      if (e.hp < e.maxHp - 0.01) {
        const y = e.flying ? e.pos.y + e.height * 0.7 : e.pos.y + e.height + 0.45;
        _a.set(e.pos.x, y, e.pos.z);
        const w = e.def.elite ? e.radius * 2.6 : Math.max(1, e.radius * 2.2);
        ctx.healthBars.add(_a, e.hp / e.maxHp, w, ctx.camQuat, e.def.elite);
      }

      const distToCore = Math.hypot(e.pos.x - ctx.corePos.x, e.pos.z - ctx.corePos.z);
      if (distToCore < this.closestThreat) this.closestThreat = distToCore;
    }

    this.aliveCount = alive;

    // 撃破処理
    if (this.pendingKills.length) {
      for (const [e, byPlayer] of this.pendingKills) {
        this.centerOf(e, _a);
        const size = e.def.elite ? (e.kind === 'titan' ? 7 : 4) : 1.7;
        effects.explosion(_a, size, e.def.accent, 0x3a3f4a);
        ctx.audio.explosion(clamp(size / 4, 0.35, 1.6), _a);
        ctx.onKill(e, byPlayer);
      }
      this.pendingKills.length = 0;
    }
  }

  private stepEnemy(e: Enemy, index: number, ctx: EnemyUpdateContext) {
    const { dt, player, corePos } = ctx;

    if (e.spawnFade > 0) {
      e.spawnFade -= dt;
      const k = clamp(1 - e.spawnFade / 0.45, 0, 1);
      e.model.root.scale.setScalar(k);
    }

    if (e.slowTimer > 0) {
      e.slowTimer -= dt;
      if (e.slowTimer <= 0) e.slowFactor = 1;
    }

    const lane = this.map.lanes[e.lane];
    const speed = e.def.speed * e.slowFactor;

    // --- 目標地点 ---
    const distCoreXZ = Math.hypot(e.pos.x - corePos.x, e.pos.z - corePos.z);
    const stopRange = CORE_RADIUS + e.def.attackRange;
    let moving = true;

    if (distCoreXZ <= stopRange) {
      moving = false;
      // コアを攻撃
      e.attackCd -= dt;
      if (e.attackCd <= 0) {
        e.attackCd = e.def.attackInterval;
        ctx.damageCore(e.def.coreDamage);
        this.centerOf(e, _a);
        _b.set(corePos.x, 3.2, corePos.z);
        ctx.effects.tracer(_a, _b, e.def.accent, 0.09, 0.14);
        ctx.effects.particles.sparks(_b, _c.set(0, 1, 0), 5, { color: e.def.accent, speed: 6, size: 0.8 });
      }
      _d.set(corePos.x - e.pos.x, 0, corePos.z - e.pos.z).normalize();
      e.vel.x = damp(e.vel.x, 0, 8, dt);
      e.vel.z = damp(e.vel.z, 0, 8, dt);
    } else if (e.flying) {
      _d.set(corePos.x - e.pos.x, 0, corePos.z - e.pos.z).normalize();
      e.vel.x = damp(e.vel.x, _d.x * speed, 4, dt);
      e.vel.z = damp(e.vel.z, _d.z * speed, 4, dt);
    } else {
      // 経路追従
      const pts = lane.points;
      let target = _a;
      if (e.wp < pts.length) {
        const p = pts[e.wp];
        const prev = pts[Math.max(0, e.wp - 1)];
        _perp.set(p.z - prev.z, 0, -(p.x - prev.x));
        if (_perp.lengthSq() < 1e-6) _perp.set(1, 0, 0);
        _perp.normalize();
        const lateralScale = e.wp === pts.length - 1 ? 0.45 : 1;
        target.set(p.x + _perp.x * e.lateral * lateralScale, 0, p.z + _perp.z * e.lateral * lateralScale);
        if (Math.hypot(target.x - e.pos.x, target.z - e.pos.z) < CELL_SIZE * 0.85) e.wp++;
      } else {
        target.set(corePos.x, 0, corePos.z);
      }
      _d.set(target.x - e.pos.x, 0, target.z - e.pos.z);
      if (_d.lengthSq() > 1e-6) _d.normalize();
      e.vel.x = damp(e.vel.x, _d.x * speed, 5.5, dt);
      e.vel.z = damp(e.vel.z, _d.z * speed, 5.5, dt);
    }

    // --- 分離（重なり防止） ---
    let sepX = 0;
    let sepZ = 0;
    this.hash.forEachNear(e.pos.x, e.pos.z, e.radius * 2 + 1.6, (id) => {
      if (id === index) return;
      const o = this.list[id];
      if (!o || !o.active || o.dying > 0) return;
      if (o.flying !== e.flying) return;
      const dx = e.pos.x - o.pos.x;
      const dz = e.pos.z - o.pos.z;
      const distSq = dx * dx + dz * dz;
      const minD = (e.radius + o.radius) * 0.95;
      if (distSq > minD * minD || distSq < 1e-6) return;
      const dist = Math.sqrt(distSq);
      const push = (minD - dist) / minD;
      const w = o.def.elite && !e.def.elite ? 2.2 : 1;
      sepX += (dx / dist) * push * w;
      sepZ += (dz / dist) * push * w;
    });
    e.pos.x += sepX * dt * 13;
    e.pos.z += sepZ * dt * 13;

    // --- 積分 ---
    e.pos.x += e.vel.x * dt;
    e.pos.z += e.vel.z * dt;
    e.pos.x = clamp(e.pos.x, -MAP_EXTENT - 6, MAP_EXTENT + 6);
    e.pos.z = clamp(e.pos.z, -MAP_EXTENT - 6, MAP_EXTENT + 6);

    if (e.flying) {
      const bob = Math.sin(this.time * 2.2 + e.id) * 0.5;
      e.pos.y = damp(e.pos.y, e.altitude + bob, 3, dt);
    } else {
      e.pos.y = 0;
    }

    // --- 向き ---
    const vlen = Math.hypot(e.vel.x, e.vel.z);
    if (vlen > 0.4) {
      const targetYaw = Math.atan2(e.vel.x, e.vel.z);
      let delta = targetYaw - e.yaw;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      e.yaw += delta * Math.min(1, dt * 8);
    } else if (!moving) {
      const targetYaw = Math.atan2(corePos.x - e.pos.x, corePos.z - e.pos.z);
      let delta = targetYaw - e.yaw;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      e.yaw += delta * Math.min(1, dt * 5);
    }

    // --- アニメーション ---
    e.walk += dt * (2.6 + vlen * 1.35);
    const root = e.model.root;
    root.position.set(e.pos.x, e.pos.y, e.pos.z);
    root.rotation.y = e.yaw;
    if (e.flying) {
      root.rotation.z = Math.sin(this.time * 1.7 + e.id) * 0.12;
      root.rotation.x = -vlen * 0.03;
      for (const r of e.model.rotors) r.rotation.y += dt * 26;
    } else {
      const bob = Math.abs(Math.sin(e.walk)) * (0.055 + vlen * 0.012) * e.height;
      root.position.y = e.pos.y + bob;
      root.rotation.x = clamp(vlen * 0.016, 0, 0.22);
      root.rotation.z = Math.sin(e.walk) * 0.035;
      if (e.model.legs.length === 2) {
        const swing = Math.sin(e.walk) * clamp(vlen * 0.14, 0.08, 0.72);
        e.model.legs[0].rotation.x = swing;
        e.model.legs[1].rotation.x = -swing;
      }
    }
    if (e.spawnFade <= 0) root.scale.setScalar(1);

    // --- プレイヤーへの接触ダメージ ---
    if (player.alive) {
      const dx = e.pos.x - player.position.x;
      const dz = e.pos.z - player.position.z;
      const dy = Math.abs((e.flying ? e.pos.y : e.pos.y + e.height * 0.5) - player.position.y);
      const reach = e.radius + player.radius + 0.5;
      if (dx * dx + dz * dz < reach * reach && dy < e.height * 0.5 + 1.4) {
        player.takeDamage(e.def.contactDamage * dt);
      }
    }

    // --- 遠距離攻撃 ---
    const ranged = e.def.ranged;
    if (ranged) {
      e.rangedCd -= dt;
      if (e.rangedCd <= 0) {
        let targetPos: THREE.Vector3 | null = null;
        if (player.alive) {
          const dp = Math.hypot(e.pos.x - player.position.x, e.pos.z - player.position.z);
          if (dp < ranged.range) targetPos = _b.copy(player.position);
        }
        if (!targetPos) {
          const tw = ctx.towers.nearestTower(e.pos.x, e.pos.z, ranged.range);
          if (tw) targetPos = _b.set(tw.pos.x, 2.2, tw.pos.z);
        }
        if (targetPos) {
          e.rangedCd = ranged.interval * randRange(0.85, 1.2);
          this.centerOf(e, _a);
          _a.y += e.height * 0.18;
          _c.subVectors(targetPos, _a).normalize();
          _c.x += randRange(-ranged.spread, ranged.spread);
          _c.y += randRange(-ranged.spread, ranged.spread);
          _c.z += randRange(-ranged.spread, ranged.spread);
          _c.normalize().multiplyScalar(ranged.speed);
          ctx.projectiles.spawn({
            team: 'enemy',
            from: _a,
            velocity: _c,
            damage: ranged.damage,
            color: e.def.accent,
            size: e.kind === 'titan' ? 0.34 : 0.2,
            life: 3,
            splash: e.kind === 'titan' ? 2.6 : 0,
          });
          ctx.audio.enemyShot(_a);
          ctx.effects.particles.sparks(_a, _c.clone().normalize(), 3, {
            color: e.def.accent,
            speed: 5,
            size: 0.6,
            life: 0.4,
          });
        } else {
          e.rangedCd = 0.4;
        }
      }
    }
  }
}
