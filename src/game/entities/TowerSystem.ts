import * as THREE from 'three';
import {
  CELL_SIZE,
  GRID_SIZE,
  TOWERS,
  type TowerDef,
  type TowerKind,
} from '../config';
import { clamp, damp } from '../core/util';
import type { AudioManager } from '../core/Audio';
import type { Effects } from '../fx/Effects';
import type { HealthBars } from '../fx/HealthBars';
import type { GameMap } from '../world/map';
import { cellToWorldX, cellToWorldZ } from '../world/map';
import type { Enemy, EnemySystem } from './EnemySystem';
import type { Projectiles } from './Projectiles';

export interface Tower {
  id: number;
  kind: TowerKind;
  def: TowerDef;
  level: number;
  cell: [number, number];
  pos: THREE.Vector3;
  hp: number;
  maxHp: number;
  cooldown: number;
  yaw: number;
  pitch: number;
  target: Enemy | null;
  root: THREE.Group;
  head: THREE.Object3D;
  barrel: THREE.Object3D;
  muzzle: THREE.Object3D;
  spinner: THREE.Object3D | null;
  ring: THREE.Mesh | null;
  recoil: number;
  spin: number;
  firing: number;
  invested: number;
  buildAnim: number;
  kills: number;
}

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _dir = new THREE.Vector3();

const sharedGeo = {
  baseCyl: new THREE.CylinderGeometry(1.2, 1.42, 0.55, 10),
  pedestal: new THREE.CylinderGeometry(0.62, 0.82, 0.72, 10),
  box: new THREE.BoxGeometry(1, 1, 1),
  barrel: new THREE.CylinderGeometry(0.13, 0.15, 1, 8),
  bigBarrel: new THREE.CylinderGeometry(0.3, 0.36, 1, 10),
  sphere: new THREE.SphereGeometry(0.5, 12, 8),
  torus: new THREE.TorusGeometry(0.5, 0.09, 6, 16),
  oct: new THREE.OctahedronGeometry(0.5, 0),
  ring: new THREE.RingGeometry(0.97, 1, 48),
};

export class TowerSystem {
  readonly towers: Tower[] = [];
  private scene: THREE.Scene;
  private map: GameMap;
  private occupied = new Set<number>();
  private nextId = 1;
  private baseMat: THREE.MeshStandardMaterial;
  private time = 0;

  constructor(scene: THREE.Scene, map: GameMap) {
    this.scene = scene;
    this.map = map;
    this.baseMat = new THREE.MeshStandardMaterial({
      color: 0x4c556b,
      roughness: 0.55,
      metalness: 0.65,
      flatShading: true,
    });
  }

  /* ---------------- 建設 ---------------- */

  cellIndex(cx: number, cy: number) {
    return cy * GRID_SIZE + cx;
  }

  canPlace(cx: number, cy: number): boolean {
    return this.map.isBuildable(cx, cy) && !this.occupied.has(this.cellIndex(cx, cy));
  }

  towerAt(cx: number, cy: number): Tower | null {
    return this.towers.find((t) => t.cell[0] === cx && t.cell[1] === cy) ?? null;
  }

