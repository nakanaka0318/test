import * as THREE from 'three';
import { clamp } from './util';

/**
 * WebAudio による完全プロシージャル音響。
 * 外部音源ファイルを持たずに射撃・爆発・環境音を合成する。
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private lastPlay = new Map<string, number>();
  private voices = 0;
  private musicNodes: AudioNode[] = [];
  private musicFilter: BiquadFilterNode | null = null;
  private musicPulse: GainNode | null = null;

  masterVolume = 0.75;
  musicVolume = 0.42;
  muted = false;

  private listenerPos = new THREE.Vector3();
  private listenerRight = new THREE.Vector3();

  init() {
    if (this.ctx) return;
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.masterVolume;
    this.master.connect(ctx.destination);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 1;
    this.sfxBus.connect(this.master);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVolume;
    this.musicBus.connect(this.master);

    // ホワイトノイズ（2 秒）
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
  }

  resume() {
    this.init();
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.masterVolume;
  }

  setMasterVolume(v: number) {
    this.masterVolume = v;
    if (this.master && !this.muted) this.master.gain.value = v;
  }

  setMusicVolume(v: number) {
    this.musicVolume = v;
    if (this.musicBus) this.musicBus.gain.value = v;
  }

  updateListener(pos: THREE.Vector3, quat: THREE.Quaternion) {
    this.listenerPos.copy(pos);
    this.listenerRight.set(1, 0, 0).applyQuaternion(quat);
  }

  /** 位置に応じた音量とパンを求める */
  private spatial(pos: THREE.Vector3 | undefined, refDist: number): { gain: number; pan: number } {
    if (!pos) return { gain: 1, pan: 0 };
    const dx = pos.x - this.listenerPos.x;
    const dy = pos.y - this.listenerPos.y;
    const dz = pos.z - this.listenerPos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const gain = clamp(refDist / (refDist + dist * dist * 0.05), 0, 1);
    const pan = clamp((dx * this.listenerRight.x + dz * this.listenerRight.z) / Math.max(dist, 0.001), -1, 1);
    return { gain, pan: pan * 0.75 };
  }

  private throttle(key: string, minInterval: number): boolean {
    const now = performance.now() / 1000;
    const last = this.lastPlay.get(key) ?? -99;
    if (now - last < minInterval) return false;
    this.lastPlay.set(key, now);
    return true;
  }

  private chain(nodes: AudioNode[], gain: number, pan: number): GainNode | null {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return null;
    const g = ctx.createGain();
    g.gain.value = gain;
    let tail: AudioNode = g;
    if (pan !== 0 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      tail = p;
    }
    tail.connect(this.sfxBus);
    for (const n of nodes) n.connect(g);
    return g;
  }

  private noiseSource(duration: number, playbackRate = 1): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noiseBuffer) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.playbackRate.value = playbackRate;
    src.start();
    src.stop(this.ctx.currentTime + duration + 0.05);
    return src;
  }

  private budgetOk(): boolean {
    return this.voices < 26;
  }

  private spend(dur: number) {
    this.voices++;
    window.setTimeout(() => {
      this.voices = Math.max(0, this.voices - 1);
    }, dur * 1000);
  }

  /* ---------------- SFX ---------------- */

  gunshot(kind: 'rifle' | 'shotgun' | 'railgun', pos?: THREE.Vector3) {
    const ctx = this.ctx;
    if (!ctx || !this.budgetOk()) return;
    const { gain, pan } = this.spatial(pos, 60);
    const t = ctx.currentTime;

    if (kind === 'railgun') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1400, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.42);
      const env = this.chain([osc], 0, pan);
      if (!env) return;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.5 * gain, t + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.start(t);
      osc.stop(t + 0.55);
      this.spend(0.55);
      return;
    }

    const dur = kind === 'shotgun' ? 0.34 : 0.16;
    const noise = this.noiseSource(dur, kind === 'shotgun' ? 0.7 : 1.1);
    if (!noise) return;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(kind === 'shotgun' ? 1100 : 2200, t);
    bp.frequency.exponentialRampToValueAtTime(kind === 'shotgun' ? 220 : 520, t + dur);
    bp.Q.value = 0.9;
    noise.connect(bp);

    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(kind === 'shotgun' ? 150 : 220, t);
    thump.frequency.exponentialRampToValueAtTime(48, t + dur * 0.8);

    const env = this.chain([bp, thump], 0, pan);
    if (!env) return;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime((kind === 'shotgun' ? 0.62 : 0.34) * gain, t + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    thump.start(t);
    thump.stop(t + dur);
    this.spend(dur);
  }

  towerShot(kind: string, pos?: THREE.Vector3) {
    if (!this.throttle('tower-' + kind, kind === 'gatling' ? 0.07 : 0.05)) return;
    const ctx = this.ctx;
    if (!ctx || !this.budgetOk()) return;
    const { gain, pan } = this.spatial(pos, 26);
    if (gain < 0.06) return;
    const t = ctx.currentTime;

    if (kind === 'tesla') {
      const noise = this.noiseSource(0.3, 2.2);
      if (!noise) return;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1800;
      noise.connect(hp);
      const env = this.chain([hp], 0, pan);
      if (!env) return;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.4 * gain, t + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      this.spend(0.3);
      return;
    }

    const dur = kind === 'cannon' ? 0.32 : 0.09;
    const noise = this.noiseSource(dur, kind === 'cannon' ? 0.6 : 1.6);
    if (!noise) return;
    const bp = ctx.createBiquadFilter();
    bp.type = kind === 'cannon' ? 'lowpass' : 'bandpass';
    bp.frequency.setValueAtTime(kind === 'cannon' ? 900 : 2600, t);
    bp.frequency.exponentialRampToValueAtTime(kind === 'cannon' ? 160 : 900, t + dur);
    noise.connect(bp);
    const env = this.chain([bp], 0, pan);
    if (!env) return;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime((kind === 'cannon' ? 0.5 : 0.2) * gain, t + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    this.spend(dur);
  }

  explosion(size = 1, pos?: THREE.Vector3) {
    const ctx = this.ctx;
    if (!ctx || !this.budgetOk()) return;
    if (!this.throttle('boom', 0.045)) return;
    const { gain, pan } = this.spatial(pos, 90);
    if (gain < 0.05) return;
    const t = ctx.currentTime;
    const dur = 0.5 + size * 0.55;
    const noise = this.noiseSource(dur, 0.45);
    if (!noise) return;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1600, t);
    lp.frequency.exponentialRampToValueAtTime(90, t + dur);
    noise.connect(lp);
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110 * size, t);
    sub.frequency.exponentialRampToValueAtTime(28, t + dur * 0.7);
    const env = this.chain([lp, sub], 0, pan);
    if (!env) return;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(clamp(0.55 * size, 0.1, 0.9) * gain, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    sub.start(t);
    sub.stop(t + dur);
    this.spend(dur);
  }

  private blip(freq: number, endFreq: number, dur: number, vol: number, type: OscillatorType = 'square', pos?: THREE.Vector3) {
    const ctx = this.ctx;
    if (!ctx || !this.budgetOk()) return;
    const { gain, pan } = this.spatial(pos, 70);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
    const env = this.chain([osc], 0, pan);
    if (!env) return;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vol * gain, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    this.spend(dur);
  }

  impact(pos?: THREE.Vector3) {
    if (!this.throttle('impact', 0.035)) return;
    const ctx = this.ctx;
    if (!ctx || !this.budgetOk()) return;
    const { gain, pan } = this.spatial(pos, 40);
    if (gain < 0.05) return;
    const t = ctx.currentTime;
    const noise = this.noiseSource(0.09, 1.8);
    if (!noise) return;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200;
    noise.connect(bp);
    const env = this.chain([bp], 0, pan);
    if (!env) return;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.22 * gain, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    this.spend(0.1);
  }

  hitmarker() {
    if (!this.throttle('hitm', 0.03)) return;
    this.blip(1750, 1300, 0.045, 0.14, 'triangle');
  }

  killConfirm() {
    if (!this.throttle('kill', 0.05)) return;
    this.blip(880, 1600, 0.09, 0.2, 'square');
  }

  enemyShot(pos?: THREE.Vector3) {
    if (!this.throttle('eshot', 0.06)) return;
    this.blip(620, 180, 0.12, 0.24, 'sawtooth', pos);
  }

  playerHurt() {
    if (!this.throttle('hurt', 0.18)) return;
    this.blip(240, 90, 0.28, 0.4, 'sawtooth');
  }

  coreHurt() {
    if (!this.throttle('core', 0.5)) return;
    this.blip(180, 120, 0.5, 0.3, 'sawtooth');
  }

  reload() {
    this.blip(520, 700, 0.06, 0.16, 'square');
    window.setTimeout(() => this.blip(760, 500, 0.07, 0.16, 'square'), 160);
  }

  build(ok = true) {
    if (ok) {
      this.blip(520, 880, 0.09, 0.22, 'triangle');
      window.setTimeout(() => this.blip(880, 1180, 0.09, 0.18, 'triangle'), 70);
    } else {
      this.blip(220, 150, 0.14, 0.2, 'square');
    }
  }

  uiClick() {
    this.blip(900, 1200, 0.04, 0.12, 'triangle');
  }

  waveStart(boss = false) {
    const base = boss ? 130 : 320;
    this.blip(base, base * 1.5, 0.5, 0.32, 'sawtooth');
    window.setTimeout(() => this.blip(base * 1.32, base * 1.9, 0.7, 0.28, 'sawtooth'), 320);
  }

  fanfare(win: boolean) {
    const notes = win ? [523, 659, 784, 1047] : [392, 330, 262, 196];
    notes.forEach((n, i) => window.setTimeout(() => this.blip(n, n, 0.42, 0.26, 'triangle'), i * 190));
  }

  /* ---------------- 環境音楽 ---------------- */

  startMusic() {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus || this.musicNodes.length) return;
    const t = ctx.currentTime;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;
    filter.Q.value = 3;
    filter.connect(this.musicBus);
    this.musicFilter = filter;

    // 低音のドローン（デチューンした鋸波）
    for (const detune of [-7, 0, 6]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 55;
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = 0.16;
      osc.connect(g).connect(filter);
      osc.start(t);
      this.musicNodes.push(osc, g);
    }

    // 心拍のようなパルス
    const pulse = ctx.createGain();
    pulse.gain.value = 0;
    const pulseOsc = ctx.createOscillator();
    pulseOsc.type = 'sine';
    pulseOsc.frequency.value = 82.4;
    pulseOsc.connect(pulse).connect(this.musicBus);
    pulseOsc.start(t);
    this.musicPulse = pulse;
    this.musicNodes.push(pulseOsc, pulse);

    // ゆっくり流れる風
    const wind = this.noiseSourceLoop();
    if (wind) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'bandpass';
      lp.frequency.value = 420;
      lp.Q.value = 0.6;
      const g = ctx.createGain();
      g.gain.value = 0.05;
      wind.connect(lp).connect(g).connect(this.musicBus);
      this.musicNodes.push(wind, lp, g);
    }
  }

  private noiseSourceLoop(): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noiseBuffer) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.playbackRate.value = 0.22;
    src.start();
    return src;
  }

  /** 戦況に応じて音楽の緊張感を変化させる（0..1） */
  setIntensity(v: number) {
    const ctx = this.ctx;
    if (!ctx || !this.musicFilter) return;
    const target = 260 + v * 1250;
    this.musicFilter.frequency.setTargetAtTime(target, ctx.currentTime, 1.2);
    if (this.musicPulse) {
      this.musicPulse.gain.setTargetAtTime(0.03 + v * 0.1, ctx.currentTime, 1.5);
    }
  }

  stopMusic() {
    for (const n of this.musicNodes) {
      const src = n as AudioBufferSourceNode & OscillatorNode;
      try {
        src.stop?.();
      } catch {
        /* すでに停止済み */
      }
      n.disconnect();
    }
    this.musicNodes = [];
    this.musicFilter = null;
    this.musicPulse = null;
  }

  dispose() {
    this.stopMusic();
    void this.ctx?.close();
    this.ctx = null;
  }
}
