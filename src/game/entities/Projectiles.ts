import * as THREE from 'three';
import type { Effects } from '../fx/Effects';
import type { AudioManager } from '../core/Audio';
import type { EnemySystem } from './EnemySystem';
import type { TowerSystem } from './TowerSystem';
import type { PlayerController } from './PlayerController';
import { MAP_EXTENT } from '../config';

export type Team = 'ally' | 'enemy';

interface Projectile {
  active: boolean;
  team: Team;
  pos: THREE.Vector3;
  prev: THREE.Vector3;
  vel: THREE.Vector3;
  damage: number;
  splash: number;
  gravity: number;
  life: number;
  radius: number;
  color: THREE.Color;
  trailColor: number;
  size: number;
  smoke: boolean;
}

export interface SpawnProjectileOptions {
  team: Team;
  from: THREE.Vector3;
  velocity: THREE.Vector3;
  damage: number;
  splash?: number;
  gravity?: number;
  life?: number;
  color?: number;
  size?: number;
  smoke?: boolean;
}

const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

/** タワー・敵が撃つ実体弾の管理（1 ドローコール） */
export class Projectiles {
  private list: Projectile[] = [];
  private mesh: THREE.InstancedMesh;
  private capacity = 420;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.SphereGeometry(1, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.95 });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 3).fill(1), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    for (let i = 0; i < this.capacity; i++) {
      this.list.push({
        active: false,
        team: 'ally',
        pos: new THREE.Vector3(),
        prev: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        damage: 0,
        splash: 0,
        gravity: 0,
        life: 0,
        radius: 0.2,
        color: new THREE.Color(),
        trailColor: 0xffffff,
        size: 0.16,
        smoke: false,
      });
    }
  }

  spawn(o: SpawnProjectileOptions) {
    const p = this.list.find((x) => !x.active);
    if (!p) return;
    p.active = true;
    p.team = o.team;
    p.pos.copy(o.from);
    p.prev.copy(o.from);
    p.vel.copy(o.velocity);
    p.damage = o.damage;
    p.splash = o.splash ?? 0;
    p.gravity = o.gravity ?? 0;
    p.life = o.life ?? 4;
    p.color.setHex(o.color ?? 0xffd27a);
    p.trailColor = o.color ?? 0xffd27a;
    p.size = o.size ?? 0.16;
    p.radius = p.size * 1.4;
    p.smoke = o.smoke ?? false;
  }

  update(
    dt: number,
    enemies: EnemySystem,
    towers: TowerSystem,
    player: PlayerController,
    effects: Effects,
    audio: AudioManager,
  ) {
    let n = 0;
    for (const p of this.list) {
      if (!p.active) continue;
      p.life -= dt;
      p.prev.copy(p.pos);
      if (p.gravity) p.vel.y -= p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);

      let hit = false;
      let hitPos: THREE.Vector3 | null = null;

      if (p.team === 'ally') {
        const e = enemies.sweepHit(p.prev, p.pos, p.radius);
        if (e) {
          hit = true;
          hitPos = _v.copy(p.pos).clone();
          if (p.splash <= 0) enemies.damage(e, p.damage, false, 'tower');
        }
      } else {
        if (player.alive && player.intersectsSegment(p.prev, p.pos, p.radius)) {
          hit = true;
          hitPos = p.pos.clone();
          player.takeDamage(p.damage);
        } else {
          const t = towers.sweepHit(p.prev, p.pos, p.radius);
          if (t) {
            hit = true;
            hitPos = p.pos.clone();
            towers.damageTower(t, p.damage, effects);
          }
        }
      }

      if (!hit && p.pos.y <= 0.05) {
        hit = true;
        hitPos = p.pos.clone();
        hitPos.y = 0.06;
      }
      if (!hit && (Math.abs(p.pos.x) > MAP_EXTENT + 12 || Math.abs(p.pos.z) > MAP_EXTENT + 12 || p.pos.y > 90)) {
        p.active = false;
        continue;
      }

      if (p.smoke && Math.random() < dt * 34) {
        effects.particles.smoke(p.pos, 1, { color: 0x555a63, size: 0.35, speed: 0.6, life: 0.4 });
      }

      if (hit && hitPos) {
        if (p.splash > 0) {
          effects.explosion(hitPos, p.splash, p.trailColor);
          audio.explosion(Math.min(1.4, p.splash / 4), hitPos);
          if (p.team === 'ally') {
            enemies.splashDamage(hitPos, p.splash, p.damage);
          } else {
            player.splashDamage(hitPos, p.splash, p.damage);
            towers.splashDamage(hitPos, p.splash, p.damage, effects);
          }
        } else {
          effects.particles.sparks(hitPos, _v.set(0, 1, 0), 5, {
            color: p.trailColor,
            speed: 7,
            size: 0.7,
            life: 0.6,
          });
          audio.impact(hitPos);
        }
        p.active = false;
        continue;
      }

      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      // 描画（進行方向に少し伸ばす）
      const speed = p.vel.length();
      _q.setFromUnitVectors(UP, _v.copy(p.vel).divideScalar(Math.max(speed, 0.0001)));
      _s.set(p.size, p.size * (1 + Math.min(3.5, speed * 0.02)), p.size);
      _m.compose(p.pos, _q, _s);
      this.mesh.setMatrixAt(n, _m);
      this.mesh.setColorAt(n, p.color);
      n++;

      effects.tracer(p.prev, p.pos, p.trailColor, p.size * 0.9, 0.05);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  clear() {
    for (const p of this.list) p.active = false;
    this.mesh.count = 0;
  }
}

const UP = new THREE.Vector3(0, 1, 0);
