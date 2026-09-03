import * as THREE from 'three';
import { PLAYER, WEAPONS, WEAPON_ORDER, type WeaponKind } from '../config';
import type { AudioManager } from '../core/Audio';
import type { Input } from '../core/Input';
import { clamp, damp, spreadDirection } from '../core/util';
import type { Effects } from '../fx/Effects';
import type { ScreenFX } from '../fx/ScreenFX';
import type { WorldCollision } from '../world/collision';
import type { EnemySystem } from './EnemySystem';
import { MUZZLE_OFFSET, createWeaponModel } from './weaponModels';

export interface PlayerContext {
  dt: number;
  input: Input;
  allowControl: boolean;
  enemies: EnemySystem;
  collision: WorldCollision;
  effects: Effects;
  audio: AudioManager;
  screen: ScreenFX;
  onHit: (point: THREE.Vector3, damage: number, crit: boolean) => void;
  onDeath: () => void;
}

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _tmp = new THREE.Vector3();
const _tmp2 = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _muzzle = new THREE.Vector3();
const _spawn = new THREE.Vector3();

export class PlayerController {
  position = new THREE.Vector3(0, 0, 14);
  velocity = new THREE.Vector3();
  yaw = Math.PI;
  pitch = 0;
  recoilPitch = 0;
  recoilYaw = 0;

  hp = PLAYER.maxHp;
  maxHp = PLAYER.maxHp;
  alive = true;
  respawnTimer = 0;
  grounded = true;
  radius = PLAYER.radius;
  sprinting = false;

  weapon: WeaponKind = 'rifle';
  ammo: Record<WeaponKind, number> = { rifle: 32, shotgun: 7, railgun: 5 };
  reloadTimer = 0;
  fireTimer = 0;
  adsAmount = 0;
  wantsAds = false;

  readonly viewGroup = new THREE.Group();
  private models: Record<WeaponKind, THREE.Group>;
  private bob = 0;
  private swayX = 0;
  private swayY = 0;
  private kick = 0;
  private lastDamageAt = -99;
  private time = 0;
  private lastRegenTick = 0;

  shotsFired = 0;
  shotsHit = 0;
  damageDealt = 0;

  constructor() {
    this.models = {
      rifle: createWeaponModel('rifle'),
      shotgun: createWeaponModel('shotgun'),
      railgun: createWeaponModel('railgun'),
    };
    for (const k of WEAPON_ORDER) {
      this.models[k].visible = k === this.weapon;
      this.viewGroup.add(this.models[k]);
    }
    this.viewGroup.frustumCulled = false;
    // カメラ直前に大写しにならないよう縮小して前方に置く
    this.viewGroup.scale.setScalar(0.52);
  }

  get eyeY() {
    return this.position.y + PLAYER.eyeHeight;
  }

  eyePosition(out: THREE.Vector3) {
    return out.set(this.position.x, this.eyeY + Math.sin(this.bob * 2) * 0.035, this.position.z);
  }