  place(kind: TowerKind, cx: number, cy: number): Tower | null {
    if (!this.canPlace(cx, cy)) return null;
    const def = TOWERS[kind];
    const root = new THREE.Group();
    const pos = new THREE.Vector3(cellToWorldX(cx), 0, cellToWorldZ(cy));
    root.position.copy(pos);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: def.color,
      roughness: 0.56,
      metalness: 0.42,
      flatShading: true,
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: def.accent,
      // 発光色は彩度の高い本体色にして白飛びを避ける
      emissive: def.color,
      emissiveIntensity: 1.35,
      roughness: 0.38,
    });

    const base = new THREE.Mesh(sharedGeo.baseCyl, this.baseMat);
    base.position.y = 0.27;
    base.castShadow = true;
    base.receiveShadow = true;
    root.add(base);

    const pedestal = new THREE.Mesh(sharedGeo.pedestal, this.baseMat);
    pedestal.position.y = 0.85;
    pedestal.castShadow = true;
    root.add(pedestal);

    const head = new THREE.Group();
    head.position.y = 1.28;
    root.add(head);

    let barrel: THREE.Object3D = head;
    let spinner: THREE.Object3D | null = null;
    const muzzle = new THREE.Object3D();

    if (kind === 'gatling') {
      const housing = new THREE.Mesh(sharedGeo.box, bodyMat);
      housing.scale.set(0.9, 0.62, 1.0);
      housing.castShadow = true;
      head.add(housing);
      const spin = new THREE.Group();
      spin.position.z = 0.55;
      head.add(spin);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const b = new THREE.Mesh(sharedGeo.barrel, this.baseMat);
        b.scale.set(1, 1.5, 1);
        b.rotation.x = Math.PI / 2;
        b.position.set(Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0.65);
        spin.add(b);
      }
      const eye = new THREE.Mesh(sharedGeo.box, glowMat);
      eye.scale.set(0.44, 0.11, 0.06);
      eye.position.set(0, 0.2, 0.52);
      head.add(eye);
      spinner = spin;
      barrel = spin;
      muzzle.position.set(0, 0.06, 1.55);
      head.add(muzzle);
    } else if (kind === 'cannon') {
      const housing = new THREE.Mesh(sharedGeo.box, bodyMat);
      housing.scale.set(1.1, 0.78, 1.0);
      housing.castShadow = true;
      head.add(housing);
      const tube = new THREE.Mesh(sharedGeo.bigBarrel, this.baseMat);
      tube.scale.set(1, 1.9, 1);
      tube.rotation.x = Math.PI / 2;
      tube.position.z = 0.95;
      tube.castShadow = true;
      head.add(tube);
      const brake = new THREE.Mesh(sharedGeo.box, glowMat);
      brake.scale.set(0.5, 0.16, 0.16);
      brake.position.set(0, 0.42, 0.2);
      head.add(brake);
      barrel = tube;
      muzzle.position.set(0, 0, 2.0);
      head.add(muzzle);
    } else if (kind === 'frost') {
      const housing = new THREE.Mesh(sharedGeo.sphere, bodyMat);
      housing.scale.setScalar(1.2);
      housing.castShadow = true;
      head.add(housing);
      const crystal = new THREE.Mesh(sharedGeo.oct, glowMat);
      crystal.scale.setScalar(1.15);
      crystal.position.set(0, 0.15, 0.6);
      head.add(crystal);
      for (let i = 0; i < 3; i++) {
        const fin = new THREE.Mesh(sharedGeo.box, this.baseMat);
        fin.scale.set(0.1, 0.5, 0.6);
        const a = (i / 3) * Math.PI * 2;
        fin.position.set(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5 + 0.1);
        fin.rotation.y = -a;
        head.add(fin);
      }
      barrel = crystal;
      muzzle.position.set(0, 0.15, 1.05);
      head.add(muzzle);
    } else {
      const column = new THREE.Mesh(sharedGeo.pedestal, bodyMat);
      column.scale.set(0.9, 1.4, 0.9);
      column.position.y = 0.35;
      column.castShadow = true;
      head.add(column);
      for (let i = 0; i < 3; i++) {
        const coil = new THREE.Mesh(sharedGeo.torus, glowMat);
        coil.scale.setScalar(1.15 - i * 0.16);
        coil.rotation.x = Math.PI / 2;
        coil.position.y = 0.55 + i * 0.3;
        head.add(coil);
      }
      const orb = new THREE.Mesh(sharedGeo.sphere, glowMat);
      orb.scale.setScalar(0.86);
      orb.position.y = 1.6;
      head.add(orb);
      barrel = orb;
      muzzle.position.set(0, 1.6, 0);
      head.add(muzzle);
    }

    const ring = new THREE.Mesh(
      sharedGeo.ring,
      new THREE.MeshBasicMaterial({
        color: def.accent,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    ring.visible = false;
    root.add(ring);

    this.scene.add(root);

    const tower: Tower = {
      id: this.nextId++,
      kind,
      def,
      level: 0,
      cell: [cx, cy],
      pos,
      hp: 260,
      maxHp: 260,
      cooldown: 0,
      yaw: 0,
      pitch: 0,
      target: null,
      root,
      head,
      barrel,
      muzzle,
      spinner,
      ring,
      recoil: 0,
      spin: 0,
      firing: 0,
      invested: def.cost,
      buildAnim: 0.5,
      kills: 0,
    };
    this.occupied.add(this.cellIndex(cx, cy));
    this.towers.push(tower);
    return tower;
  }

  upgrade(t: Tower): boolean {
    if (t.level >= t.def.levels.length - 1) return false;
    t.level++;
    t.invested += t.def.upgradeCost[t.level - 1];
    t.maxHp = 260 + t.level * 130;
    t.hp = t.maxHp;
    t.buildAnim = 0.35;
    const s = 1 + t.level * 0.12;
    t.head.scale.setScalar(s);
    return true;
  }

  upgradeCost(t: Tower): number {
    return t.level >= t.def.levels.length - 1 ? 0 : t.def.upgradeCost[t.level];
  }

  sellValue(t: Tower): number {
    return Math.floor(t.invested * t.def.sellRatio);
  }

  remove(t: Tower) {
    const i = this.towers.indexOf(t);
    if (i >= 0) this.towers.splice(i, 1);
    this.occupied.delete(this.cellIndex(t.cell[0], t.cell[1]));
    this.scene.remove(t.root);
    t.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.material && !Array.isArray(mesh.material)) {
        const m = mesh.material as THREE.Material & { __shared?: boolean };
        if (m !== this.baseMat) m.dispose();
      }
    });
  }

  clear() {
    for (const t of [...this.towers]) this.remove(t);
    this.towers.length = 0;
    this.occupied.clear();
  }

  showRange(t: Tower | null) {
    for (const tw of this.towers) if (tw.ring) tw.ring.visible = false;
    if (t && t.ring) {
      t.ring.visible = true;
      const r = t.def.levels[t.level].range;
      t.ring.scale.set(r, r, 1);
    }
  }

  /* ---------------- 判定 ---------------- */

  nearestTower(x: number, z: number, range: number): Tower | null {
    let best: Tower | null = null;
    let bestD = range * range;
    for (const t of this.towers) {
      const dx = t.pos.x - x;
      const dz = t.pos.z - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  sweepHit(from: THREE.Vector3, to: THREE.Vector3, radius: number): Tower | null {
    for (const t of this.towers) {
      const r = 1.35 + radius;
      // 円柱（高さ 3）との簡易判定
      if (Math.min(from.y, to.y) > 3.2) continue;
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const lenSq = dx * dx + dz * dz;
      let s = 0;
      if (lenSq > 1e-6) s = clamp(((t.pos.x - from.x) * dx + (t.pos.z - from.z) * dz) / lenSq, 0, 1);
      const px = from.x + dx * s - t.pos.x;
      const pz = from.z + dz * s - t.pos.z;
      if (px * px + pz * pz <= r * r) return t;
    }
    return null;
  }

  damageTower(t: Tower, amount: number, effects: Effects) {
    t.hp -= amount;
    _v.set(t.pos.x, 1.4, t.pos.z);
    effects.particles.sparks(_v, _w.set(0, 1, 0), 4, { color: 0xffaa55, speed: 6, size: 0.7 });
    if (t.hp <= 0) {
      effects.explosion(_v, 3.2, 0xffa040);
      this.remove(t);
    }
  }

  splashDamage(center: THREE.Vector3, radius: number, damage: number, effects: Effects) {
    for (const t of [...this.towers]) {
      const d = Math.hypot(t.pos.x - center.x, t.pos.z - center.z);
      if (d <= radius + 1.2) this.damageTower(t, damage * clamp(1 - d / (radius + 1.2), 0.3, 1), effects);
    }
  }

  get totalInvested() {
    return this.towers.reduce((a, t) => a + t.invested, 0);
  }

  /* ---------------- 更新 ---------------- */

  update(
    dt: number,
    enemies: EnemySystem,
    projectiles: Projectiles,
    effects: Effects,
    audio: AudioManager,
    healthBars: HealthBars,
    camQuat: THREE.Quaternion,
    corePos: THREE.Vector3,
  ) {
    this.time += dt;
    for (const t of this.towers) {
      const lv = t.def.levels[t.level];

      if (t.buildAnim > 0) {
        t.buildAnim -= dt;
        const k = clamp(1 - t.buildAnim / 0.5, 0, 1);
        t.root.scale.set(1, 0.2 + 0.8 * k, 1);
      } else {
        t.root.scale.set(1, 1, 1);
      }

      // 索敵：コアに最も近い敵を狙う
      if (!t.target || !t.target.active || t.target.dying > 0 || this.outOfRange(t, t.target, lv.range)) {
        t.target = null;
        let bestScore = Infinity;
        enemies.queryRange(t.pos.x, t.pos.z, lv.range, t.def.targetsAir, (e) => {
          const d = Math.hypot(e.pos.x - corePos.x, e.pos.z - corePos.z);
          if (d < bestScore) {
            bestScore = d;
            t.target = e;
          }
        });
      }

      // 旋回
      if (t.target) {
        enemies.centerOf(t.target, _v);
        this.predict(t, t.target, lv, _w);
        const targetYaw = Math.atan2(_w.x - t.pos.x, _w.z - t.pos.z);
        let delta = targetYaw - t.yaw;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        const turnSpeed = t.kind === 'gatling' ? 9 : t.kind === 'cannon' ? 3.4 : 6;
        t.yaw += clamp(delta, -turnSpeed * dt, turnSpeed * dt);
        t.head.rotation.y = t.yaw;
        const aimed = Math.abs(delta) < (t.kind === 'cannon' ? 0.12 : 0.35);

        t.cooldown -= dt;
        if (t.cooldown <= 0 && aimed) {
          t.cooldown = lv.fireInterval;
          this.fire(t, lv, _w, enemies, projectiles, effects, audio);
        }
      } else {
        // 待機中はゆっくり周囲を警戒する
        t.cooldown = Math.max(0, t.cooldown - dt);
        t.yaw += Math.sin(this.time * 0.35 + t.id * 1.7) * dt * 0.35;
        t.head.rotation.y = t.yaw;
      }

      // 演出
      t.firing = Math.max(0, t.firing - dt);
      t.recoil = damp(t.recoil, 0, 12, dt);
      if (t.kind === 'gatling' && t.spinner) {
        t.spin = damp(t.spin, t.firing > 0 ? 34 : 0, 3, dt);
        t.spinner.rotation.z += t.spin * dt;
        t.spinner.position.z = 0.55 - t.recoil * 0.35;
      } else if (t.kind === 'cannon') {
        t.barrel.position.z = 0.95 - t.recoil * 0.9;
      } else if (t.kind === 'frost') {
        t.barrel.rotation.y += dt * 2.4;
        t.barrel.rotation.x += dt * 1.1;
      } else if (t.kind === 'tesla') {
        t.barrel.position.y = 1.6 + Math.sin(this.time * 3 + t.id) * 0.05;
        t.barrel.rotation.y += dt * 1.5;
      }

      if (t.hp < t.maxHp - 0.5) {
        _v.set(t.pos.x, 3.1, t.pos.z);
        healthBars.add(_v, t.hp / t.maxHp, 2.1, camQuat, false);
      }
    }
  }

  private outOfRange(t: Tower, e: Enemy, range: number) {
    const dx = e.pos.x - t.pos.x;
    const dz = e.pos.z - t.pos.z;
    return dx * dx + dz * dz > range * range || (!t.def.targetsAir && e.flying);
  }

  /** 弾速を考慮した偏差射撃点 */
  private predict(t: Tower, e: Enemy, lv: { range: number }, out: THREE.Vector3) {
    const speed = t.def.projectileSpeed;
    out.set(e.pos.x, e.flying ? e.pos.y : e.pos.y + e.height * 0.55, e.pos.z);
    if (speed <= 0) return out;
    for (let i = 0; i < 2; i++) {
      const dist = out.distanceTo(_muzzleWorld(t, _muzzle));
      const time = dist / speed;
      out.set(
        e.pos.x + e.vel.x * time,
        (e.flying ? e.pos.y : e.pos.y + e.height * 0.55) + (t.kind === 'cannon' ? 0.5 * 9.8 * time * time * 0.5 : 0),
        e.pos.z + e.vel.z * time,
      );
    }
    void lv;
    return out;
  }

  private fire(
    t: Tower,
    lv: { damage: number; range: number; fireInterval: number; special: number },
    aim: THREE.Vector3,
    enemies: EnemySystem,
    projectiles: Projectiles,
    effects: Effects,
    audio: AudioManager,
  ) {
    const target = t.target;
    if (!target) return;
    _muzzleWorld(t, _muzzle);
    t.firing = 0.25;

    if (t.kind === 'gatling') {
      t.recoil = 1;
      _dir.subVectors(aim, _muzzle).normalize();
      _dir.x += (Math.random() - 0.5) * 0.02;
      _dir.y += (Math.random() - 0.5) * 0.02;
      _dir.z += (Math.random() - 0.5) * 0.02;
      projectiles.spawn({
        team: 'ally',
        from: _muzzle,
        velocity: _dir.normalize().multiplyScalar(t.def.projectileSpeed),
        damage: lv.damage,
        color: t.def.accent,
        size: 0.12,
        life: 2,
      });
      effects.particles.sparks(_muzzle, _dir, 2, { color: 0xffd9a0, speed: 6, size: 0.5, life: 0.3 });
      effects.flash(_muzzle, 0xffc070, 2.2, 0.06);
      audio.towerShot('gatling', t.pos);
    } else if (t.kind === 'cannon') {
      t.recoil = 1;
      const g = 9.8;
      _dir.subVectors(aim, _muzzle);
      const dist = Math.hypot(_dir.x, _dir.z);
      const time = dist / t.def.projectileSpeed;
      const vy = _dir.y / Math.max(time, 0.01) + 0.5 * g * time;
      _dir.y = 0;
      _dir.normalize().multiplyScalar(t.def.projectileSpeed);
      _dir.y = vy;
      projectiles.spawn({
        team: 'ally',
        from: _muzzle,
        velocity: _dir,
        damage: lv.damage,
        splash: lv.special,
        gravity: g,
        color: 0xffb066,
        size: 0.3,
        life: 6,
        smoke: true,
      });
      _dir.normalize();
      effects.particles.smoke(_muzzle, 3, { color: 0x6a6f7a, size: 0.6, speed: 3, life: 0.7 });
      effects.particles.sparks(_muzzle, _dir, 6, { color: 0xffc070, speed: 12, size: 0.9, life: 0.5 });
      effects.flash(_muzzle, 0xffa050, 4.5, 0.12);
      audio.towerShot('cannon', t.pos);
    } else if (t.kind === 'frost') {
      enemies.centerOf(target, _v);
      effects.beam(_muzzle, _v, 0x7ceaff, 0.11, lv.fireInterval);
      enemies.damage(target, lv.damage * lv.fireInterval, false, 'tower');
      enemies.slow(target, lv.special, 0.55);
      if (Math.random() < 0.25) {
        effects.particles.sparks(_v, _w.set(0, 1, 0), 2, { color: 0x9ff0ff, speed: 4, size: 0.5, life: 0.5 });
      }
      audio.towerShot('frost', t.pos);
    } else {
      // テスラ：連鎖する雷撃
      const hitSet = new Set<number>();
      let current: Enemy | null = target;
      let from = _muzzle.clone();
      const chain = Math.round(lv.special);
      for (let i = 0; i < chain && current; i++) {
        const node: Enemy = current;
        hitSet.add(node.id);
        enemies.centerOf(node, _v);
        effects.lightning(from, _v, 0xd9a8ff, 0.16);
        enemies.damage(node, lv.damage * Math.pow(0.82, i), false, 'tower');
        effects.particles.sparks(_v, _w.set(0, 1, 0), 3, { color: 0xd9a8ff, speed: 7, size: 0.6, life: 0.4 });
        from = _v.clone();
        let next: Enemy | null = null;
        let bestD = 11 * 11;
        enemies.queryRange(node.pos.x, node.pos.z, 11, true, (e) => {
          if (hitSet.has(e.id)) return;
          const d = (e.pos.x - node.pos.x) ** 2 + (e.pos.z - node.pos.z) ** 2;
          if (d < bestD) {
            bestD = d;
            next = e;
          }
        });
        current = next;
      }
      effects.flash(_muzzle, 0xc98cff, 3, 0.14);
      audio.towerShot('tesla', t.pos);
    }
  }
}

const _tmpMuzzle = new THREE.Vector3();
function _muzzleWorld(t: Tower, out: THREE.Vector3): THREE.Vector3 {
  t.muzzle.updateWorldMatrix(true, false);
  return out.setFromMatrixPosition(t.muzzle.matrixWorld).add(_tmpMuzzle.set(0, 0, 0));
}

export const TOWER_CELL_SIZE = CELL_SIZE;
