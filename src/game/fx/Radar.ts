import type * as THREE from 'three';
import { MAP_EXTENT } from '../config';
import type { Enemy } from '../entities/EnemySystem';
import type { Tower } from '../entities/TowerSystem';
import type { GameMap } from '../world/map';

const SIZE = 178;
const PAD = 9;

/** 戦域レーダー（北が上）。どのゲートが攻められているか一目で分かるようにする */
export class Radar {
  readonly root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private map: GameMap;
  private scale: number;
  private timer = 0;

  constructor(parent: HTMLElement, map: GameMap) {
    this.map = map;
    this.root = document.createElement('div');
    this.root.className = 'radar';
    this.canvas = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = SIZE * dpr;
    this.canvas.height = SIZE * dpr;
    this.canvas.style.width = `${SIZE}px`;
    this.canvas.style.height = `${SIZE}px`;
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.ctx.scale(dpr, dpr);
    this.root.appendChild(this.canvas);
    const label = document.createElement('span');
    label.className = 'radar-label';
    label.textContent = 'TACTICAL RADAR';
    this.root.appendChild(label);
    parent.appendChild(this.root);
    this.scale = (SIZE / 2 - PAD) / MAP_EXTENT;
  }

  setVisible(v: boolean) {
    this.root.style.display = v ? 'block' : 'none';
  }

  private toX(x: number) {
    return SIZE / 2 + x * this.scale;
  }

  private toY(z: number) {
    return SIZE / 2 + z * this.scale;
  }

  update(
    dt: number,
    enemies: Enemy[],
    towers: Tower[],
    playerPos: THREE.Vector3,
    playerYaw: number,
    coreRatio: number,
  ) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 1 / 20;

    const c = this.ctx;
    c.clearRect(0, 0, SIZE, SIZE);

    // 背景
    c.fillStyle = 'rgba(5, 12, 20, 0.72)';
    c.fillRect(0, 0, SIZE, SIZE);
    c.strokeStyle = 'rgba(120, 200, 255, 0.16)';
    c.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const p = PAD + ((SIZE - PAD * 2) * i) / 4;
      c.beginPath();
      c.moveTo(p, PAD);
      c.lineTo(p, SIZE - PAD);
      c.moveTo(PAD, p);
      c.lineTo(SIZE - PAD, p);
      c.stroke();
    }
    c.strokeStyle = 'rgba(120, 200, 255, 0.4)';
    c.strokeRect(PAD, PAD, SIZE - PAD * 2, SIZE - PAD * 2);

    // 侵攻ルート
    c.strokeStyle = 'rgba(255, 110, 80, 0.42)';
    c.lineWidth = 3;
    for (const lane of this.map.lanes) {
      c.beginPath();
      lane.points.forEach((p, i) => {
        const x = this.toX(p.x);
        const y = this.toY(p.z);
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      });
      c.stroke();
    }

    // タワー
    for (const t of towers) {
      c.fillStyle = `#${t.def.color.toString(16).padStart(6, '0')}`;
      c.fillRect(this.toX(t.pos.x) - 2.5, this.toY(t.pos.z) - 2.5, 5, 5);
    }

    // コア
    const coreX = this.toX(0);
    const coreY = this.toY(0);
    c.save();
    c.translate(coreX, coreY);
    c.rotate(Math.PI / 4);
    c.fillStyle = coreRatio < 0.3 ? '#ff5a4a' : '#5fe6ff';
    c.shadowColor = c.fillStyle;
    c.shadowBlur = 8;
    c.fillRect(-4, -4, 8, 8);
    c.restore();
    c.shadowBlur = 0;

    // 敵
    for (const e of enemies) {
      if (!e.active || e.dying > 0) continue;
      const x = this.toX(e.pos.x);
      const y = this.toY(e.pos.z);
      const r = e.def.elite ? 3.6 : 2.1;
      c.fillStyle = e.flying ? '#d78cff' : e.def.elite ? '#ff8a3a' : '#ff4b3a';
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }

    // プレイヤー
    const px = this.toX(playerPos.x);
    const py = this.toY(playerPos.z);
    c.save();
    c.translate(px, py);
    c.rotate(-playerYaw + Math.PI);
    c.fillStyle = '#6effc0';
    c.beginPath();
    c.moveTo(0, -6);
    c.lineTo(4.4, 5);
    c.lineTo(0, 2.6);
    c.lineTo(-4.4, 5);
    c.closePath();
    c.fill();
    c.restore();
  }

  dispose() {
    this.root.remove();
  }
}
