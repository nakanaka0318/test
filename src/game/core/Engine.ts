import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export type Quality = 'low' | 'medium' | 'high';

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = /* glsl */ `
varying vec3 vDir;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
void main() {
  float h = vDir.y;
  vec3 col = h > 0.0
    ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.62))
    : mix(uHorizon, uBottom, pow(clamp(-h, 0.0, 1.0), 0.5));
  float sun = pow(max(dot(normalize(vDir), normalize(uSunDir)), 0.0), 220.0);
  float glow = pow(max(dot(normalize(vDir), normalize(uSunDir)), 0.0), 6.0) * 0.28;
  col += uSunColor * (sun * 3.0 + glow);
  // わずかな星
  float star = step(0.9992, fract(sin(dot(floor(vDir * 420.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453));
  col += vec3(star) * smoothstep(0.05, 0.5, h) * 0.55;
  gl_FragColor = vec4(col, 1.0);
}`;

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly canvas: HTMLCanvasElement;
  readonly sunLight: THREE.DirectionalLight;

  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private container: HTMLElement;
  private quality: Quality = 'high';
  private resizeObserver: ResizeObserver;
  private sky: THREE.Mesh;

  constructor(container: HTMLElement, quality: Quality = 'high') {
    this.container = container;
    this.quality = quality;

    this.renderer = new THREE.WebGLRenderer({
      antialias: quality !== 'low',
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    container.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x121a2e, 0.0068);

    this.camera = new THREE.PerspectiveCamera(76, 1, 0.1, 600);
    this.camera.rotation.order = 'YXZ';

    // --- 空 ---
    const skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x0a1030) },
        uHorizon: { value: new THREE.Color(0x2b3a63) },
        uBottom: { value: new THREE.Color(0x080c18) },
        uSunDir: { value: new THREE.Vector3(-0.42, 0.16, -0.9).normalize() },
        uSunColor: { value: new THREE.Color(0xff9d5c) },
      },
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMat);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    // --- ライト ---
    const hemi = new THREE.HemisphereLight(0x9dc0ff, 0x2b3244, 0.95);
    this.scene.add(hemi);

    this.sunLight = new THREE.DirectionalLight(0xffc79a, 2.45);
    this.sunLight.position.set(-52, 42, -95);
    this.sunLight.castShadow = quality !== 'low';
    const shadowSize = quality === 'high' ? 2048 : 1024;
    this.sunLight.shadow.mapSize.set(shadowSize, shadowSize);
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 260;
    const s = 95;
    this.sunLight.shadow.camera.left = -s;
    this.sunLight.shadow.camera.right = s;
    this.sunLight.shadow.camera.top = s;
    this.sunLight.shadow.camera.bottom = -s;
    this.sunLight.shadow.bias = -0.0006;
    this.sunLight.shadow.normalBias = 0.035;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    const fill = new THREE.DirectionalLight(0x5c78ff, 0.5);
    fill.position.set(60, 30, 70);
    this.scene.add(fill);

    this.setupComposer();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  private setupComposer() {
    this.composer?.dispose();
    this.composer = null;
    this.bloomPass = null;
    if (this.quality === 'low') return;

    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      this.quality === 'high' ? 0.48 : 0.36,
      0.6,
      0.92,
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    this.composer = composer;
    this.bloomPass = bloom;
  }

  setQuality(q: Quality) {
    if (q === this.quality) return;
    this.quality = q;
    this.renderer.shadowMap.enabled = q !== 'low';
    this.sunLight.castShadow = q !== 'low';
    this.setupComposer();
    this.resize();
  }

  getQuality() {
    return this.quality;
  }

  get pixelRatioCap() {
    return this.quality === 'high' ? 2 : this.quality === 'medium' ? 1.5 : 1;
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, this.pixelRatioCap);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer?.setPixelRatio(dpr);
    this.composer?.setSize(w, h);
    this.bloomPass?.setSize(w, h);
  }

  render() {
    this.sky.position.copy(this.camera.position);
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.resizeObserver.disconnect();
    this.composer?.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
