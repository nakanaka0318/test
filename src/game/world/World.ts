import * as THREE from 'three';
import {
  CELL_SIZE,
  CORE_HEIGHT,
  CORE_RADIUS,
  GRID_SIZE,
  MAP_EXTENT,
} from '../config';
import { clamp, damp, lerp } from '../core/util';
import { CELL_BLOCKED, CELL_PATH, GameMap, cellToWorldX, cellToWorldZ } from './map';
import { concreteTexture, laneTexture, noiseRoughness, panelTexture } from './textures';

const UP_FIX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

export class World {
  readonly group = new THREE.Group();
  readonly map: GameMap;

  /** ビルドモードの表示物 */
  readonly buildOverlay = new THREE.Group();
  private hoverMarker: THREE.Mesh;
  private rangeRing: THREE.Mesh;

  private coreGroup = new THREE.Group();
  private coreCrystal!: THREE.Mesh;
  private coreRingA!: THREE.Mesh;
  private coreRingB!: THREE.Mesh;
  private coreLight!: THREE.PointLight;
  private coreShield!: THREE.Mesh;
  private coreBaseRing!: THREE.Mesh;
  private shieldFlash = 0;
  private time = 0;

  constructor(map: GameMap) {
    this.map = map;
    this.buildGround();
    this.buildLanes();
    this.buildWalls();
    this.buildProps();
    this.buildGates();
    this.buildHorizon();
    this.buildCore();
    this.buildOverlayObjects();

    this.hoverMarker = this.buildOverlay.getObjectByName('hover') as THREE.Mesh;
    this.rangeRing = this.buildOverlay.getObjectByName('range') as THREE.Mesh;
    this.group.add(this.buildOverlay);
    this.buildOverlay.visible = false;
  }

  /* ---------------- 地形 ---------------- */

