import * as THREE from 'three';
import type { WeaponKind } from '../config';

const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2f3540, roughness: 0.45, metalness: 0.75, flatShading: true });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1e26, roughness: 0.6, metalness: 0.5, flatShading: true });
const gripMat = new THREE.MeshStandardMaterial({ color: 0x3b3026, roughness: 0.85, metalness: 0.1 });
const glowBlue = new THREE.MeshStandardMaterial({
  color: 0x8ef0ff,
  emissive: 0x35c8ff,
  emissiveIntensity: 3,
  roughness: 0.25,
});
const glowAmber = new THREE.MeshStandardMaterial({
  color: 0xffd18a,
  emissive: 0xff9c3a,
  emissiveIntensity: 2.4,
  roughness: 0.3,
});

function box(mat: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

function cyl(mat: THREE.Material, x: number, y: number, z: number, r1: number, r2: number, h: number, rx = Math.PI / 2) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 10), mat);
  m.position.set(x, y, z);
  m.rotation.x = rx;
  return m;
}

/** ビューモデル（手持ち武器）を組み立てる。原点＝カメラ基準 */
export function createWeaponModel(kind: WeaponKind): THREE.Group {
  const g = new THREE.Group();

  if (kind === 'rifle') {
    g.add(box(bodyMat, 0, 0, 0.1, 0.09, 0.12, 0.62));
    g.add(box(darkMat, 0, -0.02, -0.28, 0.07, 0.1, 0.28));
    g.add(box(gripMat, 0, -0.11, -0.02, 0.06, 0.16, 0.09, 0.28));
    g.add(box(darkMat, 0, -0.13, 0.12, 0.055, 0.18, 0.12, -0.12));
    g.add(cyl(darkMat, 0, 0.015, 0.52, 0.022, 0.022, 0.36));
    g.add(box(darkMat, 0, 0.085, 0.06, 0.05, 0.045, 0.3));
    g.add(box(darkMat, 0, 0.13, 0.0, 0.035, 0.05, 0.14));
    g.add(box(glowAmber, 0, 0.135, 0.02, 0.02, 0.02, 0.02));
    g.add(box(glowBlue, 0.049, 0.0, 0.02, 0.005, 0.018, 0.07));
  } else if (kind === 'shotgun') {
    g.add(box(bodyMat, 0, 0, 0.06, 0.11, 0.14, 0.5));
    g.add(cyl(darkMat, 0.03, 0.045, 0.46, 0.032, 0.032, 0.5));
    g.add(cyl(darkMat, -0.03, 0.045, 0.46, 0.032, 0.032, 0.5));
    g.add(cyl(bodyMat, 0, -0.04, 0.34, 0.045, 0.045, 0.3));
    g.add(box(gripMat, 0, -0.12, -0.1, 0.06, 0.17, 0.1, 0.3));
    g.add(box(gripMat, 0, -0.04, 0.3, 0.075, 0.07, 0.14));
    g.add(box(darkMat, 0, -0.05, -0.26, 0.08, 0.13, 0.24, -0.08));
    g.add(box(glowAmber, 0.058, 0.02, 0.0, 0.006, 0.028, 0.12));
  } else {
    g.add(box(bodyMat, 0, 0, 0.06, 0.1, 0.15, 0.66));
    g.add(box(darkMat, 0, 0.02, 0.62, 0.07, 0.07, 0.62));
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.016, 6, 14), glowBlue);
      ring.position.set(0, 0.02, 0.42 + i * 0.16);
      g.add(ring);
    }
    g.add(box(gripMat, 0, -0.13, -0.06, 0.06, 0.18, 0.1, 0.26));
    g.add(box(darkMat, 0, -0.06, -0.3, 0.08, 0.12, 0.26, -0.1));
    g.add(box(glowBlue, 0, 0.11, 0.06, 0.04, 0.02, 0.34));
    g.add(cyl(glowBlue, 0, 0.02, 0.94, 0.03, 0.045, 0.05));
  }

  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = false;
      m.receiveShadow = false;
      m.renderOrder = 10;
      const mat = m.material as THREE.Material;
      mat.depthTest = true;
    }
  });
  return g;
}

/** 銃口の位置（カメラ空間） */
export const MUZZLE_OFFSET: Record<WeaponKind, THREE.Vector3> = {
  rifle: new THREE.Vector3(0.2, -0.14, 1.02),
  shotgun: new THREE.Vector3(0.2, -0.13, 0.98),
  railgun: new THREE.Vector3(0.2, -0.14, 1.18),
};
