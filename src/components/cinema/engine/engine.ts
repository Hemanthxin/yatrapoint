import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { World, type Quality } from "./world";
import { CAMP_SHOT, LANDING_SHOTS, evalShots, fixedShot, type ShotState } from "./shots";

export type CinemaMode = "landing" | "camp";

export interface CinemaController {
  /** landing: story position (chapter i spans [i, i+1]) */
  setU(u: number): void;
  setTime(t: number | null): void; // override the time of day (0 dawn … 4 night); null = follow the shot
  setTalking(who: 0 | 1 | 2 | null): void;
  setLit(n: number): void;
  setPortal(a: number): void;
  setPointer(x: number, y: number): void;
  setBubbles(v: boolean): void;
  resize(): void;
  readonly quality: Quality;
  readonly fps: number;
}

const GRADE = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vig: { value: 0.35 }, grain: { value: 0.045 }, warm: { value: 0.1 }, aber: { value: 0.0007 }, shafts: { value: 0 }, sunUV: { value: new THREE.Vector2(0.5, 0.5) }, res: { value: new THREE.Vector2(1, 1) }, flash: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, vig, grain, warm, aber, shafts, flash; uniform vec2 sunUV, res; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv; vec2 c = uv - 0.5; float r2 = dot(c, c);
      vec2 off = c * aber * (1.0 + r2 * 6.0);
      vec3 col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
      if (shafts > 0.001) {
        vec2 d = (sunUV - uv) / 22.0; vec2 p = uv; float acc = 0.0; float w = 1.0;
        for (int i = 0; i < 22; i++) { p += d; vec3 s = texture2D(tDiffuse, p).rgb; float l = max(dot(s, vec3(0.333)) - 0.74, 0.0); acc += l * w; w *= 0.94; }
        col += vec3(1.0, 0.8, 0.52) * acc * shafts * 0.3;
      }
      col *= 1.0 - vig * smoothstep(0.22, 0.95, length(c) * 1.3);
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, col * vec3(1.0 + warm, 1.0 + warm * 0.4, 1.0 - warm * 0.7), smoothstep(0.3, 1.0, l));
      col = mix(col, col * vec3(0.9, 0.96, 1.1), 1.0 - smoothstep(0.0, 0.34, l));
      col = (col - 0.5) * 1.06 + 0.5;
      float g = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(g), col, 1.22);
      col += (h(uv * res + fract(time) * 91.0) - 0.5) * grain;
      col = mix(col, vec3(1.0, 0.97, 0.86), flash);
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

