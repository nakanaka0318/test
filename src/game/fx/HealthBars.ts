import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _right = new THREE.Vector3();

/** 敵の頭上に表示するビルボードHPバー（2 ドローコール） */
export class HealthBars {
  private bg: THREE.InstancedMesh;
  private fill: THREE.InstancedMesh;
  private index = 0;
  private capacity: number;

  constructor(scene: THREE.Scene, capacity = 300) {
    this.capacity = capacity;
    const geo = new THREE.PlaneGeometry(1, 1);
    const bgMat = new THREE.MeshBasicMaterial({
      color: 0x05070c,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      toneMapped: false,
    });
    const fillMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      toneMapped: false,
    });
    this.bg = new THREE.InstancedMesh(geo, bgMat, capacity);
    this.fill = new THREE.InstancedMesh(geo, fillMat, capacity);
    for (const m of [this.bg, this.fill]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = 0;
      m.renderOrder = 5;
      scene.add(m);
    }
    this.fill.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
    this.fill.instanceColor.setUsage(THREE.DynamicDrawUsage);
  }

  begin(camQuat: THREE.Quaternion) {
    this.index = 0;
    _right.set(1, 0, 0).applyQuaternion(camQuat);
  }

  add(pos: THREE.Vector3, ratio: number, width: number, camQuat: THREE.Quaternion, elite = false) {
    if (this.index >= this.capacity) return;
    const i = this.index++;
    const h = elite ? 0.3 : 0.2;
    _s.set(width, h, 1);
    _m.compose(pos, camQuat, _s);
    this.bg.setMatrixAt(i, _m);

    const r = Math.max(0, Math.min(1, ratio));
    _p.copy(pos).addScaledVector(_right, -(width * (1 - r)) / 2);
    _s.set(Math.max(0.001, width * r - 0.04), h - 0.06, 1);
    _m.compose(_p, camQuat, _s);
    this.fill.setMatrixAt(i, _m);
    _c.setHSL(r * 0.33, 0.95, elite ? 0.58 : 0.5);
    this.fill.setColorAt(i, _c);
  }

  end() {
    this.bg.count = this.index;
    this.fill.count = this.index;
    this.bg.instanceMatrix.needsUpdate = true;
    this.fill.instanceMatrix.needsUpdate = true;
    if (this.fill.instanceColor) this.fill.instanceColor.needsUpdate = true;
  }

  clear() {
    this.index = 0;
    this.bg.count = 0;
    this.fill.count = 0;
  }
}
