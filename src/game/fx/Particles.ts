import * as THREE from 'three';
import { randRange } from '../core/util';

function softCircleTexture(): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

type Mode = 'spark' | 'smoke' | 'debris';

interface GroupState {
  mesh: THREE.InstancedMesh;
  mode: Mode;
  capacity: number;
  count: number;
  pos: Float32Array;
  vel: Float32Array;
  col: Float32Array;
  life: Float32Array;
  maxLife: Float32Array;
  size: Float32Array;
  spin: Float32Array;
  gravity: Float32Array;
  drag: Float32Array;
}

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);
const _euler = new THREE.Euler();

/** インスタンシングによる粒子エフェクト（火花・煙・破片） */
export class Particles {
  private groups: Record<Mode, GroupState>;

  constructor(scene: THREE.Scene) {
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const smokeMat = new THREE.MeshBasicMaterial({
      map: softCircleTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 1,
      toneMapped: false,
    });
    const debrisMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true,
    });

    this.groups = {
      spark: this.makeGroup(scene, 'spark', 1200, new THREE.BoxGeometry(1, 1, 1), sparkMat),
      smoke: this.makeGroup(scene, 'smoke', 340, new THREE.PlaneGeometry(1, 1), smokeMat),
      debris: this.makeGroup(scene, 'debris', 420, new THREE.BoxGeometry(1, 1, 1), debrisMat),
    };
  }

  private makeGroup(
    scene: THREE.Scene,
    mode: Mode,
    capacity: number,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
  ): GroupState {
    const mesh = new THREE.InstancedMesh(geo, mat, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    scene.add(mesh);
    return {
      mesh,
      mode,
      capacity,
      count: 0,
      pos: new Float32Array(capacity * 3),
      vel: new Float32Array(capacity * 3),
      col: new Float32Array(capacity * 3),
      life: new Float32Array(capacity),
      maxLife: new Float32Array(capacity),
      size: new Float32Array(capacity),
      spin: new Float32Array(capacity * 3),
      gravity: new Float32Array(capacity),
      drag: new Float32Array(capacity),
    };
  }

  private alloc(g: GroupState): number {
    if (g.count < g.capacity) return g.count++;
    // 容量超過時は最も寿命が短い粒子を置き換える
    let worst = 0;
    let worstLife = Infinity;
    for (let i = 0; i < g.count; i += 7) {
      if (g.life[i] < worstLife) {
        worstLife = g.life[i];
        worst = i;
      }
    }
    return worst;
  }

  private setCommon(g: GroupState, i: number, pos: THREE.Vector3, vel: THREE.Vector3, color: number, life: number, size: number) {
    g.pos[i * 3] = pos.x;
    g.pos[i * 3 + 1] = pos.y;
    g.pos[i * 3 + 2] = pos.z;
    g.vel[i * 3] = vel.x;
    g.vel[i * 3 + 1] = vel.y;
    g.vel[i * 3 + 2] = vel.z;
    _c.setHex(color);
    g.col[i * 3] = _c.r;
    g.col[i * 3 + 1] = _c.g;
    g.col[i * 3 + 2] = _c.b;
    g.life[i] = life;
    g.maxLife[i] = life;
    g.size[i] = size;
  }

  sparks(pos: THREE.Vector3, dir: THREE.Vector3, count: number, opts: { color?: number; speed?: number; spread?: number; size?: number; life?: number; gravity?: number } = {}) {
    const g = this.groups.spark;
    const color = opts.color ?? 0xffc06a;
    const speed = opts.speed ?? 14;
    const spread = opts.spread ?? 0.85;
    for (let n = 0; n < count; n++) {
      const i = this.alloc(g);
      _v.set(
        dir.x + randRange(-spread, spread),
        dir.y + randRange(-spread, spread),
        dir.z + randRange(-spread, spread),
      )
        .normalize()
        .multiplyScalar(speed * randRange(0.35, 1.3));
      this.setCommon(g, i, pos, _v, color, randRange(0.14, 0.42) * (opts.life ?? 1), (opts.size ?? 1) * randRange(0.05, 0.14));
      g.gravity[i] = opts.gravity ?? 22;
      g.drag[i] = 2.4;
    }
  }

  smoke(pos: THREE.Vector3, count: number, opts: { color?: number; speed?: number; size?: number; life?: number; rise?: number } = {}) {
    const g = this.groups.smoke;
    const color = opts.color ?? 0x6a6f7a;
    for (let n = 0; n < count; n++) {
      const i = this.alloc(g);
      _v.set(randRange(-1, 1), randRange(0.2, 1), randRange(-1, 1))
        .normalize()
        .multiplyScalar((opts.speed ?? 2.4) * randRange(0.4, 1.2));
      _v.y += opts.rise ?? 1.2;
      this.setCommon(g, i, pos, _v, color, randRange(0.6, 1.5) * (opts.life ?? 1), (opts.size ?? 1) * randRange(0.8, 1.7));
      g.gravity[i] = -0.6;
      g.drag[i] = 1.4;
      g.spin[i * 3] = randRange(-1, 1);
    }
  }

  debris(pos: THREE.Vector3, count: number, opts: { color?: number; speed?: number; size?: number; life?: number } = {}) {
    const g = this.groups.debris;
    const color = opts.color ?? 0x8a8f9c;
    for (let n = 0; n < count; n++) {
      const i = this.alloc(g);
      _v.set(randRange(-1, 1), randRange(0.4, 1.4), randRange(-1, 1))
        .normalize()
        .multiplyScalar((opts.speed ?? 9) * randRange(0.4, 1.3));
      this.setCommon(g, i, pos, _v, color, randRange(0.9, 1.8) * (opts.life ?? 1), (opts.size ?? 1) * randRange(0.12, 0.3));
      g.gravity[i] = 26;
      g.drag[i] = 0.6;
      g.spin[i * 3] = randRange(-8, 8);
      g.spin[i * 3 + 1] = randRange(-8, 8);
      g.spin[i * 3 + 2] = randRange(-8, 8);
    }
  }

  update(dt: number, camQuat: THREE.Quaternion) {
    for (const key of ['spark', 'smoke', 'debris'] as Mode[]) {
      const g = this.groups[key];
      let i = 0;
      while (i < g.count) {
        g.life[i] -= dt;
        if (g.life[i] <= 0) {
          const last = g.count - 1;
          if (i !== last) this.swap(g, i, last);
          g.count--;
          continue;
        }
        const i3 = i * 3;
        const dragF = Math.max(0, 1 - g.drag[i] * dt);
        g.vel[i3] *= dragF;
        g.vel[i3 + 1] = g.vel[i3 + 1] * dragF - g.gravity[i] * dt;
        g.vel[i3 + 2] *= dragF;
        g.pos[i3] += g.vel[i3] * dt;
        g.pos[i3 + 1] += g.vel[i3 + 1] * dt;
        g.pos[i3 + 2] += g.vel[i3 + 2] * dt;

        if (g.mode !== 'smoke' && g.pos[i3 + 1] < 0.04) {
          g.pos[i3 + 1] = 0.04;
          g.vel[i3 + 1] *= -0.32;
          g.vel[i3] *= 0.6;
          g.vel[i3 + 2] *= 0.6;
        }

        const t = g.life[i] / g.maxLife[i];
        _v.set(g.pos[i3], g.pos[i3 + 1], g.pos[i3 + 2]);

        if (g.mode === 'spark') {
          const speed = Math.hypot(g.vel[i3], g.vel[i3 + 1], g.vel[i3 + 2]);
          _q.setFromUnitVectors(_up, _s.set(g.vel[i3], g.vel[i3 + 1], g.vel[i3 + 2]).normalize());
          const len = Math.min(1.6, 0.1 + speed * 0.035);
          _s.set(g.size[i] * t, len, g.size[i] * t);
          _m.compose(_v, _q, _s);
          _c.setRGB(g.col[i3] * t, g.col[i3 + 1] * t * t, g.col[i3 + 2] * t * t);
        } else if (g.mode === 'smoke') {
          const grow = (1 - t) * 2.4 + 0.6;
          _s.setScalar(g.size[i] * grow);
          _m.compose(_v, camQuat, _s);
          const a = Math.min(1, t * 1.6) * 0.5;
          _c.setRGB(g.col[i3] * a, g.col[i3 + 1] * a, g.col[i3 + 2] * a);
        } else {
          _euler.set(g.spin[i3] * (g.maxLife[i] - g.life[i]), g.spin[i3 + 1] * (g.maxLife[i] - g.life[i]), g.spin[i3 + 2] * (g.maxLife[i] - g.life[i]));
          _q.setFromEuler(_euler);
          _s.setScalar(g.size[i] * Math.min(1, t * 3));
          _m.compose(_v, _q, _s);
          _c.setRGB(g.col[i3], g.col[i3 + 1], g.col[i3 + 2]);
        }

        g.mesh.setMatrixAt(i, _m);
        g.mesh.setColorAt(i, _c);
        i++;
      }
      g.mesh.count = g.count;
      g.mesh.instanceMatrix.needsUpdate = true;
      if (g.mesh.instanceColor) g.mesh.instanceColor.needsUpdate = true;
    }
  }

  private swap(g: GroupState, a: number, b: number) {
    for (let k = 0; k < 3; k++) {
      [g.pos[a * 3 + k], g.pos[b * 3 + k]] = [g.pos[b * 3 + k], g.pos[a * 3 + k]];
      [g.vel[a * 3 + k], g.vel[b * 3 + k]] = [g.vel[b * 3 + k], g.vel[a * 3 + k]];
      [g.col[a * 3 + k], g.col[b * 3 + k]] = [g.col[b * 3 + k], g.col[a * 3 + k]];
      [g.spin[a * 3 + k], g.spin[b * 3 + k]] = [g.spin[b * 3 + k], g.spin[a * 3 + k]];
    }
    [g.life[a], g.life[b]] = [g.life[b], g.life[a]];
    [g.maxLife[a], g.maxLife[b]] = [g.maxLife[b], g.maxLife[a]];
    [g.size[a], g.size[b]] = [g.size[b], g.size[a]];
    [g.gravity[a], g.gravity[b]] = [g.gravity[b], g.gravity[a]];
    [g.drag[a], g.drag[b]] = [g.drag[b], g.drag[a]];
  }

  clear() {
    for (const key of ['spark', 'smoke', 'debris'] as Mode[]) {
      this.groups[key].count = 0;
      this.groups[key].mesh.count = 0;
    }
  }
}