export class CinemaEngine implements CinemaController {
  renderer: THREE.WebGLRenderer;
  camera = new THREE.PerspectiveCamera(36, 1, 0.1, 2600);
  world: World;
  quality: Quality;
  fps = 60;

  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  private grade!: ShaderPass;
  private raf = 0;
  private clock = new THREE.Clock();
  private t = 0;
  private running = false;
  private u = 0;
  private timeOverride: number | null = null;
  private smoothTime = 2;
  private csNow = 4;
  private talking: 0 | 1 | 2 | null = null;
  private pointer = new THREE.Vector2();
  private smoothPointer = new THREE.Vector2();
  private shot: ShotState = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 36, time: 2, cs: 4 };
  private camPos = new THREE.Vector3();
  private camTarget = new THREE.Vector3();
  private fovNow = 36;
  private frames = 0;
  private acc = 0;
  private slow = 0;
  private flash = 0;
  private sunNdc = new THREE.Vector3();
  private w = 1;
  private h = 1;
  private dprCap: number;
  private first = true;
  private mode: CinemaMode;
  private shaftsOn: boolean;
  onFirstFrame?: () => void;
  onQualityChange?: (q: Quality) => void;
  onContextLost?: () => void;

  constructor(private canvas: HTMLCanvasElement, mode: CinemaMode, quality: Quality) {
    this.mode = mode;
    this.quality = quality;
    this.shaftsOn = quality === "high";
    this.dprCap = quality === "high" ? 2 : quality === "medium" ? 1.5 : 1;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", alpha: false });
    // Scene passes render HDR into a float target; the OutputPass applies this tone map once, AFTER bloom.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = quality !== "low";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.stop();
      this.onContextLost?.();
    });
    (window as unknown as { __cine?: CinemaEngine }).__cine = this;
    this.world = new World(quality);
    this.world.setBubblesVisible(mode === "landing" || mode === "camp");
    this.buildComposer();
    this.resize();
    this.evaluate(0.016, true);
  }

  private buildComposer() {
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: this.quality === "low" ? 0 : 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.world.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.65, 1.0);
    this.bloom.enabled = this.quality !== "low";
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GRADE);
    this.composer.addPass(this.grade);
  }

  /** debug snapshot for tuning */
  debug() {
    const r = (v: THREE.Vector3) => [v.x, v.y, v.z].map((n) => Math.round(n * 10) / 10);
    return { cam: r(this.camera.position), target: r(this.camTarget), shotCam: r(this.shot.pos), cs: Math.round(this.shot.cs * 10) / 10, bear: r(this.world.bear.group.position), fov: Math.round(this.fovNow), time: Math.round(this.smoothTime * 100) / 100 };
  }

  /* ───────────── controller API ───────────── */
  setU(u: number) {
    this.u = u;
  }
  setTime(t: number | null) {
    this.timeOverride = t;
  }
  setTalking(who: 0 | 1 | 2 | null) {
    this.talking = who;
  }
  setLit(n: number) {
    this.world.setLit(n);
  }
  setPortal(a: number) {
    this.world.portalAmount = a;
    this.flash = Math.max(0, (a - 0.82) / 0.18);
  }
  setPointer(x: number, y: number) {
    this.pointer.set(x, y);
  }
  setBubbles(v: boolean) {
    this.world.setBubblesVisible(v);
  }

  resize() {
    const el = this.canvas.parentElement ?? this.canvas;
    const w = Math.max(2, el.clientWidth);
    const h = Math.max(2, el.clientHeight);
    this.w = w;
    this.h = h;
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    (this.grade.uniforms.res.value as THREE.Vector2).set(w * dpr, h * dpr);
  }

  /* ───────────── loop ───────────── */
  start() {
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      this.t += dt;
      this.evaluate(dt, false);
      this.composer.render(dt);
      this.adapt(dt);
      if (this.first) {
        this.first = false;
        this.onFirstFrame?.();
      }
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
  /** Render exactly one frame (reduced-motion / debug). */
  renderOnce() {
    this.evaluate(0.016, true);
    this.composer.render(0.016);
  }

  private evaluate(dt: number, snap: boolean) {
    const sh = this.mode === "landing" ? evalShots(LANDING_SHOTS, this.u, this.shot) : fixedShot(CAMP_SHOT, this.shot);
    const k = snap ? 1 : 1 - Math.pow(0.0008, dt); // critically damped-ish follow: the camera glides, it doesn't snap
    this.smoothPointer.lerp(this.pointer, snap ? 1 : 1 - Math.pow(0.02, dt));
    if (snap) {
      this.camPos.copy(sh.pos);
      this.camTarget.copy(sh.target);
      this.fovNow = sh.fov;
    } else {
      this.camPos.lerp(sh.pos, k);
      this.camTarget.lerp(sh.target, k);
      this.fovNow += (sh.fov - this.fovNow) * k;
    }
    // handheld breathing + pointer parallax (a few centimetres — enough to feel like a real lens)
    const cam = this.camera;
    cam.position.copy(this.camPos);
    const sway = new THREE.Vector3(Math.sin(this.t * 0.37) * 0.05, Math.sin(this.t * 0.53) * 0.035, Math.cos(this.t * 0.29) * 0.04);
    cam.position.add(sway);
    cam.lookAt(this.camTarget);
    const f0 = new THREE.Vector3().subVectors(this.camTarget, cam.position).normalize();
    const right = new THREE.Vector3().crossVectors(f0, new THREE.Vector3(0, 1, 0)).normalize();
    cam.position.addScaledVector(right, this.smoothPointer.x * 0.35).addScaledVector(new THREE.Vector3(0, 1, 0), this.smoothPointer.y * 0.18);
    cam.lookAt(this.camTarget);
    if (Math.abs(cam.fov - this.fovNow) > 0.01) {
      cam.fov = this.fovNow;
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld();

    // time of day eases toward the shot's (or the page's) wish
    const wantTime = this.timeOverride ?? sh.time;
    this.smoothTime += (wantTime - this.smoothTime) * (snap ? 1 : 1 - Math.pow(0.03, dt));
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    const camAz = THREE.MathUtils.radToDeg(Math.atan2(fwd.x, -fwd.z));
    this.world.camRight.copy(right);
    this.world.camBack.copy(fwd).multiplyScalar(-1).setY(0).normalize();
    this.world.setLook(this.smoothTime, camAz);
    this.world.setPointer(this.smoothPointer.x, this.smoothPointer.y);
    this.csNow = snap ? sh.cs : this.csNow + (sh.cs - this.csNow) * (1 - Math.pow(0.04, dt));
    this.world.setCast({ s: this.csNow, walk: 0, talking: this.talking }, dt, this.t);
    this.world.update(dt, this.t);

    // lights that ride with the camera
    const f = this.world.fill;
    f.position.copy(cam.position).addScaledVector(right, -2).add(new THREE.Vector3(0, 2.5, 0));
    f.target.position.copy(this.world.focus);
    const rim = this.world.rim;
    rim.position.copy(this.world.focus).addScaledVector(fwd, 14).add(new THREE.Vector3(-4, 6, 0));
    rim.target.position.copy(this.world.focus);

    // post settings from the look
    const L = this.world.look;
    this.bloom.strength = L.bloom;
    this.renderer.toneMappingExposure = L.exposure;
    // light shafts: only when the sun is in front of the lens and above the horizon
    this.sunNdc.copy(cam.position).addScaledVector(this.world.sunDir, 1000).project(cam);
    const inFront = fwd.dot(this.world.sunDir) > 0.15 && this.world.sunDir.y > -0.02;
    const gu = this.grade.uniforms;
    (gu.sunUV.value as THREE.Vector2).set(this.sunNdc.x * 0.5 + 0.5, this.sunNdc.y * 0.5 + 0.5);
    gu.shafts.value = this.shaftsOn && inFront ? Math.max(0, 1 - L.glow * 0.8) * 0.6 : 0;
    gu.time.value = this.t;
    gu.flash.value = this.flash;
    gu.vig.value = 0.32 + L.glow * 0.1;
    gu.warm.value = 0.1 - L.glow * 0.05;
  }

  /** Step quality down if the machine can't hold ~30 fps; never back up (no flip-flopping). */
  private adapt(dt: number) {
    this.frames++;
    this.acc += dt;
    if (this.frames < 40) return;
    const avg = this.acc / this.frames;
    this.fps = 1 / avg;
    this.frames = 0;
    this.acc = 0;
    if (avg > 1 / 26) this.slow++;
    else this.slow = Math.max(0, this.slow - 1);
    if (this.slow >= 2 && this.quality !== "low") {
      this.slow = 0;
      this.setQuality(this.quality === "high" ? "medium" : "low");
    }
  }

  setQuality(q: Quality) {
    this.quality = q;
    this.dprCap = q === "high" ? 2 : q === "medium" ? 1.5 : 1;
    this.shaftsOn = q === "high";
    this.bloom.enabled = q !== "low";
    this.renderer.shadowMap.enabled = q !== "low";
    this.world.sun.castShadow = q !== "low";
    this.resize();
    this.onQualityChange?.(q);
  }

  dispose() {
    this.stop();
    this.world.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
