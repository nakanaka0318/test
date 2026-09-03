import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ENEMIES, type EnemyKind } from '../config';

export interface EnemyModel {
  root: THREE.Group;
  body: THREE.Mesh;
  legs: THREE.Mesh[];
  /** 追加パーツ（フライヤーのローターなど） */
  rotors: THREE.Object3D[];
}

interface KindAssets {
  bodyGeo: THREE.BufferGeometry;
  legGeo: THREE.BufferGeometry | null;
  materials: THREE.Material[];
  rotorGeo: THREE.BufferGeometry | null;
  rotorMat: THREE.Material | null;
  legMat: THREE.Material;
}

const cache = new Map<EnemyKind, KindAssets>();

export const FLASH_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });

function xf(
  geo: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.BufferGeometry {
  // インデックスの有無が混在すると mergeGeometries が失敗するため揃える
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
  g.applyMatrix4(m);
  return g;
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const SPHERE = new THREE.SphereGeometry(0.5, 12, 8);
const CONE = new THREE.ConeGeometry(0.5, 1, 6);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const OCT = new THREE.OctahedronGeometry(0.5, 0);
const TORUS = new THREE.TorusGeometry(0.5, 0.09, 6, 20);

/** 種別ごとの形状を組み立てる（2 マテリアル：本体 + 発光アクセント） */
function buildAssets(kind: EnemyKind): KindAssets {
  const def = ENEMIES[kind];
  const bodyParts: THREE.BufferGeometry[] = [];
  const accentParts: THREE.BufferGeometry[] = [];
  let legGeo: THREE.BufferGeometry | null = null;
  let rotorGeo: THREE.BufferGeometry | null = null;

  switch (kind) {
    case 'grunt': {
      bodyParts.push(xf(BOX, 0, 1.12, 0, 0.86, 0.92, 0.58));
      bodyParts.push(xf(BOX, 0, 1.5, 0, 1.12, 0.26, 0.66));
      bodyParts.push(xf(SPHERE, 0, 1.74, 0, 0.56, 0.56, 0.56));
      bodyParts.push(xf(BOX, 0.56, 1.18, 0, 0.2, 0.72, 0.2, 0, 0, -0.16));
      bodyParts.push(xf(BOX, -0.56, 1.18, 0, 0.2, 0.72, 0.2, 0, 0, 0.16));
      accentParts.push(xf(BOX, 0, 1.76, 0.27, 0.42, 0.12, 0.06));
      accentParts.push(xf(BOX, 0, 1.16, 0.3, 0.24, 0.24, 0.04));
      legGeo = xf(BOX, 0, -0.34, 0, 0.22, 0.68, 0.24);
      break;
    }
    case 'runner': {
      bodyParts.push(xf(BOX, 0, 1.02, 0, 0.6, 0.78, 0.46, 0.22, 0, 0));
      bodyParts.push(xf(SPHERE, 0, 1.46, 0.12, 0.44, 0.44, 0.5));
      bodyParts.push(xf(CONE, 0, 1.62, -0.16, 0.34, 0.5, 0.34, -0.5, 0, 0));
      bodyParts.push(xf(BOX, 0.38, 1.06, 0.06, 0.14, 0.6, 0.14, 0.4, 0, 0));
      bodyParts.push(xf(BOX, -0.38, 1.06, 0.06, 0.14, 0.6, 0.14, 0.4, 0, 0));
      accentParts.push(xf(BOX, 0, 1.5, 0.34, 0.34, 0.09, 0.05));
      legGeo = xf(BOX, 0, -0.3, 0, 0.16, 0.62, 0.18);
      break;
    }
    case 'flyer': {
      bodyParts.push(xf(SPHERE, 0, 0, 0, 1.0, 0.78, 1.0));
      bodyParts.push(xf(CYL, 0, 0.42, 0, 0.34, 0.28, 0.34));
      accentParts.push(xf(SPHERE, 0, -0.18, 0, 0.5, 0.4, 0.5));
      accentParts.push(xf(TORUS, 0, 0.05, 0, 1.7, 1.7, 1.7, Math.PI / 2, 0, 0));
      rotorGeo = mergeGeometries([
        xf(BOX, 0.75, 0, 0, 0.9, 0.06, 0.16),
        xf(BOX, -0.75, 0, 0, 0.9, 0.06, 0.16),
        xf(BOX, 0, 0, 0.75, 0.16, 0.06, 0.9),
        xf(BOX, 0, 0, -0.75, 0.16, 0.06, 0.9),
      ]) as THREE.BufferGeometry;
      break;
    }
    case 'stinger': {
      bodyParts.push(xf(BOX, 0, 1.16, 0, 0.78, 1.0, 0.6));
      bodyParts.push(xf(SPHERE, 0, 1.82, 0, 0.5, 0.56, 0.5));
      bodyParts.push(xf(BOX, -0.5, 1.3, 0, 0.22, 0.7, 0.22));
      bodyParts.push(xf(CYL, 0.62, 1.34, 0.24, 0.22, 1.1, 0.22, Math.PI / 2, 0, 0));
      accentParts.push(xf(CYL, 0.62, 1.34, 0.82, 0.13, 0.16, 0.13, Math.PI / 2, 0, 0));
      accentParts.push(xf(BOX, 0, 1.84, 0.26, 0.38, 0.1, 0.06));
      accentParts.push(xf(BOX, 0, 1.3, 0.31, 0.3, 0.42, 0.04));
      legGeo = xf(BOX, 0, -0.36, 0, 0.2, 0.72, 0.22);
      break;
    }
    case 'brute': {
      bodyParts.push(xf(BOX, 0, 1.95, 0, 1.7, 1.5, 1.1));
      bodyParts.push(xf(SPHERE, 1.0, 2.5, 0, 0.95, 0.95, 0.95));
      bodyParts.push(xf(SPHERE, -1.0, 2.5, 0, 0.95, 0.95, 0.95));
      bodyParts.push(xf(SPHERE, 0, 2.86, 0.05, 0.62, 0.62, 0.62));
      bodyParts.push(xf(BOX, 1.16, 1.72, 0.1, 0.42, 1.3, 0.42, 0.18, 0, 0));
      bodyParts.push(xf(BOX, -1.16, 1.72, 0.1, 0.42, 1.3, 0.42, 0.18, 0, 0));
      accentParts.push(xf(OCT, 0, 2.05, 0.58, 0.7, 0.7, 0.35));
      accentParts.push(xf(BOX, 0, 2.9, 0.36, 0.5, 0.12, 0.06));
      legGeo = xf(BOX, 0, -0.6, 0, 0.44, 1.2, 0.46);
      break;
    }
    case 'titan': {
      bodyParts.push(xf(BOX, 0, 4.0, 0, 3.0, 2.6, 1.9));
      bodyParts.push(xf(BOX, 0, 5.5, 0, 2.2, 0.7, 1.6));
      bodyParts.push(xf(SPHERE, 1.85, 5.1, 0, 1.5, 1.5, 1.5));
      bodyParts.push(xf(SPHERE, -1.85, 5.1, 0, 1.5, 1.5, 1.5));
      bodyParts.push(xf(SPHERE, 0, 5.95, 0.1, 1.0, 1.0, 1.0));
      bodyParts.push(xf(CONE, 0.62, 6.5, 0, 0.34, 0.9, 0.34, 0, 0, 0.3));
      bodyParts.push(xf(CONE, -0.62, 6.5, 0, 0.34, 0.9, 0.34, 0, 0, -0.3));
      bodyParts.push(xf(BOX, 2.2, 3.5, 0.1, 0.8, 2.4, 0.8, 0.16, 0, 0));
      bodyParts.push(xf(BOX, -2.2, 3.5, 0.1, 0.8, 2.4, 0.8, 0.16, 0, 0));
      bodyParts.push(xf(CYL, 2.5, 2.1, 0.5, 0.5, 1.7, 0.5, Math.PI / 2.2, 0, 0));
      accentParts.push(xf(OCT, 0, 4.2, 1.05, 1.5, 1.7, 0.7));
      accentParts.push(xf(BOX, 0, 6.02, 0.72, 0.9, 0.18, 0.1));
      accentParts.push(xf(TORUS, 0, 4.2, 1.02, 2.6, 2.6, 1.4));
      legGeo = xf(BOX, 0, -1.2, 0, 0.9, 2.4, 0.95);
      break;
    }
  }

  const bodyGeo = mergeGeometries(bodyParts) as THREE.BufferGeometry;
  const accentGeo = accentParts.length ? (mergeGeometries(accentParts) as THREE.BufferGeometry) : null;

  let merged: THREE.BufferGeometry;
  if (accentGeo) {
    merged = mergeGeometries([bodyGeo, accentGeo], true) as THREE.BufferGeometry;
  } else {
    merged = bodyGeo;
    merged.addGroup(0, Infinity, 0);
  }

  const bodyMat = new THREE.MeshStandardMaterial({
    color: def.color,
    // 夜間でもシルエットが沈まないよう、わずかに自発光させる
    emissive: new THREE.Color(def.color).multiplyScalar(0.22),
    roughness: 0.68,
    metalness: 0.12,
    flatShading: true,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: def.accent,
    emissive: def.accent,
    emissiveIntensity: 2.8,
    roughness: 0.3,
    metalness: 0,
    toneMapped: true,
  });
  const legMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(def.color).multiplyScalar(0.7),
    emissive: new THREE.Color(def.color).multiplyScalar(0.12),
    roughness: 0.75,
    metalness: 0.12,
    flatShading: true,
  });

  return {
    bodyGeo: merged,
    legGeo,
    legMat,
    materials: accentGeo ? [bodyMat, accentMat] : [bodyMat],
    rotorGeo,
    rotorMat: rotorGeo
      ? new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.5, metalness: 0.6 })
      : null,
  };
}