  private buildGround() {
    const tex = concreteTexture(46, '#252b3a', '#39415a');
    const rough = noiseRoughness(46, 200, 40);
    const geo = new THREE.PlaneGeometry(560, 560, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughnessMap: rough,
      roughness: 0.95,
      metalness: 0.04,
      color: 0xffffff,
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.group.add(ground);

    // 基地の床（マップ範囲だけ少し明るい）
    const padTex = concreteTexture(GRID_SIZE * 0.5, '#2e3547', '#454e66');
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_EXTENT * 2, MAP_EXTENT * 2),
      new THREE.MeshStandardMaterial({
        map: padTex,
        roughnessMap: noiseRoughness(GRID_SIZE * 0.5),
        roughness: 0.88,
        metalness: 0.08,
      }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.01;
    pad.receiveShadow = true;
    this.group.add(pad);
  }

  private buildLanes() {
    const cells: number[] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (this.map.get(x, y) === CELL_PATH) cells.push(y * GRID_SIZE + x);
      }
    }
    const mat = new THREE.MeshStandardMaterial({
      map: laneTexture(),
      roughness: 0.82,
      metalness: 0.05,
      emissive: 0x2a0d06,
      emissiveIntensity: 0.6,
    });
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE), mat, cells.length);
    mesh.receiveShadow = true;
    const dummy = new THREE.Object3D();
    const qy = new THREE.Quaternion();
    cells.forEach((idx, i) => {
      const x = idx % GRID_SIZE;
      const y = Math.floor(idx / GRID_SIZE);
      dummy.position.set(cellToWorldX(x), 0.045, cellToWorldZ(y));
      qy.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.map.pathDir[idx] + Math.PI);
      dummy.quaternion.multiplyQuaternions(qy, UP_FIX);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
  }

  private buildWalls() {
    const list: [number, number][] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const border = x === 0 || y === 0 || x === GRID_SIZE - 1 || y === GRID_SIZE - 1;
        if (border && this.map.get(x, y) === CELL_BLOCKED) list.push([x, y]);
      }
    }
    const mat = new THREE.MeshStandardMaterial({
      map: panelTexture(1, '#39415a', '#1c2130'),
      roughness: 0.7,
      metalness: 0.35,
    });
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL_SIZE, 5.5, CELL_SIZE), mat, list.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const dummy = new THREE.Object3D();
    list.forEach(([x, y], i) => {
      dummy.position.set(cellToWorldX(x), 2.75, cellToWorldZ(y));
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);

    // 壁の上端に発光ライン
    const rimMat = new THREE.MeshBasicMaterial({ color: 0x4d7dff, toneMapped: false });
    const rim = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL_SIZE * 0.98, 0.12, CELL_SIZE * 0.98), rimMat, list.length);
    list.forEach(([x, y], i) => {
      dummy.position.set(cellToWorldX(x), 5.56, cellToWorldZ(y));
      dummy.updateMatrix();
      rim.setMatrixAt(i, dummy.matrix);
    });
    rim.instanceMatrix.needsUpdate = true;
    this.group.add(rim);
  }

  private buildProps() {
    const byKind = { rock: [], crate: [], pillar: [] } as Record<string, typeof this.map.props>;
    for (const p of this.map.props) byKind[p.kind].push(p);

    const configs: Array<[string, THREE.BufferGeometry, THREE.Material]> = [
      [
        'rock',
        new THREE.IcosahedronGeometry(1, 0),
        new THREE.MeshStandardMaterial({ color: 0x4a5163, roughness: 1, metalness: 0, flatShading: true }),
      ],
      [
        'crate',
        new THREE.BoxGeometry(1.8, 1.8, 1.8),
        new THREE.MeshStandardMaterial({
          map: panelTexture(1, '#5a6a55', '#28311f'),
          roughness: 0.75,
          metalness: 0.2,
        }),
      ],
      [
        'pillar',
        new THREE.CylinderGeometry(0.7, 0.9, 1, 8),
        new THREE.MeshStandardMaterial({
          map: panelTexture(1, '#464e63', '#1e2431'),
          roughness: 0.6,
          metalness: 0.45,
        }),
      ],
    ];

    const dummy = new THREE.Object3D();
    for (const [kind, geo, mat] of configs) {
      const items = byKind[kind];
      if (!items.length) continue;
      const mesh = new THREE.InstancedMesh(geo, mat, items.length);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      items.forEach((p, i) => {
        if (kind === 'rock') {
          dummy.position.set(p.x, p.height * 0.42, p.z);
          dummy.scale.set(p.radius * 1.1, p.height * 0.6, p.radius * 1.1);
        } else if (kind === 'crate') {
          dummy.position.set(p.x, 0.9, p.z);
          dummy.scale.set(1, 1, 1);
        } else {
          dummy.position.set(p.x, p.height / 2, p.z);
          dummy.scale.set(1, p.height, 1);
        }
        dummy.rotation.set(0, p.rotation, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.group.add(mesh);
    }
  }

  private buildGates() {
    const frameMat = new THREE.MeshStandardMaterial({
      map: panelTexture(1, '#3d3038', '#1a1418'),
      roughness: 0.55,
      metalness: 0.6,
    });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, toneMapped: false });

    for (const lane of this.map.lanes) {
      const g = new THREE.Group();
      const w = CELL_SIZE * 3.4;
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(1.4, 9, 1.8), frameMat);
        post.position.set((sx * w) / 2, 4.5, 0);
        post.castShadow = true;
        g.add(post);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(w + 1.4, 1.6, 2), frameMat);
      beam.position.y = 8.4;
      beam.castShadow = true;
      g.add(beam);

      const glow = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.4, 7.6), glowMat);
      glow.position.set(0, 4.2, 0.1);
      glow.material.transparent = true;
      glow.material.opacity = 0.16;
      g.add(glow);

      const strip = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.16, 0.3), glowMat);
      strip.position.set(0, 7.5, 1.05);
      g.add(strip);

      g.position.copy(lane.spawn);
      g.position.y = 0;
      g.rotation.y = lane.angle;
      this.group.add(g);
    }
  }

  private buildHorizon() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1a2033,
      roughness: 1,
      metalness: 0,
      flatShading: true,
      fog: true,
    });
    const geo = new THREE.ConeGeometry(1, 1, 5, 1);
    const count = 46;
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rnd() * 0.09;
      const r = 210 + rnd() * 90;
      const h = 34 + rnd() * 74;
      dummy.position.set(Math.cos(a) * r, h / 2 - 6, Math.sin(a) * r);
      dummy.scale.set(30 + rnd() * 44, h, 30 + rnd() * 44);
      dummy.rotation.set(0, rnd() * Math.PI, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
  }

  /* ---------------- コア（防衛目標） ---------------- */

  private buildCore() {
    const g = this.coreGroup;
    const metal = new THREE.MeshStandardMaterial({
      map: panelTexture(2, '#59637d', '#242a38'),
      roughness: 0.42,
      metalness: 0.75,
    });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(CORE_RADIUS + 1.6, CORE_RADIUS + 2.4, 1.1, 8), metal);
    base.position.y = 0.55;
    base.castShadow = true;
    base.receiveShadow = true;
    g.add(base);

    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(CORE_RADIUS * 0.72, CORE_RADIUS, 1.8, 8), metal);
    plinth.position.y = 1.9;
    plinth.castShadow = true;
    g.add(plinth);

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 5.4, 0.7), metal);
      pillar.position.set(Math.cos(a) * (CORE_RADIUS + 0.7), 3.4, Math.sin(a) * (CORE_RADIUS + 0.7));
      pillar.castShadow = true;
      g.add(pillar);
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.35, 0.95),
        new THREE.MeshBasicMaterial({ color: 0x64f4ff, toneMapped: false }),
      );
      cap.position.set(Math.cos(a) * (CORE_RADIUS + 0.7), 6.2, Math.sin(a) * (CORE_RADIUS + 0.7));
      g.add(cap);
    }

    this.coreCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.85, 0),
      new THREE.MeshStandardMaterial({
        color: 0x9ff5ff,
        emissive: 0x21d4ff,
        emissiveIntensity: 1.15,
        roughness: 0.15,
        metalness: 0.1,
        flatShading: true,
      }),
    );
    this.coreCrystal.position.y = CORE_HEIGHT * 0.62;
    this.coreCrystal.castShadow = true;
    g.add(this.coreCrystal);

    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x2b3550,
      emissive: 0x1e88ff,
      emissiveIntensity: 0.75,
      roughness: 0.3,
      metalness: 0.8,
    });
    this.coreRingA = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.14, 8, 48), ringMat);
    this.coreRingA.position.y = CORE_HEIGHT * 0.62;
    this.coreRingA.rotation.x = Math.PI / 2.4;
    g.add(this.coreRingA);

    this.coreRingB = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.1, 8, 48), ringMat);
    this.coreRingB.position.y = CORE_HEIGHT * 0.62;
    this.coreRingB.rotation.set(Math.PI / 2, 0.5, 0);
    g.add(this.coreRingB);

    this.coreLight = new THREE.PointLight(0x39d9ff, 34, 44, 2);
    this.coreLight.position.y = CORE_HEIGHT * 0.62;
    g.add(this.coreLight);

    this.coreShield = new THREE.Mesh(
      new THREE.SphereGeometry(CORE_RADIUS + 3.4, 24, 16),
      new THREE.MeshBasicMaterial({
        color: 0x69e7ff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        wireframe: true,
        toneMapped: false,
      }),
    );
    this.coreShield.position.y = 3.4;
    g.add(this.coreShield);

    this.coreBaseRing = new THREE.Mesh(
      new THREE.RingGeometry(CORE_RADIUS + 2.6, CORE_RADIUS + 3.5, 48),
      new THREE.MeshBasicMaterial({
        color: 0x35e0ff,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    this.coreBaseRing.rotation.x = -Math.PI / 2;
    this.coreBaseRing.position.y = 0.09;
    g.add(this.coreBaseRing);

    this.group.add(g);
  }

  /* ---------------- ビルドモードのオーバーレイ ---------------- */

  private buildOverlayObjects() {
    const cells: [number, number][] = [];
    for (let y = 1; y < GRID_SIZE - 1; y++) {
      for (let x = 1; x < GRID_SIZE - 1; x++) {
        if (this.map.isBuildable(x, y)) cells.push([x, y]);
      }
    }
    const mat = new THREE.MeshBasicMaterial({
      color: 0x2ad8a0,
      transparent: true,
      opacity: 0.05,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(CELL_SIZE * 0.9, CELL_SIZE * 0.9), mat, cells.length);
    const dummy = new THREE.Object3D();
    cells.forEach(([x, y], i) => {
      dummy.position.set(cellToWorldX(x), 0.07, cellToWorldZ(y));
      dummy.quaternion.copy(UP_FIX);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.name = 'buildable';
    this.buildOverlay.add(mesh);

    const hover = new THREE.Mesh(
      new THREE.PlaneGeometry(CELL_SIZE, CELL_SIZE),
      new THREE.MeshBasicMaterial({
        color: 0x6effc0,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    hover.quaternion.copy(UP_FIX);
    hover.position.y = 0.12;
    hover.name = 'hover';
    this.buildOverlay.add(hover);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.97, 1, 64),
      new THREE.MeshBasicMaterial({
        color: 0x8fe9ff,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    ring.quaternion.copy(UP_FIX);
    ring.position.y = 0.14;
    ring.name = 'range';
    ring.visible = false;
    this.buildOverlay.add(ring);
  }

  setBuildMode(on: boolean) {
    this.buildOverlay.visible = on;
    if (!on) this.rangeRing.visible = false;
  }

  setHover(x: number, z: number, valid: boolean, visible: boolean) {
    this.hoverMarker.visible = visible;
    this.hoverMarker.position.set(x, 0.12, z);
    (this.hoverMarker.material as THREE.MeshBasicMaterial).color.setHex(valid ? 0x6effc0 : 0xff5a4a);
  }

  setRangePreview(x: number, z: number, radius: number, visible: boolean) {
    this.rangeRing.visible = visible;
    if (!visible) return;
    this.rangeRing.position.set(x, 0.14, z);
    this.rangeRing.scale.set(radius, radius, 1);
  }

  /* ---------------- 更新 ---------------- */

  coreHit() {
    this.shieldFlash = 1;
  }

  setCoreHpRatio(r: number) {
    const col = new THREE.Color().setHSL(lerp(0, 0.52, clamp(r, 0, 1)), 0.9, 0.55);
    (this.coreBaseRing.material as THREE.MeshBasicMaterial).color.copy(col);
    (this.coreCrystal.material as THREE.MeshStandardMaterial).emissive.copy(col);
    this.coreLight.color.copy(col);
  }

  update(dt: number) {
    this.time += dt;
    const t = this.time;
    this.coreCrystal.rotation.y += dt * 0.8;
    this.coreCrystal.rotation.x = Math.sin(t * 0.6) * 0.22;
    this.coreCrystal.position.y = CORE_HEIGHT * 0.62 + Math.sin(t * 1.4) * 0.28;
    this.coreRingA.rotation.z += dt * 0.9;
    this.coreRingB.rotation.z -= dt * 0.55;
    this.coreRingB.rotation.x = Math.PI / 2 + Math.sin(t * 0.5) * 0.25;
    this.coreLight.intensity = 32 + Math.sin(t * 3.1) * 6;

    if (this.shieldFlash > 0) {
      this.shieldFlash = Math.max(0, this.shieldFlash - dt * 2.6);
      const m = this.coreShield.material as THREE.MeshBasicMaterial;
      m.opacity = this.shieldFlash * 0.34;
      const s = 1 + (1 - this.shieldFlash) * 0.05;
      this.coreShield.scale.setScalar(s);
    } else {
      (this.coreShield.material as THREE.MeshBasicMaterial).opacity = 0;
    }

    const ringMat = this.coreBaseRing.material as THREE.MeshBasicMaterial;
    ringMat.opacity = damp(ringMat.opacity, 0.42 + Math.sin(t * 2) * 0.12, 6, dt);
  }
}