  forward(out: THREE.Vector3) {
    const p = this.pitch + this.recoilPitch;
    const y = this.yaw + this.recoilYaw;
    return out.set(-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)).normalize();
  }

  /** 再出撃（戦績は引き継ぐ） */
  respawn(spawn: THREE.Vector3) {
    this.position.copy(spawn);
    this.velocity.set(0, 0, 0);
    this.hp = this.maxHp;
    this.alive = true;
    this.respawnTimer = 0;
    this.yaw = Math.atan2(spawn.x, spawn.z);
    this.pitch = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.ammo = { rifle: WEAPONS.rifle.magSize, shotgun: WEAPONS.shotgun.magSize, railgun: WEAPONS.railgun.magSize };
    this.reloadTimer = 0;
    this.fireTimer = 0.3;
    this.lastDamageAt = this.time;
    this.setWeapon('rifle');
  }

  /** 新しいラン開始（戦績もリセット） */
  reset(spawn: THREE.Vector3) {
    this.respawn(spawn);
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.damageDealt = 0;
  }

  setWeapon(k: WeaponKind) {
    if (this.weapon === k && this.models[k].visible) return;
    this.weapon = k;
    this.reloadTimer = 0;
    this.kick = 0.5;
    for (const w of WEAPON_ORDER) this.models[w].visible = w === k;
  }

  takeDamage(amount: number) {
    if (!this.alive) return;
    this.hp -= amount;
    this.lastDamageAt = this.time;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.respawnTimer = PLAYER.respawnTime;
    }
  }

  splashDamage(center: THREE.Vector3, radius: number, damage: number) {
    _tmp.set(this.position.x, this.position.y + 1, this.position.z);
    const d = _tmp.distanceTo(center);
    if (d < radius) this.takeDamage(damage * clamp(1 - d / radius, 0.25, 1));
  }

  heal(amount: number) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /** 敵弾との判定（プレイヤーをカプセルとみなす） */
  intersectsSegment(a: THREE.Vector3, b: THREE.Vector3, radius: number): boolean {
    const r = this.radius + radius;
    const cx = this.position.x;
    const cz = this.position.z;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lenSq = dx * dx + dz * dz;
    let s = 0;
    if (lenSq > 1e-8) s = clamp(((cx - a.x) * dx + (cz - a.z) * dz) / lenSq, 0, 1);
    const px = a.x + dx * s - cx;
    const pz = a.z + dz * s - cz;
    if (px * px + pz * pz > r * r) return false;
    const y = a.y + (b.y - a.y) * s;
    return y > this.position.y - 0.2 && y < this.position.y + 1.95;
  }

  /* ---------------- 更新 ---------------- */

  update(ctx: PlayerContext) {
    const { dt, input, allowControl } = ctx;
    this.time += dt;

    if (!this.alive) {
      this.respawnTimer -= dt;
      this.velocity.set(0, 0, 0);
      this.updateViewModel(dt, 0);
      if (this.respawnTimer <= 0) ctx.onDeath();
      return;
    }

    // --- 視点 ---
    if (allowControl && input.pointerLocked) {
      const sens = PLAYER.mouseSensitivity * (1 - this.adsAmount * 0.35);
      this.yaw -= input.mouseDX * sens;
      this.pitch -= input.mouseDY * sens;
      this.pitch = clamp(this.pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
      this.swayX = damp(this.swayX, clamp(-input.mouseDX * 0.0016, -0.05, 0.05), 9, dt);
      this.swayY = damp(this.swayY, clamp(-input.mouseDY * 0.0016, -0.05, 0.05), 9, dt);
    } else {
      this.swayX = damp(this.swayX, 0, 8, dt);
      this.swayY = damp(this.swayY, 0, 8, dt);
    }
    this.recoilPitch = damp(this.recoilPitch, 0, 7, dt);
    this.recoilYaw = damp(this.recoilYaw, 0, 7, dt);

    // --- 移動 ---
    const moveX = allowControl ? input.axis('KeyA', 'KeyD') : 0;
    const moveZ = allowControl ? input.axis('KeyS', 'KeyW') : 0;
    this.sprinting = allowControl && input.isDown('ShiftLeft') && moveZ > 0 && this.adsAmount < 0.4;
    const speed = this.sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;

    _fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    _right.crossVectors(_fwd, _up).normalize().multiplyScalar(-1);
    _tmp.set(0, 0, 0).addScaledVector(_fwd, moveZ).addScaledVector(_right, moveX);
    if (_tmp.lengthSq() > 1) _tmp.normalize();

    const accel = this.grounded ? PLAYER.accel : PLAYER.airAccel;
    this.velocity.x += _tmp.x * accel * dt;
    this.velocity.z += _tmp.z * accel * dt;

    if (this.grounded) {
      const f = Math.max(0, 1 - PLAYER.friction * dt);
      if (_tmp.lengthSq() < 0.01) {
        this.velocity.x *= f;
        this.velocity.z *= f;
      }
    }
    const horiz = Math.hypot(this.velocity.x, this.velocity.z);
    if (horiz > speed) {
      this.velocity.x = (this.velocity.x / horiz) * speed;
      this.velocity.z = (this.velocity.z / horiz) * speed;
    }

    if (allowControl && this.grounded && input.wasPressed('Space')) {
      this.velocity.y = PLAYER.jumpSpeed;
      this.grounded = false;
    }
    this.velocity.y -= PLAYER.gravity * dt;

    this.position.addScaledVector(this.velocity, dt);
    if (this.position.y <= 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }
    ctx.collision.resolveCircle(this.position, this.radius);

    this.bob += horiz * dt * 1.15;

    // --- 武器切替 ---
    if (allowControl) {
      if (input.wasPressed('Digit1')) this.setWeapon('rifle');
      if (input.wasPressed('Digit2')) this.setWeapon('shotgun');
      if (input.wasPressed('Digit3')) this.setWeapon('railgun');
      if (input.wheel !== 0) {
        const i = WEAPON_ORDER.indexOf(this.weapon);
        const n = (i + (input.wheel > 0 ? 1 : -1) + WEAPON_ORDER.length) % WEAPON_ORDER.length;
        this.setWeapon(WEAPON_ORDER[n]);
      }
      if (input.wasPressed('KeyR')) this.startReload(ctx.audio);
    }

    // --- ADS ---
    this.wantsAds = allowControl && input.buttons[2] && this.reloadTimer <= 0;
    this.adsAmount = damp(this.adsAmount, this.wantsAds ? 1 : 0, 14, dt);

    // --- 射撃 ---
    const def = WEAPONS[this.weapon];
    this.fireTimer -= dt;
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.ammo[this.weapon] = def.magSize;
      }
    } else if (allowControl && input.pointerLocked) {
      const wantFire = def.auto ? input.buttons[0] : input.buttonPressed[0];
      if (wantFire && this.fireTimer <= 0) {
        if (this.ammo[this.weapon] > 0) this.fire(ctx);
        else this.startReload(ctx.audio);
      }
    }

    // --- 自動回復 ---
    if (this.time - this.lastDamageAt > PLAYER.regenDelay && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + PLAYER.regenRate * dt);
      if (this.time - this.lastRegenTick > 0.6) this.lastRegenTick = this.time;
    }

    // --- 演出 ---
    const spread = (def.spread + (horiz > 1 ? def.moveSpread : 0)) * (1 - this.adsAmount * 0.72);
    ctx.screen.setSpread(6 + spread * 900 + (this.sprinting ? 8 : 0));
    ctx.screen.setLowHealth(this.hp / this.maxHp);
    this.updateViewModel(dt, horiz);
  }

  startReload(audio: AudioManager) {
    const def = WEAPONS[this.weapon];
    if (this.reloadTimer > 0 || this.ammo[this.weapon] >= def.magSize) return;
    this.reloadTimer = def.reloadTime;
    audio.reload();
  }

  private fire(ctx: PlayerContext) {
    const def = WEAPONS[this.weapon];
    this.ammo[this.weapon]--;
    this.fireTimer = def.fireInterval;
    this.shotsFired++;

    this.eyePosition(_tmp2);
    this.forward(_fwd);
    _right.crossVectors(_fwd, _up).normalize();
    const mo = MUZZLE_OFFSET[this.weapon];
    const lateral = mo.x * (1 - this.adsAmount);
    _muzzle
      .copy(_tmp2)
      .addScaledVector(_right, lateral)
      .addScaledVector(_up, mo.y * (1 - this.adsAmount * 0.5))
      .addScaledVector(_fwd, mo.z);

    const spread = (def.spread + (Math.hypot(this.velocity.x, this.velocity.z) > 1 ? def.moveSpread : 0)) * (1 - this.adsAmount * 0.72);

    let anyHit = false;
    for (let p = 0; p < def.pellets; p++) {
      spreadDirection(_fwd, spread, _dir);
      if (this.shoot(ctx, _tmp2, _dir, _muzzle, def.pierce + 1)) anyHit = true;
    }
    if (anyHit) this.shotsHit++;

    // 反動と演出
    this.recoilPitch += def.recoil * (1 - this.adsAmount * 0.3);
    this.recoilYaw += (Math.random() - 0.5) * def.recoil * 0.6;
    this.kick = def.kick;
    ctx.screen.kick(def.recoil * 420);
    ctx.effects.flash(_muzzle, def.color, this.weapon === 'railgun' ? 5 : 2.4, 0.07);
    ctx.effects.particles.sparks(_muzzle, _fwd, this.weapon === 'shotgun' ? 8 : 4, {
      color: def.color,
      speed: 9,
      spread: 0.4,
      size: 0.7,
      life: 0.32,
    });
    ctx.effects.particles.smoke(_muzzle, 1, { color: 0x7a7f88, size: 0.22, speed: 1.4, life: 0.35 });
    ctx.audio.gunshot(this.weapon);
  }

  /** 1 発分のヒットスキャン処理 */
  private shoot(
    ctx: PlayerContext,
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    muzzle: THREE.Vector3,
    maxHits: number,
  ): boolean {
    const def = WEAPONS[this.weapon];
    const wall = ctx.collision.raycast(origin, dir, def.range);
    const limit = wall ? wall.distance : def.range;
    const hits = ctx.enemies.raycast(origin, dir, limit, maxHits);

    let endPoint: THREE.Vector3;
    if (hits.length) {
      endPoint = hits[hits.length - 1].point;
    } else if (wall) {
      endPoint = wall.point;
    } else {
      endPoint = _spawn.copy(origin).addScaledVector(dir, def.range).clone();
    }

    for (const h of hits) {
      const dmg = def.damage * (h.crit ? def.critMultiplier : 1);
      const dealt = ctx.enemies.damage(h.enemy, dmg, h.crit, 'player');
      this.damageDealt += dealt;
      ctx.onHit(h.point, dealt, h.crit);
      ctx.effects.particles.sparks(h.point, _tmp.copy(dir).negate(), h.crit ? 8 : 5, {
        color: h.crit ? 0xffe08a : h.enemy.def.accent,
        speed: 9,
        size: 0.7,
        life: 0.45,
      });
    }

    if (def.splash > 0 && (hits.length || wall)) {
      const center = hits.length ? hits[0].point : endPoint;
      ctx.enemies.splashDamage(center, def.splash, def.damage * 0.45, true);
      ctx.effects.explosion(center, def.splash, def.color);
      ctx.audio.explosion(0.6, center);
    }

    if (!hits.length && wall) {
      ctx.effects.particles.sparks(wall.point, wall.normal, 5, {
        color: wall.kind === 'core' ? 0x8fe9ff : 0xc9c2a8,
        speed: 6,
        size: 0.55,
        life: 0.4,
      });
      ctx.effects.particles.smoke(wall.point, 1, { color: 0x6d6a63, size: 0.2, speed: 1, life: 0.4 });
      ctx.audio.impact(wall.point);
    }

    ctx.effects.tracer(muzzle, endPoint, def.color, def.tracerWidth, this.weapon === 'railgun' ? 0.2 : 0.06);
    return hits.length > 0;
  }

  /* ---------------- ビューモデル ---------------- */

  private updateViewModel(dt: number, horizSpeed: number) {
    const g = this.viewGroup;
    this.kick = damp(this.kick, 0, 13, dt);

    const hipX = 0.2;
    const hipY = -0.165;
    const hipZ = -0.66;
    const adsX = 0;
    const adsY = -0.078;
    const adsZ = -0.55;
    const a = this.adsAmount;

    const bobAmt = this.alive ? Math.min(1, horizSpeed / PLAYER.walkSpeed) * (1 - a * 0.8) : 0;
    const bx = Math.sin(this.bob * 2) * 0.022 * bobAmt;
    const by = Math.abs(Math.cos(this.bob * 2)) * 0.018 * bobAmt;

    const reloadK = this.reloadTimer > 0 ? Math.sin((1 - this.reloadTimer / WEAPONS[this.weapon].reloadTime) * Math.PI) : 0;

    g.position.set(
      hipX + (adsX - hipX) * a + bx + this.swayX,
      hipY + (adsY - hipY) * a + by + this.swayY - reloadK * 0.1,
      hipZ + (adsZ - hipZ) * a + this.kick * 0.32,
    );
    g.rotation.set(
      this.swayY * 1.6 + this.kick * 0.7 - reloadK * 0.5,
      Math.PI + this.swayX * 1.6,
      -this.swayX * 0.9 + reloadK * 0.35 + (this.sprinting ? 0.25 : 0),
    );
    if (this.sprinting) {
      g.position.y -= 0.035;
      g.rotation.x += 0.18;
    }
  }
}
