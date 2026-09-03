import * as THREE from 'three';
import { clamp } from '../core/util';

interface FloatText {
  el: HTMLDivElement;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
}

const _p = new THREE.Vector3();

/** 画面に重ねる 2D 演出（クロスヘア・ヒットマーカー・ダメージ表示） */
export class ScreenFX {
  readonly root: HTMLDivElement;
  private crosshair: HTMLDivElement;
  private crossParts: HTMLDivElement[] = [];
  private hitEl: HTMLDivElement;
  private vignette: HTMLDivElement;
  private lowHp: HTMLDivElement;
  private texts: FloatText[] = [];

  private hitTimer = 0;
  private hitCrit = false;
  private damageFlash = 0;
  private spread = 6;
  private targetSpread = 6;

  constructor(parent: HTMLElement) {
    const root = document.createElement('div');
    root.className = 'screen-fx';
    parent.appendChild(root);
    this.root = root;

    this.vignette = document.createElement('div');
    this.vignette.className = 'fx-damage-vignette';
    root.appendChild(this.vignette);

    this.lowHp = document.createElement('div');
    this.lowHp.className = 'fx-lowhp-vignette';
    root.appendChild(this.lowHp);

    this.crosshair = document.createElement('div');
    this.crosshair.className = 'fx-crosshair';
    root.appendChild(this.crosshair);
    for (const cls of ['t', 'b', 'l', 'r']) {
      const d = document.createElement('div');
      d.className = `fx-cross-line fx-cross-${cls}`;
      this.crosshair.appendChild(d);
      this.crossParts.push(d);
    }
    const dot = document.createElement('div');
    dot.className = 'fx-cross-dot';
    this.crosshair.appendChild(dot);

    this.hitEl = document.createElement('div');
    this.hitEl.className = 'fx-hitmarker';
    this.hitEl.innerHTML = '<span></span><span></span><span></span><span></span>';
    root.appendChild(this.hitEl);

    for (let i = 0; i < 34; i++) {
      const el = document.createElement('div');
      el.className = 'fx-damage-number';
      el.style.opacity = '0';
      root.appendChild(el);
      this.texts.push({
        el,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        active: false,
      });
    }
  }

  setCrosshairVisible(v: boolean) {
    this.crosshair.style.display = v ? 'block' : 'none';
  }

  setSpread(px: number) {
    this.targetSpread = px;
  }

  kick(px: number) {
    this.spread += px;
  }

  hitmarker(crit: boolean) {
    this.hitTimer = crit ? 0.28 : 0.18;
    this.hitCrit = crit;
  }

  damageTaken(intensity: number) {
    this.damageFlash = Math.min(1, this.damageFlash + intensity);
  }

  setLowHealth(ratio: number) {
    const v = clamp((0.42 - ratio) / 0.42, 0, 1);
    this.lowHp.style.opacity = String(v * 0.85);
  }

  floatText(worldPos: THREE.Vector3, text: string, kind: 'normal' | 'crit' | 'kill' | 'heal' | 'credit' | 'player') {
    const slot = this.texts.find((t) => !t.active);
    if (!slot) return;
    slot.active = true;
    slot.pos.copy(worldPos);
    slot.vel.set((Math.random() - 0.5) * 1.4, 2.6 + Math.random() * 0.8, (Math.random() - 0.5) * 1.4);
    slot.life = kind === 'normal' ? 0.72 : 1.05;
    slot.maxLife = slot.life;
    slot.el.textContent = text;
    slot.el.className = `fx-damage-number fx-dn-${kind}`;
  }

  update(dt: number, camera: THREE.PerspectiveCamera, width: number, height: number) {
    // クロスヘア
    this.spread += (this.targetSpread - this.spread) * Math.min(1, dt * 12);
    const s = this.spread;
    this.crossParts[0].style.transform = `translate(-50%, ${-s - 9}px)`;
    this.crossParts[1].style.transform = `translate(-50%, ${s}px)`;
    this.crossParts[2].style.transform = `translate(${-s - 9}px, -50%)`;
    this.crossParts[3].style.transform = `translate(${s}px, -50%)`;

    // ヒットマーカー
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      const k = clamp(this.hitTimer / (this.hitCrit ? 0.28 : 0.18), 0, 1);
      this.hitEl.style.opacity = String(k);
      this.hitEl.style.transform = `translate(-50%, -50%) scale(${1.35 - k * 0.35})`;
      this.hitEl.style.setProperty('--hm-color', this.hitCrit ? '#ffd34d' : '#ffffff');
    } else {
      this.hitEl.style.opacity = '0';
    }

    // 被弾ビネット
    if (this.damageFlash > 0) {
      this.damageFlash = Math.max(0, this.damageFlash - dt * 1.8);
      this.vignette.style.opacity = String(Math.min(1, this.damageFlash) * 0.9);
    } else {
      this.vignette.style.opacity = '0';
    }

    // 浮遊ダメージ表示
    for (const t of this.texts) {
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.active = false;
        t.el.style.opacity = '0';
        continue;
      }
      t.vel.y -= 3.4 * dt;
      t.pos.addScaledVector(t.vel, dt);
      _p.copy(t.pos).project(camera);
      if (_p.z > 1 || _p.z < -1) {
        t.el.style.opacity = '0';
        continue;
      }
      const x = (_p.x * 0.5 + 0.5) * width;
      const y = (-_p.y * 0.5 + 0.5) * height;
      const k = t.life / t.maxLife;
      const scale = 0.85 + (1 - k) * 0.15;
      t.el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(2)})`;
      t.el.style.opacity = String(clamp(k * 2.2, 0, 1));
    }
  }

  clearTexts() {
    for (const t of this.texts) {
      t.active = false;
      t.el.style.opacity = '0';
    }
  }

  dispose() {
    this.root.remove();
  }
}
