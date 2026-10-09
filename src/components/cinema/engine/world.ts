import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { blendLook, makeLiveLook, sunDirection } from "./presets";
import { ROAD_LEN, WATER_Y, buildTerrain, fbm, groundHeight, lerp, nearestRoad, noise2, roadAt, smoothstep } from "./terrain";
import { bubbleIcon, cloudTexture, furBump, glowTexture, runeTexture, signTexture, starTexture } from "./textures";
import { buildBear, buildFox, buildOwl, type Character } from "./characters";

export type Quality = "high" | "medium" | "low";

export const GATE_S = 149;
export const CAMP_S = 398;

const rnd = (() => {
  let a = 1234567;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();

const windTime = { value: 0 };
/** Sway for instanced foliage — a few lines injected into the stock standard material. */
function addWind(mat: THREE.MeshStandardMaterial, strength: number) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = windTime;
    sh.vertexShader = "uniform float uTime;\n" + sh.vertexShader.replace(
      "#include <begin_vertex>",
      `vec3 transformed = vec3(position);
       #ifdef USE_INSTANCING
         float ph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.23;
         float hh = max(position.y, 0.0);
         transformed.x += sin(uTime * 1.5 + ph) * ${strength.toFixed(3)} * hh;
         transformed.z += cos(uTime * 1.2 + ph * 1.3) * ${(strength * 0.6).toFixed(3)} * hh;
       #endif`,
    );
  };
}

function tinted(geo: THREE.BufferGeometry, fn: (y: number, x: number, z: number) => THREE.Color): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const c = fn(p.getY(i), p.getX(i), p.getZ(i));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(p.count * 2), 2));
  return g;
}

export interface CastPose {
  s: number; // distance along the road
  walk: number; // 0..1
  talking: 0 | 1 | 2 | null;
}

export class World {
  scene = new THREE.Scene();
  quality: Quality;
  look = makeLiveLook();
  sunDir = new THREE.Vector3();

  sun: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  rim: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  sky: THREE.Mesh;
  skyU: Record<string, THREE.IUniform>;
  water: THREE.Mesh;
  waterU: Record<string, THREE.IUniform>;
  clouds: THREE.Sprite[] = [];
  bear = buildBear();
  fox = buildFox();
  owl = buildOwl();
  castGroup = new THREE.Group();
  focus = new THREE.Vector3();

  private gatePortal?: THREE.ShaderMaterial;
  private gateLight!: THREE.PointLight;
  private fire!: { light: THREE.PointLight; flames: THREE.Sprite[] };
  private windowMat!: THREE.MeshStandardMaterial;
  private lanternMats: THREE.MeshStandardMaterial[] = [];
  private lanternSprites: THREE.Sprite[] = [];
  private litCount = 0;
  private bubbles: { g: THREE.Group; base: THREE.Vector3; ph: number }[] = [];
  camRight = new THREE.Vector3(1, 0, 0);
  camUp = new THREE.Vector3(0, 1, 0);
  camBack = new THREE.Vector3(0, 0, 1);
  private stars: { s: THREE.Sprite; base: THREE.Vector3; ph: number }[] = [];
  private motes!: THREE.Points;
  private moteBase!: Float32Array;
  private sparks!: THREE.Points;
  private smoke: THREE.Sprite[] = [];
  private yaw: Record<string, number> = { bear: Math.PI, fox: Math.PI, owl: Math.PI };
  private phase = { bear: 0, fox: 0 };
  private lastS = 0;
  private walkEase = 0;
  private pointer = new THREE.Vector2();
  private hop = [0, 0, 0];
  portalAmount = 0;

