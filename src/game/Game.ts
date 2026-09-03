import * as THREE from 'three';
import {
  CORE_RADIUS,
  DIFFICULTIES,
  ECONOMY,
  PLAYER,
  PREP_TIME,
  PREP_TIME_FIRST,
  TOTAL_WAVES,
  TOWERS,
  WEAPONS,
  buildWaves,
  type Difficulty,
  type EnemyKind,
  type TowerKind,
  type WaveDef,
} from './config';
import { AudioManager } from './core/Audio';
import { Engine, type Quality } from './core/Engine';
import { Input } from './core/Input';
import { clamp, damp, smoothstep } from './core/util';
import { Effects } from './fx/Effects';
import { HealthBars } from './fx/HealthBars';
import { Radar } from './fx/Radar';
import { ScreenFX } from './fx/ScreenFX';
import { EnemySystem, type Enemy } from './entities/EnemySystem';
import { PlayerController } from './entities/PlayerController';
import { Projectiles } from './entities/Projectiles';
import { TowerSystem, type Tower } from './entities/TowerSystem';
import { GameMap, worldToCellX, worldToCellZ, cellToWorldX, cellToWorldZ } from './world/map';
import { World } from './world/World';
import { WorldCollision } from './world/collision';
import { patchUi, pushToast, resetUi, useUiStore, type Phase } from './state';

interface SpawnEntry {
  time: number;
  kind: EnemyKind;
  gate: number;
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1);

export class Game {
  readonly engine: Engine;
  readonly input: Input;
  readonly audio = new AudioManager();
  readonly map = new GameMap();
  readonly world: World;
  readonly collision: WorldCollision;
  readonly effects: Effects;
  readonly healthBars: HealthBars;
  readonly screen: ScreenFX;
  readonly radar: Radar;
  readonly enemies: EnemySystem;
  readonly towers: TowerSystem;
  readonly projectiles: Projectiles;
  readonly player = new PlayerController();

  private container: HTMLElement;
  private raf = 0;
  private lastTime = 0;
  private running = false;
  private accumFps = 0;
  private frameCount = 0;
  private uiTimer = 0;

  phase: Phase = 'menu';
  difficulty: Difficulty = 'normal';
  private waves: WaveDef[] = [];
  private waveIndex = 0;
  private waveTimer = 0;
  private waveElapsed = 0;
  private spawnQueue: SpawnEntry[] = [];
  private spawnCursor = 0;
  private runTime = 0;

  credits = 0;
  score = 0;
  kills = 0;
  coreHp = 1200;
  coreMaxHp = 1200;
  towersBuilt = 0;

  buildMode = false;
  private buildBlend = 0;
  selectedKind: TowerKind = 'gatling';
  selectedTower: Tower | null = null;
  private ghost: THREE.Group;
  private raycaster = new THREE.Raycaster();