function assets(kind: EnemyKind): KindAssets {
  let a = cache.get(kind);
  if (!a) {
    a = buildAssets(kind);
    cache.set(kind, a);
  }
  return a;
}

export function createEnemyModel(kind: EnemyKind, castShadow: boolean): EnemyModel {
  const a = assets(kind);
  const root = new THREE.Group();
  const body = new THREE.Mesh(a.bodyGeo, a.materials.length > 1 ? a.materials : a.materials[0]);
  body.castShadow = castShadow;
  body.receiveShadow = true;
  root.add(body);

  const legs: THREE.Mesh[] = [];
  if (a.legGeo) {
    const offset = kind === 'titan' ? 1.05 : kind === 'brute' ? 0.62 : 0.26;
    const legY = kind === 'titan' ? 2.4 : kind === 'brute' ? 1.2 : 0.68;
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(a.legGeo, a.legMat);
      leg.position.set(sx * offset, legY, 0);
      leg.castShadow = castShadow;
      legs.push(leg);
      root.add(leg);
    }
  }

  const rotors: THREE.Object3D[] = [];
  if (a.rotorGeo && a.rotorMat) {
    const r = new THREE.Mesh(a.rotorGeo, a.rotorMat);
    r.position.y = 0.4;
    root.add(r);
    rotors.push(r);
  }

  return { root, body, legs, rotors };
}
