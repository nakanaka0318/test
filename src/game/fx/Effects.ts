import * as THREE from 'three';
import { randRange } from '../core/util';
import { Particles } from './Particles';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);

interface TracerState {
  a: THREE.Vector3;
  b: THREE.Vector3;
  color: THREE.Color;
  width: number;
  life: number;
  maxLife: number;
}

interface Bolt {
  line: THREE.Line;
  mat: THREE.LineBasicMaterial;
  life: number;
  maxLife: number;
}

interface Wave {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  from: number;
  to: number;
}

/** 弾道・雷撃・爆発などの視覚効果をまとめて管理する */
export class Effects {
  readonly particles: Particles;
  private scene: THREE.Scene;

  private tracerMesh: THREE.InstancedMesh;
  private tracers: TracerState[] = [];
  private tracerCap = 220;

  private bolts: Bolt[] = [];
  private waves: Wave[] = [];
  private flashes: THREE.PointLight[] = [];
  private flashLife: number[] = [];
  private flashPower: number[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.particles = new Particles(scene);

    const mat = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.tracerMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, this.tracerCap);
    this.tracerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.tracerMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.tracerCap * 3).fill(1), 3);
    this.tracerMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.tracerMesh.count = 0;
    this.tracerMesh.frustumCulled = false;
    scene.add(this.tracerMesh);

    for (let i = 0; i < 20; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(14 * 3), 3));
      const bmat = new THREE.LineBasicMaterial({
        color: 0xd0a0ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const line = new THREE.Line(geo, bmat);
      line.frustumCulled = false;
      line.visible = false;
      scene.add(line);
      this.bolts.push({ line, mat: bmat, life: 0, maxLife: 1 });
    }

    for (let i = 0; i < 16; i++) {
      const wmat = new THREE.MeshBasicMaterial({
        color: 0xffb066,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), wmat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.waves.push({ mesh, mat: wmat, life: 0, maxLife: 1, from: 1, to: 2 });
    }

    for (let i = 0; i < 5; i++) {
      const l = new THREE.PointLight(0xffa860, 0, 40, 2);
      l.visible = false;
      scene.add(l);
      this.flashes.push(l);
      this.flashLife.push(0);
      this.flashPower.push(0);
    }
  }

  /* ---------------- 弾道 ---------------- */

  tracer(a: THREE.Vector3, b: THREE.Vector3, color: number, width = 0.05, life = 0.075) {
    if (this.tracers.length >= this.tracerCap) this.tracers.shift();
    this.tracers.push({
      a: a.clone(),
      b: b.clone(),
      color: new THREE.Color(color),
      width,
      life,
      maxLife: life,
    });
  }

  /** 継続照射ビーム（毎フレーム呼ぶ） */
  beam(a: THREE.Vector3, b: THREE.Vector3, color: number, width: number, dt: number) {
    this.tracer(a, b, color, width, Math.max(dt, 1 / 120) * 1.4);
  }

  /* ---------------- 雷撃 ---------------- */

  lightning(a: THREE.Vector3, b: THREE.Vector3, color = 0xd8a8ff, life = 0.14) {
    const bolt = this.bolts.find((x) => x.life <= 0) ?? this.bolts[0];
    const pos = bolt.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    const n = pos.count;
    const jitter = a.distanceTo(b) * 0.08;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      _v1.lerpVectors(a, b, t);
      if (i > 0 && i < n - 1) {
        _v1.x += randRange(-jitter, jitter);
        _v1.y += randRange(-jitter, jitter);
        _v1.z += randRange(-jitter, jitter);
      }
      pos.setXYZ(i, _v1.x, _v1.y, _v1.z);
    }
    pos.needsUpdate = true;
    bolt.mat.color.setHex(color);
    bolt.mat.opacity = 1;
    bolt.life = life;
    bolt.maxLife = life;
    bolt.line.visible = true;
  }

  /* ---------------- 爆発 ---------------- */

  shockwave(pos: THREE.Vector3, from: number, to: number, color: number, life = 0.35) {
    const w = this.waves.find((x) => x.life <= 0) ?? this.waves[0];
    w.mesh.position.copy(pos);
    w.mesh.visible = true;
    w.mat.color.setHex(color);
    w.mat.opacity = 0.85;
    w.life = life;
    w.maxLife = life;
    w.from = from;
    w.to = to;
    w.mesh.scale.setScalar(from);
  }

  flash(pos: THREE.Vector3, color: number, power: number, life = 0.22) {
    let idx = this.flashLife.findIndex((l) => l <= 0);
    if (idx < 0) idx = 0;
    const l = this.flashes[idx];
    l.position.copy(pos);
    l.color.setHex(color);
    l.intensity = power;
    l.distance = Math.max(24, power * 1.4);
    l.visible = true;
    this.flashLife[idx] = life;
    this.flashPower[idx] = power;
  }

  /** 爆発一式（衝撃波・閃光・火花・煙・破片） */
  explosion(pos: THREE.Vector3, radius: number, color = 0xffa64d, smokeColor = 0x50535c) {
    this.shockwave(pos, radius * 0.22, radius * 1.25, color, 0.34);
    this.flash(pos, color, radius * 0.85, 0.26);
    this.particles.sparks(pos, _up, Math.round(12 + radius * 3.4), {
      color,
      speed: 9 + radius * 3.2,
      spread: 1.25,
      size: 0.9 + radius * 0.25,
      life: 1.1,
    });
    this.particles.smoke(pos, Math.round(3 + radius * 1.3), {
      color: smokeColor,
      size: 0.7 + radius * 0.42,
      speed: 2 + radius * 0.6,
      life: 1.15,
    });
    this.particles.debris(pos, Math.round(3 + radius * 1.6), {
      color: 0x6b6f78,
      speed: 7 + radius * 1.6,
      size: 0.7 + radius * 0.2,
    });
  }

  update(dt: number, camQuat: THREE.Quaternion) {
    // トレーサー
    let n = 0;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      this.tracers[i].life -= dt;
      if (this.tracers[i].life <= 0) this.tracers.splice(i, 1);
    }
    for (const t of this.tracers) {
      if (n >= this.tracerCap) break;
      const k = t.life / t.maxLife;
      _v1.subVectors(t.b, t.a);
      const len = _v1.length();
      if (len < 0.0001) continue;
      _v2.copy(_v1).normalize();
      _q.setFromUnitVectors(_up, _v2);
      _v1.addVectors(t.a, t.b).multiplyScalar(0.5);
      _s.set(t.width * (0.4 + k * 0.6), len, t.width * (0.4 + k * 0.6));
      _m.compose(_v1, _q, _s);
      this.tracerMesh.setMatrixAt(n, _m);
      _c.copy(t.color).multiplyScalar(0.35 + k * 1.1);
      this.tracerMesh.setColorAt(n, _c);
      n++;
    }
    this.tracerMesh.count = n;
    this.tracerMesh.instanceMatrix.needsUpdate = true;
    if (this.tracerMesh.instanceColor) this.tracerMesh.instanceColor.needsUpdate = true;

    // 雷撃
    for (const b of this.bolts) {
      if (b.life <= 0) continue;
      b.life -= dt;
      const k = Math.max(0, b.life / b.maxLife);
      b.mat.opacity = k;
      if (b.life <= 0) b.line.visible = false;
    }

    // 衝撃波
    for (const w of this.waves) {
      if (w.life <= 0) continue;
      w.life -= dt;
      const k = Math.max(0, w.life / w.maxLife);
      const p = 1 - k;
      w.mesh.scale.setScalar(w.from + (w.to - w.from) * (1 - (1 - p) * (1 - p)));
      w.mat.opacity = k * k * 0.8;
      if (w.life <= 0) w.mesh.visible = false;
    }

    // 閃光
    for (let i = 0; i < this.flashes.length; i++) {
      if (this.flashLife[i] <= 0) continue;
      this.flashLife[i] -= dt;
      const k = Math.max(0, this.flashLife[i]);
      this.flashes[i].intensity = this.flashPower[i] * k * k * 12;
      if (this.flashLife[i] <= 0) this.flashes[i].visible = false;
    }

    this.particles.update(dt, camQuat);
  }

  clear() {
    this.tracers.length = 0;
    this.tracerMesh.count = 0;
    for (const b of this.bolts) {
      b.life = 0;
      b.line.visible = false;
    }
    for (const w of this.waves) {
      w.life = 0;
      w.mesh.visible = false;
    }
    for (let i = 0; i < this.flashes.length; i++) {
      this.flashLife[i] = 0;
      this.flashes[i].visible = false;
    }
    this.particles.clear();
  }

  get sceneRef() {
    return this.scene;
  }
}