  constructor(container: HTMLElement, quality: Quality = 'high') {
    this.container = container;
    this.engine = new Engine(container, quality);
    this.input = new Input(this.engine.canvas);
    this.screen = new ScreenFX(container);
    this.radar = new Radar(container, this.map);
    this.radar.setVisible(false);
    this.collision = new WorldCollision(this.map);
    this.world = new World(this.map);
    this.engine.scene.add(this.world.group);
    this.effects = new Effects(this.engine.scene);
    this.healthBars = new HealthBars(this.engine.scene);
    this.enemies = new EnemySystem(this.engine.scene, this.map, quality === 'high');
    this.towers = new TowerSystem(this.engine.scene, this.map);
    this.projectiles = new Projectiles(this.engine.scene);

    this.engine.camera.add(this.player.viewGroup);
    this.engine.scene.add(this.engine.camera);

    this.ghost = new THREE.Group();
    const ghostMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.35, 2.1, 10),
      new THREE.MeshBasicMaterial({ color: 0x6effc0, transparent: true, opacity: 0.35, toneMapped: false }),
    );
    ghostMesh.position.y = 1.05;
    this.ghost.add(ghostMesh);
    this.ghost.visible = false;
    this.engine.scene.add(this.ghost);

    this.input.onPointerLockChange = (locked) => {
      patchUi({ pointerLocked: locked });
      // ロック取得のクリックがそのまま発砲にならないよう少し待つ
      if (locked) this.player.fireTimer = Math.max(this.player.fireTimer, 0.22);
      if (!locked && !this.buildMode && (this.phase === 'wave' || this.phase === 'prep')) {
        this.setPaused(true);
      }
    };

    this.screen.setCrosshairVisible(false);
  }

  /* ---------------- ライフサイクル ---------------- */

  start(difficulty: Difficulty, quality: Quality) {
    this.difficulty = difficulty;
    this.engine.setQuality(quality);
    const diff = DIFFICULTIES[difficulty];

    this.waves = buildWaves(difficulty);
    this.waveIndex = 0;
    this.waveTimer = PREP_TIME_FIRST;
    this.waveElapsed = 0;
    this.spawnQueue = [];
    this.spawnCursor = 0;
    this.runTime = 0;

    this.credits = diff.startCredits;
    this.score = 0;
    this.kills = 0;
    this.towersBuilt = 0;
    this.coreMaxHp = diff.coreHp;
    this.coreHp = diff.coreHp;

    this.enemies.clear();
    this.towers.clear();
    this.projectiles.clear();
    this.effects.clear();
    this.screen.clearTexts();

    this.player.reset(new THREE.Vector3(0, 0, CORE_RADIUS + 8));
    this.setBuildMode(false);
    this.radar.setVisible(true);
    this.screen.setCrosshairVisible(true);
    this.selectedTower = null;
    this.phase = 'prep';

    this.audio.resume();
    this.audio.startMusic();

    resetUi();
    patchUi({
      phase: 'prep',
      started: true,
      difficulty,
      quality,
      totalWaves: TOTAL_WAVES,
      coreHp: this.coreHp,
      coreMaxHp: this.coreMaxHp,
      credits: this.credits,
      playerMaxHp: this.player.maxHp,
      playerHp: this.player.hp,
      waveHeadline: '防衛準備',
      muted: this.audio.muted,
    });
    pushToast('防衛準備フェーズ — タワーを配置せよ', 'info');
    this.requestLockSoon();
    this.begin();
  }

  private requestLockSoon() {
    window.setTimeout(() => {
      if (this.phase === 'prep' || this.phase === 'wave') this.input.requestLock();
    }, 60);
  }

  begin() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.tick();
    };
    this.raf = requestAnimationFrame(loop);
  }

  setPaused(p: boolean) {
    if (p && (this.phase === 'wave' || this.phase === 'prep')) {
      this.prevPhase = this.phase;
      this.phase = 'paused';
      this.input.exitLock();
      this.screen.setCrosshairVisible(false);
      this.radar.setVisible(false);
      patchUi({ phase: 'paused' });
      this.audio.setIntensity(0.1);
    } else if (!p && this.phase === 'paused') {
      this.phase = this.prevPhase;
      patchUi({ phase: this.phase });
      this.radar.setVisible(!this.buildMode);
      this.screen.setCrosshairVisible(!this.buildMode);
      if (!this.buildMode) this.input.requestLock();
    }
  }

  private prevPhase: Phase = 'prep';

  toMenu() {
    this.phase = 'menu';
    this.input.exitLock();
    this.audio.stopMusic();
    this.screen.setCrosshairVisible(false);
    this.radar.setVisible(false);
    this.enemies.clear();
    this.towers.clear();
    this.projectiles.clear();
    this.effects.clear();
    resetUi();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.running = false;
    this.input.dispose();
    this.screen.dispose();
    this.radar.dispose();
    this.audio.dispose();
    this.engine.dispose();
  }

  /* ---------------- メインループ ---------------- */

  private tick() {
    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.1);

    this.frameCount++;
    this.accumFps += 1 / Math.max(rawDt, 0.0001);

    const active = this.phase === 'prep' || this.phase === 'wave';
    if (active) this.update(dt);
    else this.updateIdle(dt);

    this.input.endFrame();
    this.engine.render();

    this.uiTimer += dt;
    if (this.uiTimer > 0.08) {
      this.syncUi();
      this.uiTimer = 0;
    }
  }

  /** メニュー・ポーズ中の演出だけ回す */
  private updateIdle(dt: number) {
    this.world.update(dt);
    this.effects.update(dt, this.engine.camera.quaternion);
    this.screen.update(dt, this.engine.camera, this.container.clientWidth, this.container.clientHeight);
    if (this.phase === 'menu') this.orbitMenuCamera(dt);
  }

  private menuAngle = 0;
  private orbitMenuCamera(dt: number) {
    this.menuAngle += dt * 0.06;
    const r = 62;
    this.engine.camera.position.set(Math.cos(this.menuAngle) * r, 30, Math.sin(this.menuAngle) * r);
    this.engine.camera.lookAt(0, 6, 0);
    this.engine.camera.fov = 62;
    this.engine.camera.updateProjectionMatrix();
  }

  private update(dt: number) {
    this.runTime += dt;
    this.handleGlobalInput();
    this.updateWaveFlow(dt);

    const camQuat = this.engine.camera.quaternion;

    this.healthBars.begin(camQuat);

    this.player.update({
      dt,
      input: this.input,
      allowControl: !this.buildMode,
      enemies: this.enemies,
      collision: this.collision,
      effects: this.effects,
      audio: this.audio,
      screen: this.screen,
      onHit: (point, damage, crit) => {
        this.screen.hitmarker(crit);
        this.audio.hitmarker();
        this.screen.floatText(point, String(Math.round(damage)), crit ? 'crit' : 'normal');
      },
      onDeath: () => this.respawnPlayer(),
    });

    this.enemies.update({
      dt,
      player: this.player,
      towers: this.towers,
      projectiles: this.projectiles,
      effects: this.effects,
      audio: this.audio,
      corePos: _v.set(0, 0, 0),
      damageCore: (amount) => this.damageCore(amount),
      onKill: (enemy, byPlayer) => this.onEnemyKilled(enemy, byPlayer),
      healthBars: this.healthBars,
      camQuat,
      cameraPos: this.engine.camera.position,
    });

    this.towers.update(
      dt,
      this.enemies,
      this.projectiles,
      this.effects,
      this.audio,
      this.healthBars,
      camQuat,
      _v.set(0, 0, 0),
    );

    this.projectiles.update(dt, this.enemies, this.towers, this.player, this.effects, this.audio);

    if (this.buildMode) this.updateBuildMode();

    this.world.update(dt);
    this.world.setCoreHpRatio(this.coreHp / this.coreMaxHp);
    this.effects.update(dt, camQuat);
    this.healthBars.end();

    this.radar.update(
      dt,
      this.enemies.list,
      this.towers.towers,
      this.player.position,
      this.player.yaw,
      this.coreHp / this.coreMaxHp,
    );

    this.updateCamera(dt);
    this.screen.update(dt, this.engine.camera, this.container.clientWidth, this.container.clientHeight);

    this.audio.updateListener(this.engine.camera.position, camQuat);
    const threat = clamp(1 - this.enemies.closestThreat / 60, 0, 1);
    const pressure = clamp(this.enemies.aliveCount / 26, 0, 1);
    this.audio.setIntensity(this.phase === 'wave' ? Math.max(threat, pressure) : 0.15);
  }

  /* ---------------- 入力 ---------------- */

  private handleGlobalInput() {
    const input = this.input;
    if (input.wasPressed('Escape')) {
      if (this.buildMode) this.setBuildMode(false);
      else this.setPaused(true);
      return;
    }
    if (input.wasPressed('Tab') || input.wasPressed('KeyB')) {
      this.setBuildMode(!this.buildMode);
    }
    if (input.wasPressed('KeyM')) this.toggleMute();
    if (input.wasPressed('Enter') && this.phase === 'prep') this.skipPrep();

    if (this.buildMode) {
      if (input.wasPressed('Digit1')) this.setSelectedKind('gatling');
      if (input.wasPressed('Digit2')) this.setSelectedKind('cannon');
      if (input.wasPressed('Digit3')) this.setSelectedKind('frost');
      if (input.wasPressed('Digit4')) this.setSelectedKind('tesla');
      if (input.wasPressed('KeyU')) this.upgradeSelected();
      if (input.wasPressed('KeyX')) this.sellSelected();
      if (input.wasPressed('KeyG')) this.repairCore();
    }
  }

  toggleMute() {
    this.audio.setMuted(!this.audio.muted);
    patchUi({ muted: this.audio.muted });
  }

  setQuality(q: Quality) {
    this.engine.setQuality(q);
    patchUi({ quality: q });
  }

  /* ---------------- ビルドモード ---------------- */

  setBuildMode(on: boolean) {
    if (this.buildMode === on) return;
    this.buildMode = on;
    this.world.setBuildMode(on);
    this.ghost.visible = false;
    this.screen.setCrosshairVisible(!on);
    this.radar.setVisible(!on);
    if (on) {
      this.input.exitLock();
      this.towers.showRange(null);
    } else {
      this.selectedTower = null;
      this.towers.showRange(null);
      if (this.phase === 'prep' || this.phase === 'wave') this.input.requestLock();
    }
    patchUi({ buildMode: on, selectedTower: null });
  }

  setSelectedKind(k: TowerKind) {
    this.selectedKind = k;
    this.selectedTower = null;
    this.towers.showRange(null);
    patchUi({ selectedKind: k, selectedTower: null });
    this.audio.uiClick();
  }

  private updateBuildMode() {
    this.raycaster.setFromCamera(new THREE.Vector2(this.input.ndcX, this.input.ndcY), this.engine.camera);
    const hit = this.raycaster.ray.intersectPlane(GROUND_PLANE, _v2);
    if (!hit) {
      this.world.setHover(0, 0, false, false);
      this.ghost.visible = false;
      return;
    }
    const cx = worldToCellX(hit.x);
    const cy = worldToCellZ(hit.z);
    const wx = cellToWorldX(cx);
    const wz = cellToWorldZ(cy);
    const existing = this.towers.towerAt(cx, cy);
    const def = TOWERS[this.selectedKind];
    const canPlace = this.towers.canPlace(cx, cy);
    const affordable = this.credits >= def.cost;

    this.world.setHover(wx, wz, canPlace && affordable, true);
    this.ghost.visible = canPlace;
    if (canPlace) {
      this.ghost.position.set(wx, 0, wz);
      const mat = (this.ghost.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.color.setHex(affordable ? def.color : 0xff5a4a);
    }

    if (existing) {
      this.world.setRangePreview(existing.pos.x, existing.pos.z, existing.def.levels[existing.level].range, true);
    } else if (canPlace) {
      this.world.setRangePreview(wx, wz, def.levels[0].range, true);
    } else {
      this.world.setRangePreview(0, 0, 1, false);
    }

    if (this.input.buttonPressed[0]) {
      if (existing) {
        this.selectTower(existing);
      } else if (canPlace) {
        this.tryPlace(cx, cy);
      } else {
        this.audio.build(false);
      }
    }
    if (this.input.buttonPressed[2] && existing) {
      this.selectTower(existing);
    }
  }

  private selectTower(t: Tower) {
    this.selectedTower = t;
    this.towers.showRange(t);
    this.audio.uiClick();
    this.syncSelectedTower();
  }

  private syncSelectedTower() {
    const t = this.selectedTower;
    if (!t || !this.towers.towers.includes(t)) {
      this.selectedTower = null;
      patchUi({ selectedTower: null });
      return;
    }
    const lv = t.def.levels[t.level];
    useUiStore.setState({
      selectedTower: {
        id: t.id,
        kind: t.kind,
        level: t.level,
        maxLevel: t.def.levels.length,
        damage: lv.damage,
        range: lv.range,
        fireInterval: lv.fireInterval,
        upgradeCost: this.towers.upgradeCost(t),
        sellValue: this.towers.sellValue(t),
        hp: Math.round(t.hp),
        maxHp: t.maxHp,
      },
    });
  }

  tryPlace(cx: number, cy: number) {
    const def = TOWERS[this.selectedKind];
    if (this.credits < def.cost) {
      pushToast('資金が不足しています', 'warn');
      this.audio.build(false);
      return;
    }
    const t = this.towers.place(this.selectedKind, cx, cy);
    if (!t) {
      this.audio.build(false);
      return;
    }
    this.credits -= def.cost;
    this.towersBuilt++;
    this.audio.build(true);
    _v.set(t.pos.x, 1.2, t.pos.z);
    this.effects.particles.sparks(_v, new THREE.Vector3(0, 1, 0), 12, {
      color: def.accent,
      speed: 7,
      size: 0.8,
      life: 0.7,
    });
    this.effects.shockwave(_v, 0.5, 3.4, def.accent, 0.4);
    this.screen.floatText(_v, `-${def.cost}`, 'credit');
  }

  upgradeSelected() {
    const t = this.selectedTower;
    if (!t) return;
    const cost = this.towers.upgradeCost(t);
    if (cost <= 0) {
      pushToast('既に最大レベルです', 'warn');
      return;
    }
    if (this.credits < cost) {
      pushToast('資金が不足しています', 'warn');
      this.audio.build(false);
      return;
    }
    this.credits -= cost;
    this.towers.upgrade(t);
    this.audio.build(true);
    _v.set(t.pos.x, 1.6, t.pos.z);
    this.effects.shockwave(_v, 0.5, 4, t.def.accent, 0.45);
    this.screen.floatText(_v, `LV${t.level + 1}`, 'heal');
    this.syncSelectedTower();
    this.towers.showRange(t);
  }

  sellSelected() {
    const t = this.selectedTower;
    if (!t) return;
    const value = this.towers.sellValue(t);
    this.credits += value;
    _v.set(t.pos.x, 1.4, t.pos.z);
    this.effects.explosion(_v, 2.2, 0x8fe9ff);
    this.screen.floatText(_v, `+${value}`, 'credit');
    this.towers.remove(t);
    this.selectedTower = null;
    this.towers.showRange(null);
    this.audio.build(true);
    patchUi({ selectedTower: null });
  }

  repairCore() {
    if (this.coreHp >= this.coreMaxHp) {
      pushToast('コアは損傷していません', 'warn');
      return;
    }
    if (this.credits < ECONOMY.repairCost) {
      pushToast('資金が不足しています', 'warn');
      this.audio.build(false);
      return;
    }
    this.credits -= ECONOMY.repairCost;
    this.coreHp = Math.min(this.coreMaxHp, this.coreHp + ECONOMY.repairAmount);
    this.audio.build(true);
    this.effects.shockwave(_v.set(0, 4, 0), 1, 9, 0x64f4ff, 0.5);
    pushToast(`コアを修復した (+${ECONOMY.repairAmount})`, 'good');
  }

  /* ---------------- ウェーブ制御 ---------------- */

  private updateWaveFlow(dt: number) {
    if (this.phase === 'prep') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) this.startWave();
      return;
    }

    this.waveElapsed += dt;
    const wave = this.waves[this.waveIndex];
    while (this.spawnCursor < this.spawnQueue.length && this.spawnQueue[this.spawnCursor].time <= this.waveElapsed) {
      const s = this.spawnQueue[this.spawnCursor++];
      this.enemies.spawn(s.kind, s.gate, wave.hpScale);
    }

    if (this.spawnCursor >= this.spawnQueue.length && this.enemies.aliveCount === 0) {
      this.completeWave();
    }
  }

  private startWave() {
    const wave = this.waves[this.waveIndex];
    this.phase = 'wave';
    this.waveElapsed = 0;
    this.spawnCursor = 0;
    this.spawnQueue = [];
    for (const g of wave.groups) {
      for (let i = 0; i < g.count; i++) {
        this.spawnQueue.push({ time: g.delay + i * g.interval, kind: g.kind, gate: g.gate });
      }
    }
    this.spawnQueue.sort((a, b) => a.time - b.time);
    this.audio.waveStart(wave.boss);
    pushToast(`WAVE ${wave.index} — ${wave.headline}`, wave.boss ? 'warn' : 'info');
    patchUi({
      phase: 'wave',
      wave: wave.index,
      waveHeadline: wave.headline,
      enemiesRemaining: wave.total,
    });
  }

  private completeWave() {
    const wave = this.waves[this.waveIndex];
    const diff = DIFFICULTIES[this.difficulty];
    const bonus = Math.round((ECONOMY.waveClearBase + ECONOMY.waveClearPerWave * wave.index) * diff.reward);
    this.credits += bonus;
    this.score += wave.index * 100;
    pushToast(`WAVE ${wave.index} 制圧  +${bonus} CR`, 'good');
    this.audio.fanfare(true);

    this.waveIndex++;
    if (this.waveIndex >= this.waves.length) {
      this.endRun(true);
      return;
    }
    this.phase = 'prep';
    this.waveTimer = PREP_TIME;
    patchUi({ phase: 'prep', waveHeadline: '次のウェーブまで' });
  }

  skipPrep() {
    if (this.phase !== 'prep') return;
    const bonus = Math.round(this.waveTimer * ECONOMY.skipBonusPerSecond);
    this.credits += bonus;
    this.waveTimer = 0;
    if (bonus > 0) pushToast(`早期開始ボーナス +${bonus} CR`, 'good');
  }

  private damageCore(amount: number) {
    if (this.phase !== 'wave' && this.phase !== 'prep') return;
    this.coreHp -= amount;
    this.world.coreHit();
    this.audio.coreHurt();
    this.screen.damageTaken(0.12);
    if (this.coreHp <= 0) {
      this.coreHp = 0;
      this.endRun(false);
    }
  }

  private onEnemyKilled(enemy: Enemy, byPlayer: boolean) {
    const diff = DIFFICULTIES[this.difficulty];
    const reward = Math.round(enemy.def.reward * diff.reward);
    this.credits += reward;
    this.score += enemy.def.score;
    this.kills++;
    this.enemies.centerOf(enemy, _v);
    this.screen.floatText(_v, `+${reward}`, 'credit');
    if (byPlayer) this.audio.killConfirm();
  }

  private respawnPlayer() {
    const penalty = Math.round(this.credits * PLAYER.respawnCreditPenalty);
    this.credits = Math.max(0, this.credits - penalty);
    const angle = Math.random() * Math.PI * 2;
    _v.set(Math.cos(angle) * (CORE_RADIUS + 7), 0, Math.sin(angle) * (CORE_RADIUS + 7));
    this.player.respawn(_v);
    this.effects.shockwave(_v.clone().setY(1.5), 0.5, 6, 0x64f4ff, 0.5);
    pushToast(`再出撃 (資金 -${penalty} CR)`, 'warn');
  }

  private endRun(victory: boolean) {
    this.phase = victory ? 'victory' : 'defeat';
    this.input.exitLock();
    this.screen.setCrosshairVisible(false);
    this.radar.setVisible(false);
    this.audio.fanfare(victory);
    this.audio.setIntensity(0.05);
    const acc = this.player.shotsFired > 0 ? this.player.shotsHit / this.player.shotsFired : 0;
    useUiStore.setState({
      phase: this.phase,
      stats: {
        kills: this.kills,
        score: this.score,
        wavesCleared: victory ? TOTAL_WAVES : this.waveIndex,
        accuracy: acc,
        damageDealt: Math.round(this.player.damageDealt),
        towersBuilt: this.towersBuilt,
        timeSeconds: Math.round(this.runTime),
      },
    });
  }

  /* ---------------- カメラ ---------------- */

  private updateCamera(dt: number) {
    const cam = this.engine.camera;
    this.buildBlend = damp(this.buildBlend, this.buildMode ? 1 : 0, 9, dt);
    const b = smoothstep(this.buildBlend);

    // 一人称
    this.player.eyePosition(_v);
    _e.set(this.player.pitch + this.player.recoilPitch, this.player.yaw + this.player.recoilYaw, 0);
    _q.setFromEuler(_e);

    if (b < 0.001) {
      cam.position.copy(_v);
      cam.quaternion.copy(_q);
    } else {
      // 俯瞰（ビルド）視点
      const yaw = this.player.yaw;
      const dist = 26;
      const height = 30;
      _v2.set(
        this.player.position.x + Math.sin(yaw) * dist,
        height,
        this.player.position.z + Math.cos(yaw) * dist,
      );
      const look = new THREE.Matrix4().lookAt(_v2, this.player.position, new THREE.Vector3(0, 1, 0));
      const buildQuat = new THREE.Quaternion().setFromRotationMatrix(look);
      cam.position.lerpVectors(_v, _v2, b);
      cam.quaternion.slerpQuaternions(_q, buildQuat, b);
    }

    const targetFov = 76 - this.player.adsAmount * 20 + (this.player.sprinting ? 4 : 0);
    const fov = targetFov * (1 - b) + 58 * b;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    this.player.viewGroup.visible = b < 0.35 && this.player.alive;
  }

  /* ---------------- UI 同期 ---------------- */

  private syncUi() {
    const def = WEAPONS[this.player.weapon];
    const remaining = Math.max(0, this.spawnQueue.length - this.spawnCursor) + this.enemies.aliveCount;
    const fps = this.frameCount > 0 ? this.accumFps / this.frameCount : 60;
    this.accumFps = 0;
    this.frameCount = 0;

    patchUi({
      phase: this.phase,
      wave: this.waves[this.waveIndex]?.index ?? 0,
      waveTimer: this.phase === 'prep' ? Math.max(0, this.waveTimer) : 0,
      enemiesAlive: this.enemies.aliveCount,
      enemiesRemaining: remaining,
      credits: Math.floor(this.credits),
      score: Math.floor(this.score),
      kills: this.kills,
      coreHp: Math.max(0, Math.ceil(this.coreHp)),
      coreMaxHp: this.coreMaxHp,
      playerHp: Math.max(0, Math.ceil(this.player.hp)),
      playerMaxHp: this.player.maxHp,
      playerAlive: this.player.alive,
      respawnIn: this.player.alive ? 0 : Math.max(0, this.player.respawnTimer),
      weapon: this.player.weapon,
      ammo: this.player.ammo[this.player.weapon],
      magSize: def.magSize,
      reloading: this.player.reloadTimer > 0,
      reloadProgress: this.player.reloadTimer > 0 ? 1 - this.player.reloadTimer / def.reloadTime : 1,
      towerCount: this.towers.towers.length,
      buildMode: this.buildMode,
      selectedKind: this.selectedKind,
      fps: Math.round(fps),
    });
    if (this.selectedTower) this.syncSelectedTower();
  }
}