  constructor(quality: Quality) {
    this.quality = quality;
    const sc = this.scene;
    sc.fog = new THREE.FogExp2("#cfe5f5", 0.0035);

    this.hemi = new THREE.HemisphereLight("#a8cdff", "#7fa24e", 1);
    sc.add(this.hemi);
    this.sun = new THREE.DirectionalLight("#fff0d4", 3);
    this.sun.castShadow = quality !== "low";
    const ms = quality === "high" ? 2048 : 1024;
    this.sun.shadow.mapSize.set(ms, ms);
    const sh = this.sun.shadow.camera;
    sh.left = -9;
    sh.right = 9;
    sh.top = 9;
    sh.bottom = -9;
    sh.near = 1;
    sh.far = 140;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 4;
    sc.add(this.sun, this.sun.target);
    this.fill = new THREE.DirectionalLight("#cfe0ff", 0.8);
    this.rim = new THREE.DirectionalLight("#ffc98a", 1.4);
    sc.add(this.fill, this.fill.target, this.rim, this.rim.target);

    // ── sky dome ──
    this.skyU = {
      top: { value: new THREE.Color() },
      mid: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color() },
      stars: { value: 0 },
      time: { value: 0 },
    };
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(1400, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: this.skyU,
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
        fragmentShader: `
          varying vec3 vDir; uniform vec3 top, mid, horizon, sunDir, sunColor; uniform float stars, time;
          float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
          void main(){
            vec3 d = normalize(vDir); float h = d.y;
            vec3 col = h > 0.0 ? mix(horizon, mix(mid, top, smoothstep(0.12, 0.85, h)), smoothstep(0.0, 0.32, h)) : horizon * (0.85 + h*0.3);
            float s = max(dot(d, normalize(sunDir)), 0.0);
            float calm = 1.0 - stars * 0.85;
            col += sunColor * (pow(s, 900.0) * 14.0 + pow(s, 60.0) * 0.7 * calm + pow(s, 7.0) * 0.28 * calm);
            if (stars > 0.01 && h > 0.0) {
              vec3 p = d * 230.0; vec3 ip = floor(p); float r = hash(ip);
              float dd = length(fract(p) - 0.5);
              float tw = 0.55 + 0.45 * sin(time * 2.0 + r * 60.0);
              col += vec3(1.0, 0.97, 0.9) * step(0.9968, r) * smoothstep(0.26, 0.0, dd) * (0.6 + 1.6 * fract(r * 91.0)) * tw * stars * smoothstep(0.0, 0.25, h);
            }
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    );
    this.sky.renderOrder = -10;
    sc.add(this.sky);

    // ── land ──
    const terrain = buildTerrain();
    sc.add(terrain.mesh);
    this.waterU = {
      time: { value: 0 },
      deep: { value: new THREE.Color() },
      sky: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3() },
      sunColor: { value: new THREE.Color() },
      fogColor: { value: new THREE.Color() },
      fogDensity: { value: 0.003 },
    };
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(520, 620, 1, 1).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: this.waterU,
        vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
        fragmentShader: `
          varying vec3 vW; uniform float time, fogDensity; uniform vec3 deep, sky, sunDir, sunColor, fogColor;
          float wv(vec2 p){ return sin(p.x*0.21 + p.y*0.16 + time*0.55) + 0.6*sin(p.x*0.47 - p.y*0.39 - time*0.8) + 0.35*sin(p.x*0.93 + p.y*0.71 + time*1.2) + 0.18*sin(p.x*1.9 - p.y*2.3 - time*1.7); }
          void main(){
            vec2 p = vW.xz; float e = 0.35;
            float hx = wv(p + vec2(e, 0.0)) - wv(p - vec2(e, 0.0));
            float hz = wv(p + vec2(0.0, e)) - wv(p - vec2(0.0, e));
            vec3 N = normalize(vec3(-hx * 0.07, 1.0, -hz * 0.07));
            vec3 V = normalize(cameraPosition - vW);
            float cosT = max(dot(V, N), 0.0);
            float fres = 0.03 + 0.97 * pow(1.0 - cosT, 5.0);
            vec3 col = mix(deep, sky, clamp(fres * 1.15, 0.0, 1.0));
            vec3 R = reflect(-V, N);
            col += sunColor * (pow(max(dot(R, normalize(sunDir)), 0.0), 380.0) * 7.0 + pow(max(dot(R, normalize(sunDir)), 0.0), 40.0) * 0.18);
            float d = length(cameraPosition - vW);
            float f = (1.0 - exp(-d*d*fogDensity*fogDensity)) * 0.7;
            col = mix(col, fogColor, f);
            gl_FragColor = vec4(col, 0.96);
          }`,
      }),
    );
    this.water.position.set(-92, WATER_Y, -26);
    sc.add(this.water);

    this.buildFlora();
    this.buildSteps();
    this.buildGate();
    this.buildCamp();
    this.buildAtmosphere();
    this.buildBubbles();

    // ── the cast ──
    for (const c of [this.bear, this.fox, this.owl]) {
      this.castGroup.add(c.group);
    }
    sc.add(this.castGroup);
    this.setCast({ s: 4, walk: 0, talking: null }, 0.016, 0);
    this.setLook(2, 0);
  }

  /* ───────────────────────── foliage, rocks, flowers ───────────────────────── */
  private buildFlora() {
    const sc = this.scene;
    // pines
    const pineParts: THREE.BufferGeometry[] = [];
    const trunk = tinted(new THREE.CylinderGeometry(0.16, 0.24, 1.1, 8), () => new THREE.Color("#5b3b22"));
    trunk.translate(0, 0.55, 0);
    pineParts.push(trunk);
    const tiers: [number, number, number][] = [[1.45, 1.9, 0.9], [1.15, 1.7, 2.0], [0.82, 1.5, 3.05], [0.5, 1.2, 4.0]];
    for (const [r, h, y] of tiers) {
      const c = new THREE.ConeGeometry(r, h, 9, 1);
      c.translate(0, y + h / 2 - 0.2, 0);
      pineParts.push(tinted(c, (yy) => new THREE.Color("#2a7a45").lerp(new THREE.Color("#58b05a"), smoothstep(0, 5.5, yy))));
    }
    const pineGeo = mergeGeometries(pineParts)!;
    // broadleaf
    const oakParts: THREE.BufferGeometry[] = [];
    const t2 = tinted(new THREE.CylinderGeometry(0.2, 0.3, 2.2, 8), () => new THREE.Color("#6b4528"));
    t2.translate(0, 1.1, 0);
    oakParts.push(t2);
    const blobs: [number, number, number, number][] = [[0, 3.4, 0, 1.9], [-1.1, 2.9, 0.4, 1.35], [1.2, 3.0, -0.3, 1.4], [0.2, 4.4, 0.2, 1.3], [-0.4, 3.1, -1.1, 1.3]];
    for (const [x, y, z, r] of blobs) {
      const b0 = new THREE.IcosahedronGeometry(r, 4);
      b0.deleteAttribute("normal");
      b0.deleteAttribute("uv");
      const b = mergeVertices(b0, 1e-4); // shared vertices → smooth normals instead of faceted ones
      const p = b.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const k = 1 + (noise2(p.getX(i) * 1.6 + x, p.getZ(i) * 1.6 + z) - 0.5) * 0.2;
        p.setXYZ(i, p.getX(i) * k + x, p.getY(i) * k + y, p.getZ(i) * k + z);
      }
      b.computeVertexNormals();
      oakParts.push(tinted(b, (yy) => new THREE.Color("#3f9a4a").lerp(new THREE.Color("#9ad55e"), smoothstep(1.6, 6, yy))));
    }
    const oakGeo = mergeGeometries(oakParts)!;

    const pineMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    const oakMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    addWind(pineMat, 0.012);
    addWind(oakMat, 0.01);
    const pines: THREE.Matrix4[] = [];
    const oaks: THREE.Matrix4[] = [];
    const pinesC: THREE.Color[] = [];
    const oaksC: THREE.Color[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (let x = -250; x < 340; x += 7) {
      for (let z = -470; z < 70; z += 7) {
        const px = x + (rnd() - 0.5) * 9;
        const pz = z + (rnd() - 0.5) * 9;
        const { d } = nearestRoad(px, pz);
        if (d < 13) continue;
        const y = groundHeight(px, pz);
        if (y < WATER_Y + 1.2 || y > 85) continue;
        const dens = fbm(px * 0.012 + 3, pz * 0.012, 3);
        const near = 1 - smoothstep(14, 120, d) * 0.55;
        if (rnd() > (dens - 0.28) * 1.5 * near) continue;
        const sc2 = (0.7 + rnd() * 1.1) * (y > 55 ? 0.8 : 1) * (d < 14 ? 1.0 : 1.2);
        q.setFromAxisAngle(up, rnd() * 6.28);
        m.compose(new THREE.Vector3(px, y - 0.1, pz), q, new THREE.Vector3(sc2, sc2 * (0.9 + rnd() * 0.3), sc2));
        const col = new THREE.Color().setHSL(0.3 + rnd() * 0.05, 0.25 + rnd() * 0.2, 0.62 + rnd() * 0.38);
        if (y > 38 || noise2(px * 0.04, pz * 0.04) > 0.6) {
          pines.push(m.clone());
          pinesC.push(col);
        } else {
          oaks.push(m.clone());
          oaksC.push(col);
        }
      }
    }
    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[], cols: THREE.Color[]) => {
      const im = new THREE.InstancedMesh(geo, mat, mats.length);
      mats.forEach((mm, i) => {
        im.setMatrixAt(i, mm);
        im.setColorAt(i, cols[i]);
      });
      im.frustumCulled = false;
      sc.add(im);
      return im;
    };
    mk(pineGeo, pineMat, pines, pinesC);
    mk(oakGeo, oakMat, oaks, oaksC);

    // rocks
    const rockBase = new THREE.IcosahedronGeometry(1, 3);
    rockBase.deleteAttribute("normal");
    rockBase.deleteAttribute("uv");
    const rockGeo = mergeVertices(rockBase, 1e-4);
    {
      const p = rockGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const k = 1 + (noise2(p.getX(i) * 1.7, p.getZ(i) * 1.7 + p.getY(i)) - 0.5) * 0.45;
        p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k);
      }
      rockGeo.computeVertexNormals();
    }
    const rocks: THREE.Matrix4[] = [];
    for (let i = 0; i < 260; i++) {
      const px = -200 + rnd() * 480;
      const pz = -440 + rnd() * 480;
      const { d } = nearestRoad(px, pz);
      const y = groundHeight(px, pz);
      if (d < 4.2 || y < WATER_Y + 0.4) continue;
      const s = 0.4 + rnd() * rnd() * 3;
      q.setFromAxisAngle(up, rnd() * 6.28);
      rocks.push(new THREE.Matrix4().compose(new THREE.Vector3(px, y + s * 0.15, pz), q, new THREE.Vector3(s * 1.3, s, s)));
    }
    const rockMesh = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: "#8f8880", roughness: 0.95, bumpMap: furBump(), bumpScale: 2 }), rocks.length);
    rocks.forEach((mm, i) => rockMesh.setMatrixAt(i, mm));
    rockMesh.frustumCulled = false;
    sc.add(rockMesh);

    // grass tufts + flowers hugging the road
    const blade = (a: number) => {
      const g = new THREE.ConeGeometry(0.028, 0.34, 4, 1);
      g.translate(0, 0.17, 0);
      g.rotateZ(a);
      return g;
    };
    const tuftGeo = tinted(mergeGeometries([blade(0.0), blade(0.35), blade(-0.35), blade(0.18).rotateY(1.4)])!, (y) => new THREE.Color("#3f9d47").lerp(new THREE.Color("#b6e36a"), smoothstep(0, 0.6, y)));
    const tuftMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
    addWind(tuftMat, 0.3);
    const TUFTS = this.quality === "low" ? 4500 : 11000;
    const tuft = new THREE.InstancedMesh(tuftGeo, tuftMat, TUFTS);
    let ti = 0;
    for (let tries = 0; tries < TUFTS * 3 && ti < TUFTS; tries++) {
      const s = rnd() * ROAD_LEN;
      const p = roadAt(s);
      const side = (rnd() < 0.5 ? -1 : 1) * (2.3 + Math.pow(rnd(), 1.6) * 16);
      const px = p.pos.x + -p.dir.z * side;
      const pz = p.pos.z + p.dir.x * side;
      const y = groundHeight(px, pz);
      if (y < WATER_Y + 0.3) continue;
      const sc2 = 0.7 + rnd() * 1.0;
      q.setFromAxisAngle(up, rnd() * 6.28);
      tuft.setMatrixAt(ti, m.compose(new THREE.Vector3(px, y - 0.02, pz), q, new THREE.Vector3(sc2, sc2 * (0.8 + rnd() * 0.7), sc2)));
      tuft.setColorAt(ti, new THREE.Color().setHSL(0.27 + rnd() * 0.06, 0.4, 0.8 + rnd() * 0.3));
      ti++;
    }
    tuft.count = ti;
    tuft.frustumCulled = false;
    sc.add(tuft);

    const FL = this.quality === "low" ? 500 : 1500;
    const stemGeo = tinted(new THREE.CylinderGeometry(0.012, 0.016, 0.34, 5).translate(0, 0.17, 0), () => new THREE.Color("#3f8f3f"));
    const stems = new THREE.InstancedMesh(stemGeo, new THREE.MeshStandardMaterial({ vertexColors: true }), FL);
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: new THREE.Color("#222") }), FL);
    const palette = ["#fff6e0", "#ffd24a", "#ff7f7f", "#ff9ccf", "#c58cf5", "#ffffff"].map((c) => new THREE.Color(c));
    let fi = 0;
    for (let tries = 0; tries < FL * 3 && fi < FL; tries++) {
      const s = rnd() * ROAD_LEN;
      const p = roadAt(s);
      const side = (rnd() < 0.5 ? -1 : 1) * (2.2 + Math.pow(rnd(), 1.5) * 9);
      const px = p.pos.x + -p.dir.z * side;
      const pz = p.pos.z + p.dir.x * side;
      const y = groundHeight(px, pz);
      if (y < WATER_Y + 0.3) continue;
      const k = 0.9 + rnd() * 1.1;
      const mm = new THREE.Matrix4().compose(new THREE.Vector3(px, y, pz), new THREE.Quaternion(), new THREE.Vector3(k, k, k));
      stems.setMatrixAt(fi, mm);
      heads.setMatrixAt(fi, new THREE.Matrix4().compose(new THREE.Vector3(px, y + 0.34 * k, pz), new THREE.Quaternion(), new THREE.Vector3(k, k * 0.7, k)));
      heads.setColorAt(fi, palette[Math.floor(rnd() * palette.length)]);
      fi++;
    }
    stems.count = heads.count = fi;
    stems.frustumCulled = heads.frustumCulled = false;
    sc.add(stems, heads);
  }

  /* ───────────────────────── stone steps climbing the first hill ───────────────────────── */
  private buildSteps() {
    const stone = new THREE.MeshStandardMaterial({ color: "#a9a091", roughness: 0.92, bumpMap: furBump(), bumpScale: 1.5 });
    const stoneB = new THREE.MeshStandardMaterial({ color: "#968d7e", roughness: 0.94, bumpMap: furBump(), bumpScale: 1.5 });
    const stepGeo = new RoundedBoxGeometry(3.3, 0.5, 1.5, 3, 0.07);
    for (let s = 0.8, i = 0; s < 31; s += 1.5, i++) {
      const p = roadAt(s);
      const slab = new THREE.Mesh(stepGeo, i % 2 ? stone : stoneB);
      slab.position.set(p.pos.x, p.y - 0.16, p.pos.z);
      slab.rotation.y = Math.atan2(p.dir.x, p.dir.z) + (rnd() - 0.5) * 0.08;
      slab.scale.set(0.9 + rnd() * 0.25, 1 + (rnd() - 0.5) * 0.15, 1);
      slab.receiveShadow = true;
      slab.castShadow = true;
      this.scene.add(slab);
    }
  }

  /* ───────────────────────── the gate ───────────────────────── */
  private buildGate() {
    const root = new THREE.Group();
    const a = roadAt(GATE_S);
    root.position.copy(a.pos);
    root.rotation.y = Math.atan2(a.dir.x, a.dir.z);
    const stone = new THREE.MeshStandardMaterial({ color: "#b3ab99", roughness: 0.92, bumpMap: furBump(), bumpScale: 2.2 });
    const dark = new THREE.MeshStandardMaterial({ color: "#8f8878", roughness: 0.95, bumpMap: furBump(), bumpScale: 2.2 });
    const R = 3.4;
    const r = 2.35;
    const H = 3.0;
    const depth = 1.7;
    // pillars
    for (const sd of [-1, 1]) {
      for (let k = 0; k < 5; k++) {
        const b = new THREE.Mesh(new RoundedBoxGeometry(R - r + 0.08, H / 5 + 0.02, depth, 3, 0.06), k % 2 ? stone : dark);
        b.position.set(sd * ((R + r) / 2), (k + 0.5) * (H / 5), 0);
        b.rotation.y = (rnd() - 0.5) * 0.03;
        b.castShadow = b.receiveShadow = true;
        root.add(b);
      }
    }
    // voussoirs
    const N = 15;
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N;
      const ang = Math.PI * t;
      const b = new THREE.Mesh(new RoundedBoxGeometry(R - r + 0.06, (Math.PI * ((R + r) / 2)) / N + 0.05, depth, 3, 0.06), i % 2 ? stone : dark);
      b.position.set(Math.cos(Math.PI - ang) * ((R + r) / 2), H + Math.sin(Math.PI - ang) * ((R + r) / 2), 0);
      b.rotation.z = Math.PI - ang; // the block's width axis points along the arch radius
      b.castShadow = b.receiveShadow = true;
      root.add(b);
    }
    // keystone with glowing rune
    const key = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.9, depth + 0.15, 3, 0.07), dark);
    key.position.set(0, H + (R + r) / 2 + 0.05, 0);
    root.add(key);
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: runeTexture(), transparent: true, depthWrite: false }));
    rune.position.set(0, H + (R + r) / 2 + 0.05, depth / 2 + 0.09);
    root.add(rune);
    // portal
    const shape = new THREE.Shape();
    shape.moveTo(-r, 0);
    shape.lineTo(-r, H);
    shape.absarc(0, H, r, Math.PI, 0, true);
    shape.lineTo(r, 0);
    shape.closePath();
    this.gatePortal = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { time: { value: 0 }, amount: { value: 0 } },
      vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        varying vec2 vP; uniform float time, amount;
        void main(){
          vec2 c = vec2(vP.x, vP.y - 3.2);
          float rad = length(c); float a = atan(c.y, c.x);
          float sw = sin(a*5.0 + rad*3.2 - time*1.4) * 0.5 + 0.5;
          float sw2 = sin(a*3.0 - rad*5.0 + time*0.9) * 0.5 + 0.5;
          vec3 col = mix(vec3(1.0,0.93,0.62), vec3(0.45,0.95,0.85), smoothstep(0.1,3.6,rad));
          col += (sw*0.4 + sw2*0.3) * vec3(1.0,0.96,0.75);
          col *= 2.2 + amount*6.0;
          gl_FragColor = vec4(col, 0.97);
        }`,
    });
    const portal = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), this.gatePortal);
    portal.position.z = -0.1;
    root.add(portal);
    this.gateLight = new THREE.PointLight("#ffe7a0", 30, 40, 2);
    this.gateLight.position.set(0, 3, 1.2);
    root.add(this.gateLight);
    // glow around it
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: "#ffe6a0", blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.8 }));
    halo.scale.set(13, 13, 1);
    halo.position.set(0, 3.2, 0.3);
    root.add(halo);
    // steps
    for (let i = 0; i < 3; i++) {
      const st = new THREE.Mesh(new RoundedBoxGeometry(R * 2 + 1.2 + (2 - i) * 1.1, 0.22, 2.2 + (2 - i) * 0.5, 3, 0.05), stone);
      st.position.set(0, 0.11 + i * 0.0, 1.0 + (2 - i) * 0.35);
      st.position.y = -0.05 + i * 0.001;
      st.receiveShadow = true;
      root.add(st);
    }
    // vines and foliage
    const leaf = new THREE.MeshStandardMaterial({ color: "#58a64a", roughness: 0.8 });
    for (let i = 0; i < 70; i++) {
      const sd = rnd() < 0.5 ? -1 : 1;
      const t = rnd();
      const onArch = t > 0.45;
      const ang = Math.PI * (sd < 0 ? 1 - (t - 0.45) * 1.6 : (t - 0.45) * 1.6);
      const px = onArch ? Math.cos(Math.PI - ang) * (R + 0.05) : sd * (R + 0.04);
      const py = onArch ? H + Math.sin(Math.PI - ang) * (R + 0.05) : t * 2.2 * H;
      const lf = new THREE.Mesh(new THREE.SphereGeometry(0.1 + rnd() * 0.12, 8, 6), leaf);
      lf.scale.set(1.5, 0.35, 1);
      lf.position.set(px + (rnd() - 0.5) * 0.15, py, (rnd() - 0.5) * depth);
      lf.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      root.add(lf);
    }
    this.scene.add(root);
  }

  /* ───────────────────────── camp: cottage, fire, tent, lantern string, signs ───────────────────────── */
  private buildCamp() {
    const a = roadAt(CAMP_S);
    const root = new THREE.Group();
    root.position.copy(a.pos);
    root.rotation.y = Math.atan2(a.dir.x, a.dir.z);
    this.scene.add(root);
    const side = (x: number, z: number) => new THREE.Vector3(x, 0, z);

    // cottage (left of the road)
    const house = new THREE.Group();
    house.position.copy(side(-9.5, -3));
    house.rotation.y = Math.PI / 2 + 0.25;
    const plaster = new THREE.MeshStandardMaterial({ color: "#f2e3c4", roughness: 0.92 });
    const wood = new THREE.MeshStandardMaterial({ color: "#7b5230", roughness: 0.75, bumpMap: furBump(), bumpScale: 1 });
    const roofMat = new THREE.MeshStandardMaterial({ color: "#a8472f", roughness: 0.8 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(5.6, 3.2, 4.4, 4, 0.1), plaster);
    body.position.y = 1.6;
    body.castShadow = body.receiveShadow = true;
    house.add(body);
    for (const s of [-1, 1]) {
      const roof = new THREE.Mesh(new RoundedBoxGeometry(6.3, 0.22, 3.0, 3, 0.05), roofMat);
      roof.position.set(0, 4.0, s * 1.15);
      roof.rotation.x = -s * 0.74;
      roof.castShadow = true;
      house.add(roof);
    }
    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 6.4, 8), wood);
    ridge.rotation.z = Math.PI / 2;
    ridge.position.y = 4.78;
    house.add(ridge);
    const chim = new THREE.Mesh(new RoundedBoxGeometry(0.7, 1.9, 0.7, 2, 0.05), new THREE.MeshStandardMaterial({ color: "#8b6a58", roughness: 0.95 }));
    chim.position.set(1.7, 4.7, -0.6);
    house.add(chim);
    const door = new THREE.Mesh(new RoundedBoxGeometry(1.05, 2.0, 0.14, 3, 0.04), wood);
    door.position.set(-1.0, 1.0, 2.25);
    house.add(door);
    this.windowMat = new THREE.MeshStandardMaterial({ color: "#ffe2a0", emissive: new THREE.Color("#ffb23d"), emissiveIntensity: 0.5, roughness: 0.4 });
    for (const x of [1.0, 2.0]) {
      const frame = new THREE.Mesh(new RoundedBoxGeometry(0.86, 1.0, 0.1, 2, 0.03), wood);
      frame.position.set(x, 1.75, 2.24);
      house.add(frame);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.8), this.windowMat);
      win.position.set(x, 1.75, 2.3);
      house.add(win);
    }
    root.add(house);
    // smoke
    for (let i = 0; i < 7; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: "#d9d6e8", transparent: true, depthWrite: false, opacity: 0.0 }));
      sp.userData.i = i;
      sp.userData.base = new THREE.Vector3(-9.5, 0, -3).add(new THREE.Vector3(Math.cos(house.rotation.y) * 1.7 - Math.sin(house.rotation.y) * -0.6, 5.9, -Math.sin(house.rotation.y) * 1.7 + Math.cos(house.rotation.y) * -0.6));
      this.smoke.push(sp);
      root.add(sp);
    }

    // campfire (right of the road)
    const fp = side(4.2, 2.6);
    const stones = new THREE.MeshStandardMaterial({ color: "#7d776f", roughness: 0.95, bumpMap: furBump(), bumpScale: 2 });
    for (let i = 0; i < 10; i++) {
      const st = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2 + rnd() * 0.08, 1), stones);
      const an = (i / 10) * Math.PI * 2;
      st.position.set(fp.x + Math.cos(an) * 0.62, 0.12, fp.z + Math.sin(an) * 0.62);
      st.scale.y = 0.7;
      st.castShadow = true;
      root.add(st);
    }
    for (let i = 0; i < 4; i++) {
      const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.85, 8), wood);
      lg.position.set(fp.x, 0.16, fp.z);
      lg.rotation.set(Math.PI / 2 - 0.25, (i / 4) * Math.PI * 2, 0);
      lg.castShadow = true;
      root.add(lg);
    }
    const flames: THREE.Sprite[] = [];
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: i < 2 ? "#ff8a2a" : "#ffd25a", blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.95 }));
      sp.position.set(fp.x, 0.5 + i * 0.12, fp.z);
      sp.scale.set(1.1 - i * 0.18, 1.5 - i * 0.2, 1);
      flames.push(sp);
      root.add(sp);
    }
    const fl = new THREE.PointLight("#ff8f3d", 18, 16, 2);
    fl.position.set(fp.x, 0.9, fp.z);
    root.add(fl);
    this.fire = { light: fl, flames };
    // sparks
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(60 * 3), 3));
    this.sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ map: glowTexture(), color: "#ffb04a", size: 0.2, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, sizeAttenuation: true }));
    this.sparks.position.set(fp.x, 0, fp.z);
    this.sparks.frustumCulled = false;
    root.add(this.sparks);
    // seats
    for (const [x, z] of [[2.8, 4.4], [6.2, 2.0]]) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.9, 14), wood);
      log.position.set(x, 0.34, z);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = 0.6;
      log.castShadow = true;
      root.add(log);
    }

    // tent
    const tent = new THREE.Mesh(new THREE.ConeGeometry(2.3, 2.5, 4, 1, true), new THREE.MeshStandardMaterial({ color: "#d9533a", roughness: 0.82, side: THREE.DoubleSide }));
    tent.position.set(6.8, 1.25, -4.2);
    tent.rotation.y = Math.PI / 4 + 0.3;
    tent.castShadow = true;
    root.add(tent);
    const flap = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.0), new THREE.MeshStandardMaterial({ color: "#3a1d14", roughness: 1 }));
    flap.position.set(5.65, 0.95, -3.45);
    flap.rotation.y = -Math.PI / 4 - 0.55 + Math.PI;
    root.add(flap);

    // lantern string between two posts
    const postA = side(-5.5, 3.2);
    const postB = side(8.5, 2.2);
    for (const p of [postA, postB]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 4.6, 8), wood);
      pole.position.set(p.x, 2.3, p.z);
      pole.castShadow = true;
      root.add(pole);
    }
    const N = 12;
    const lglass = (on: boolean) => new THREE.MeshStandardMaterial({ color: "#ffd98a", emissive: new THREE.Color("#ffb23d"), emissiveIntensity: on ? 2.2 : 0.25, roughness: 0.4 });
    const wire: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      wire.push(new THREE.Vector3(lerp(postA.x, postB.x, t), 4.5 - Math.sin(t * Math.PI) * 0.7, lerp(postA.z, postB.z, t)));
    }
    root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wire), 40, 0.018, 5), new THREE.MeshStandardMaterial({ color: "#3a2a1c" })));
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N;
      const x = lerp(postA.x, postB.x, t);
      const z = lerp(postA.z, postB.z, t);
      const y = 4.5 - Math.sin(t * Math.PI) * 0.7 - 0.3;
      const mat = lglass(false);
      this.lanternMats.push(mat);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.068, 0.2, 12), mat);
      body.position.set(x, y, z);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.07, 12), new THREE.MeshStandardMaterial({ color: "#2e2118" }));
      cap.position.set(x, y + 0.13, z);
      root.add(body, cap);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: "#ffc766", blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
      gl.scale.set(1.1, 1.1, 1);
      gl.position.set(x, y, z);
      this.lanternSprites.push(gl);
      root.add(gl);
    }

    // sign post at the road
    const sp = new THREE.Group();
    sp.position.copy(side(-2.4, 7.5));
    sp.rotation.y = 0.35;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3.0, 8), wood);
    pole.position.y = 1.5;
    sp.add(pole);
    ["Plan a trip", "Explore places", "Festivals", "Community"].forEach((label, i) => {
      const board = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.42, 0.06, 2, 0.02), new THREE.MeshStandardMaterial({ map: signTexture(label), roughness: 0.8 }));
      board.position.set(i % 2 ? -0.18 : 0.18, 2.75 - i * 0.5, 0.1);
      board.rotation.z = (i % 2 ? 1 : -1) * 0.04;
      board.castShadow = true;
      sp.add(board);
    });
    root.add(sp);
  }

  /* ───────────────────────── clouds, bokeh motes, floating stars ───────────────────────── */
  private buildAtmosphere() {
    const sc = this.scene;
    const texs = [cloudTexture(1), cloudTexture(2), cloudTexture(3)];
    for (let i = 0; i < 34; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texs[i % 3], transparent: true, depthWrite: false, fog: false, opacity: 0.9 }));
      const ang = rnd() * Math.PI * 2;
      const rad = 260 + rnd() * 700;
      sp.position.set(70 + Math.cos(ang) * rad, 90 + rnd() * 110, -190 + Math.sin(ang) * rad);
      const k = 120 + rnd() * 150;
      sp.scale.set(k, k * 0.55, 1);
      sp.renderOrder = -5;
      this.clouds.push(sp);
      sc.add(sp);
    }
    // drifting pollen / fireflies around the cast
    const N = this.quality === "low" ? 120 : 320;
    this.moteBase = new Float32Array(N * 4);
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      this.moteBase[i * 4] = (rnd() - 0.5) * 34;
      this.moteBase[i * 4 + 1] = rnd() * 9;
      this.moteBase[i * 4 + 2] = (rnd() - 0.5) * 34;
      this.moteBase[i * 4 + 3] = rnd() * 6.28;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(g, new THREE.PointsMaterial({ map: glowTexture(), color: "#fff2c4", size: 0.26, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
    this.motes.frustumCulled = false;
    sc.add(this.motes);
    // sparkle stars
    const stex = starTexture();
    for (let i = 0; i < 26; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: stex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
      const base = new THREE.Vector3((rnd() - 0.5) * 16, 1.5 + rnd() * 7, (rnd() - 0.5) * 16);
      this.stars.push({ s, base, ph: rnd() * 6.28 });
      s.scale.setScalar(0.28 + rnd() * 0.4);
      sc.add(s);
    }
  }

  private buildBubbles() {
    const icons = ["🗺️", "🧭", "⛰️", "🏮", "🎒", "🌍"];
    const bm = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {},
      vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); vec3 c = mix(vec3(0.75,0.92,1.0), vec3(1.0,0.84,0.95), vN.y*0.5+0.5); gl_FragColor = vec4(c * (0.5 + f*1.6), f*0.85 + 0.05); }`,
    });
    icons.forEach((e, i) => {
      const g = new THREE.Group();
      const sph = new THREE.Mesh(new THREE.SphereGeometry(0.32, 28, 20), bm);
      g.add(sph);
      const ic = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleIcon(e), transparent: true, depthWrite: false, opacity: 0.95 }));
      ic.scale.set(0.36, 0.36, 1);
      g.add(ic);
      // x = camera-right, y = up, z = toward the camera (negative = behind the cast). Kept to the sides and above.
      const sideSign = i % 2 ? 1 : -1;
      const base = new THREE.Vector3(sideSign * (2.3 + (i % 3) * 0.55), 1.5 + ((i * 7) % 5) * 0.55, -1.2 - (i % 2) * 0.8);
      this.bubbles.push({ g, base, ph: rnd() * 6.28 });
      this.scene.add(g);
    });
  }

  /* ───────────────────────── runtime controls ───────────────────────── */
  setLook(time: number, azimuthBias: number) {
    const L = blendLook(time, this.look);
    this.sunDir = sunDirection(L.sunElev, L.sunAz + azimuthBias, this.sunDir);
    this.hemi.color.copy(L.hemiSky);
    this.hemi.groundColor.copy(L.hemiGround);
    this.hemi.intensity = L.hemiInt * 1.25;
    this.sun.color.copy(L.sunColor);
    this.sun.intensity = L.sunInt;
    this.rim.color.copy(L.rimColor);
    this.rim.intensity = L.rimInt * 0.9;
    this.fill.intensity = THREE.MathUtils.lerp(1.5, 0.7, L.glow);
    (this.scene.fog as THREE.FogExp2).color.copy(L.fog);
    (this.scene.fog as THREE.FogExp2).density = L.fogDensity;
    this.skyU.top.value.copy(L.skyTop);
    this.skyU.mid.value.copy(L.skyMid);
    this.skyU.horizon.value.copy(L.skyHorizon);
    (this.skyU.sunDir.value as THREE.Vector3).copy(this.sunDir);
    this.skyU.sunColor.value.copy(L.sunColor).multiplyScalar(L.stars > 0.9 ? 0.55 : 1);
    this.skyU.stars.value = L.stars;
    this.waterU.deep.value.copy(L.water);
    this.waterU.sky.value.copy(L.skyHorizon).lerp(L.skyMid, 0.5);
    (this.waterU.sunDir.value as THREE.Vector3).copy(this.sunDir);
    this.waterU.sunColor.value.copy(L.sunColor);
    this.waterU.fogColor.value.copy(L.fog);
    this.waterU.fogDensity.value = L.fogDensity;
    for (const c of this.clouds) {
      (c.material as THREE.SpriteMaterial).color.copy(L.cloud);
      (c.material as THREE.SpriteMaterial).opacity = L.cloudOpacity;
    }
    this.windowMat.emissiveIntensity = 0.3 + L.glow * 1.5;
    const gl = L.glow;
    this.lanternMats.forEach((m, i) => (m.emissiveIntensity = i < this.litCount ? 1.3 + gl * 0.9 : 0.12 + gl * 1.2));
    this.lanternSprites.forEach((s, i) => ((s.material as THREE.SpriteMaterial).opacity = (i < this.litCount ? 0.25 : 0.0) + gl * (i < this.litCount ? 0.25 : 0.22)));
    (this.motes.material as THREE.PointsMaterial).opacity = 0.35 + gl * 0.6;
    (this.motes.material as THREE.PointsMaterial).color.set(gl > 0.5 ? "#ffe9a0" : "#fff6dc");
    for (const b of this.stars) (b.s.material as THREE.SpriteMaterial).opacity = 0.45 + gl * 0.5;
  }

  setLit(n: number) {
    this.litCount = n;
  }

  setPointer(x: number, y: number) {
    this.pointer.set(x, y);
  }

  /** Where the characters stand and what they are doing. */
  setCast(pose: CastPose, dt: number, time: number) {
    const step = Math.max(0, Math.abs(pose.s - this.lastS));
    this.lastS = pose.s;
    const moving = step / Math.max(dt, 0.001) > 0.2 || pose.walk > 0.4;
    this.walkEase += ((moving ? 1 : 0) - this.walkEase) * (1 - Math.pow(0.001, dt));
    const w = this.walkEase;
    const place = (c: Character, key: string, s: number, lat: number, lift: number, hopI: number) => {
      const p = roadAt(s);
      const right = new THREE.Vector3(-p.dir.z, 0, p.dir.x);
      const x = p.pos.x + right.x * lat;
      const z = p.pos.z + right.z * lat;
      const y = Math.max(groundHeight(x, z), p.y - 0.02) + lift;
      const target = Math.atan2(p.dir.x, p.dir.z);
      let d = target - this.yaw[key];
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw[key] += d * (1 - Math.pow(0.0005, dt));
      c.group.position.set(x, y + this.hop[hopI], z);
      c.group.rotation.y = this.yaw[key];
    };
    // the cast walks AWAY from camera along the road (−z), so the road direction is their facing; the camera chooses what to see
    place(this.bear, "bear", pose.s, 0.55, 0, 0);
    place(this.fox, "fox", pose.s - 0.4, -0.95, 0, 1);
    place(this.owl, "owl", pose.s + 0.9, 0.05, 2.6 + Math.sin(time * 2) * 0.1, 2);
    // chat: whoever speaks hops a little
    for (let i = 0; i < 3; i++) {
      const talk = pose.talking === i;
      this.hop[i] += ((talk ? Math.abs(Math.sin(time * 7)) * 0.06 : 0) - this.hop[i]) * (1 - Math.pow(0.0001, dt));
    }
    const ctx = { dt, time, step, walk: w, pointer: this.pointer, glow: this.look.glow, talking: false };
    this.bear.update({ ...ctx, talking: pose.talking === 0 });
    this.fox.update({ ...ctx, talking: pose.talking === 1 });
    this.owl.update({ ...ctx, talking: pose.talking === 2 });
    const mid = this.bear.group.position;
    this.focus.lerp(mid, 1 - Math.pow(0.0001, dt));
  }

  update(dt: number, t: number) {
    windTime.value = t;
    this.skyU.time.value = t;
    this.waterU.time.value = t;
    if (this.gatePortal) {
      this.gatePortal.uniforms.time.value = t;
      this.gatePortal.uniforms.amount.value = this.portalAmount;
    }
    this.gateLight.intensity = 26 + this.portalAmount * 400;
    // fire
    const fl = 1 + Math.sin(t * 13) * 0.1 + Math.sin(t * 7.3) * 0.08;
    this.fire.light.intensity = 16 * fl;
    this.fire.flames.forEach((f, i) => {
      f.scale.set((1.1 - i * 0.18) * (1 + Math.sin(t * 11 + i) * 0.08), (1.5 - i * 0.2) * fl, 1);
      f.position.y = 0.5 + i * 0.12 + Math.sin(t * 9 + i * 2) * 0.03;
    });
    // sparks
    const sp = this.sparks.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < sp.count; i++) {
      const age = (t * 0.45 + i / sp.count) % 1;
      sp.setXYZ(i, Math.sin(i * 12.9 + age * 3) * 0.3 * age, 0.7 + age * 3.2, Math.cos(i * 7.7 + age * 2) * 0.3 * age);
    }
    sp.needsUpdate = true;
    // smoke
    for (const s of this.smoke) {
      const k = (t * 0.12 + s.userData.i / this.smoke.length) % 1;
      const b = s.userData.base as THREE.Vector3;
      s.position.set(b.x + k * 1.6 + Math.sin(k * 6 + s.userData.i) * 0.3, b.y + k * 4.2, b.z + Math.sin(k * 4) * 0.4);
      s.scale.setScalar(0.8 + k * 3.2);
      (s.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI) * 0.22 * (0.5 + 0.5 * (1 - this.look.glow * 0.4));
    }
    // clouds
    for (const c of this.clouds) {
      c.position.x += dt * 1.4;
      if (c.position.x > 1100) c.position.x -= 2200;
    }
    // motes drift around the characters
    const mp = this.motes.geometry.attributes.position as THREE.BufferAttribute;
    const f = this.focus;
    for (let i = 0; i < mp.count; i++) {
      const bx = this.moteBase[i * 4];
      const by = this.moteBase[i * 4 + 1];
      const bz = this.moteBase[i * 4 + 2];
      const ph = this.moteBase[i * 4 + 3];
      mp.setXYZ(i, f.x + bx + Math.sin(t * 0.4 + ph) * 1.4, f.y + 0.4 + ((by + t * 0.18 * (0.4 + (ph % 1))) % 9), f.z + bz + Math.cos(t * 0.35 + ph) * 1.4);
    }
    mp.needsUpdate = true;
    // bubbles + stars orbit the cast
    const cr = this.camRight;
    const cb = this.camBack;
    for (const b of this.bubbles) {
      const ox = b.base.x + Math.sin(t * 0.6 + b.ph) * 0.2;
      const oy = b.base.y + Math.sin(t * 0.9 + b.ph) * 0.18;
      b.g.position.set(f.x + cr.x * ox + cb.x * b.base.z, f.y + oy, f.z + cr.z * ox + cb.z * b.base.z);
    }
    for (const s of this.stars) {
      const ox = s.base.x * 0.75 + Math.sin(t * 0.3 + s.ph) * 0.4;
      s.s.position.set(f.x + cr.x * ox + cb.x * (s.base.z * 0.6 - 1), f.y + s.base.y * 0.8 + Math.sin(t * 0.7 + s.ph) * 0.3, f.z + cr.z * ox + cb.z * (s.base.z * 0.6 - 1));
      s.s.material.rotation = t * 0.3 + s.ph;
      s.s.scale.setScalar(0.2 + Math.sin(t * 2 + s.ph) * 0.07);
    }
    // keep the shadow camera on the characters
    this.sun.target.position.copy(f);
    this.sun.position.copy(f).addScaledVector(this.sunDir, 70);
    this.sun.shadow.camera.updateMatrixWorld();
  }

  setBubblesVisible(v: boolean) {
    this.bubbles.forEach((b) => (b.g.visible = v));
    this.stars.forEach((b) => (b.s.visible = v));
  }

  dispose() {
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
  }
}
