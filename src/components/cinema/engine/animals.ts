import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildBear as buildBearPlush, buildFox as buildFoxPlush, buildButterfly as buildButterflyPlush, type Character, type CastContext } from "./characters";

/* Natural animals for the landing scene. The old plush characters stay in characters.ts as a fallback if a model fails to load.
   Credits for the fox and bear models: public/cinema/CREDITS.txt. */

const clamp = THREE.MathUtils.clamp;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/* ───────────────────────────── FOX — a rigged, animated model ───────────────────────────── */
export function buildFox(): Character {
  const root = new THREE.Group();
  const holder = new THREE.Group();
  root.add(holder);
  let mixer: THREE.AnimationMixer | null = null;
  let walk: THREE.AnimationAction | null = null;
  let idle: THREE.AnimationAction | null = null;
  const look = new THREE.Vector2();

  new GLTFLoader().load(
    "/cinema/models/fox.glb",
    (gltf) => {
      const model = gltf.scene;
      model.scale.setScalar(0.02); // the file is in centimetres
      model.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.frustumCulled = false;
          // the file ships without normals, which makes it look faceted; weld the vertices and shade it smooth
          const g = mesh.geometry as THREE.BufferGeometry;
          g.deleteAttribute("normal");
          const welded = mergeVertices(g, 1e-3);
          welded.computeVertexNormals();
          mesh.geometry = welded;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.flatShading = false;
          mat.roughness = 0.92;
          mat.metalness = 0;
          mat.needsUpdate = true;
        }
      });
      // fur: shells over the skinned mesh, sharing its skeleton so they move with every bone
      const skinned: THREE.SkinnedMesh[] = [];
      model.traverse((o) => {
        if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(o as THREE.SkinnedMesh);
      });
      for (const sm of skinned) {
        const map = (sm.material as THREE.MeshStandardMaterial).map;
        for (let i = 1; i <= 12; i++) {
          const shell = new THREE.SkinnedMesh(sm.geometry, furMaterial(i / 12, 1.3, 3.0, map));
          shell.bind(sm.skeleton, sm.bindMatrix);
          shell.position.copy(sm.position);
          shell.quaternion.copy(sm.quaternion);
          shell.scale.copy(sm.scale);
          shell.frustumCulled = false;
          sm.parent?.add(shell);
        }
      }
      holder.add(model);
      mixer = new THREE.AnimationMixer(model);
      const by = (n: string) => gltf.animations.find((a) => a.name === n);
      const w = by("Walk");
      const i = by("Survey");
      if (w) (walk = mixer.clipAction(w)).play();
      if (i) (idle = mixer.clipAction(i)).play();
    },
    undefined,
    () => holder.add(buildFoxPlush().group),
  );

  return {
    group: root,
    update(c: CastContext) {
      if (!mixer) return;
      const speed = c.step / Math.max(c.dt, 1e-3);
      walk?.setEffectiveWeight(c.walk);
      idle?.setEffectiveWeight(1 - c.walk);
      // match the stride to the ground speed so the paws don't skate
      walk?.setEffectiveTimeScale(clamp(speed / 1.3, 0.5, 2.4));
      mixer.update(c.dt);
      look.lerp(c.pointer, 1 - Math.pow(0.003, c.dt));
      holder.rotation.y = clamp(look.x * 0.12, -0.2, 0.2);
    },
  };
}

/* ───────────────────────────── BEAR — a model made smooth, rigged and furred ───────────────────────────── */

interface Mesh3 {
  pos: number[];
  col: number[];
  idx: number[];
}

/** Read any indexed/non-indexed geometry into shared-vertex arrays (colours averaged where faces meet). */
function weld(geo: THREE.BufferGeometry, sample?: (u: number, v: number) => [number, number, number]): Mesh3 {
  const p = geo.attributes.position;
  const c = geo.attributes.color;
  const uv = geo.attributes.uv;
  const idxAttr = geo.index;
  const key = (i: number) => `${Math.round(p.getX(i) * 1e3)}_${Math.round(p.getY(i) * 1e3)}_${Math.round(p.getZ(i) * 1e3)}`;
  const map = new Map<string, number>();
  const pos: number[] = [];
  const col: number[] = [];
  const cnt: number[] = [];
  const remap = new Int32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const k = key(i);
    let j = map.get(k);
    if (j === undefined) {
      j = pos.length / 3;
      map.set(k, j);
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      col.push(0, 0, 0);
      cnt.push(0);
    }
    remap[i] = j;
    if (sample && uv) {
      const rgb = sample(uv.getX(i), uv.getY(i));
      col[j * 3] += rgb[0];
      col[j * 3 + 1] += rgb[1];
      col[j * 3 + 2] += rgb[2];
    } else if (c) {
      col[j * 3] += c.getX(i);
      col[j * 3 + 1] += c.getY(i);
      col[j * 3 + 2] += c.getZ(i);
    } else {
      col[j * 3] += 1;
      col[j * 3 + 1] += 1;
      col[j * 3 + 2] += 1;
    }
    cnt[j]++;
  }
  for (let j = 0; j < cnt.length; j++) {
    col[j * 3] /= cnt[j];
    col[j * 3 + 1] /= cnt[j];
    col[j * 3 + 2] /= cnt[j];
  }
  const idx: number[] = [];
  const n = idxAttr ? idxAttr.count : p.count;
  for (let i = 0; i < n; i++) idx.push(remap[idxAttr ? idxAttr.getX(i) : i]);
  return { pos, col, idx };
}

function subdivide(m: Mesh3): Mesh3 {
  const pos = m.pos.slice();
  const col = m.col.slice();
  const mids = new Map<string, number>();
  const mid = (a: number, b: number) => {
    const k = a < b ? `${a}_${b}` : `${b}_${a}`;
    let j = mids.get(k);
    if (j === undefined) {
      j = pos.length / 3;
      mids.set(k, j);
      for (let d = 0; d < 3; d++) {
        pos.push((pos[a * 3 + d] + pos[b * 3 + d]) / 2);
        col.push((col[a * 3 + d] + col[b * 3 + d]) / 2);
      }
    }
    return j;
  };
  const idx: number[] = [];
  for (let i = 0; i < m.idx.length; i += 3) {
    const a = m.idx[i];
    const b = m.idx[i + 1];
    const c = m.idx[i + 2];
    const ab = mid(a, b);
    const bc = mid(b, c);
    const ca = mid(c, a);
    idx.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
  }
  return { pos, col, idx };
}

/** Taubin smoothing (shrink, then inflate) — rounds the facets without making the animal smaller. */
function relax(m: Mesh3, passes: number) {
  const n = m.pos.length / 3;
  const nb: Set<number>[] = Array.from({ length: n }, () => new Set<number>());
  for (let i = 0; i < m.idx.length; i += 3) {
    const t = [m.idx[i], m.idx[i + 1], m.idx[i + 2]];
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (a !== b) nb[t[a]].add(t[b]);
  }
  const tmp = new Float32Array(m.pos.length);
  const step = (k: number) => {
    for (let i = 0; i < n; i++) {
      const s = nb[i];
      if (!s.size) {
        for (let d = 0; d < 3; d++) tmp[i * 3 + d] = m.pos[i * 3 + d];
        continue;
      }
      for (let d = 0; d < 3; d++) {
        let sum = 0;
        s.forEach((j) => (sum += m.pos[j * 3 + d]));
        tmp[i * 3 + d] = m.pos[i * 3 + d] + k * (sum / s.size - m.pos[i * 3 + d]);
      }
    }
    for (let i = 0; i < tmp.length; i++) m.pos[i] = tmp[i];
  };
  for (let p = 0; p < passes; p++) {
    step(0.5);
    step(-0.53);
  }
}

const FUR_VERT = `
  uniform float uH; uniform float uLen;
  varying vec3 vRest;
`;

function furMaterial(h: number, len: number, density: number, map?: THREE.Texture | null): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial(map ? { map, roughness: 0.85, metalness: 0 } : { vertexColors: true, roughness: 0.82, metalness: 0, side: THREE.FrontSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uH = { value: h };
    sh.uniforms.uLen = { value: len };
    sh.uniforms.uDensity = { value: density };
    sh.uniforms.uRoot = { value: map ? 0.78 : 0.4 };
    sh.vertexShader = FUR_VERT + sh.vertexShader.replace(
      "#include <skinning_vertex>",
      `#include <skinning_vertex>
       transformed += normalize(objectNormal) * uH * uLen;
       transformed.y -= uH * uH * uLen * 0.45;
       vRest = position;`,
    );
    sh.fragmentShader =
      `uniform float uH; uniform float uDensity; uniform float uRoot; varying vec3 vRest;
       float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
      ` +
      sh.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         if (uH > 0.001) {
           vec3 q = (mat3(0.8, 0.6, 0.0, -0.48, 0.64, 0.6, 0.36, -0.48, 0.8) * vRest) * uDensity;
           vec3 cell = floor(q);
           float r = hash13(cell);
           float reach = 0.45 + r * 0.55;
           vec3 f = fract(q) - 0.5;
           float d = length(f);
           if (uH > reach || d > 0.5 * (1.0 - uH / reach) + 0.04) discard;
           diffuseColor.rgb *= mix(uRoot, 1.08, uH) * (0.9 + r * 0.2);
         }`,
      );
  };
  return mat;
}

interface Rig {
  group: THREE.Group;
  update(c: CastContext): void;
}

function furryBear(src: THREE.BufferGeometry, sample?: (u: number, v: number) => [number, number, number]): Rig {
  // 1 · smooth the faceted model: weld → subdivide twice → relax
  let m = weld(src, sample);
  m = subdivide(m);
  relax(m, 2);
  m = subdivide(m);
  relax(m, 3);

  // 2 · stand it on the ground, nose toward +z, ~2.4 m long
  const P = m.pos;
  const n = P.length / 3;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, P[i * 3]); maxX = Math.max(maxX, P[i * 3]);
    minY = Math.min(minY, P[i * 3 + 1]); maxY = Math.max(maxY, P[i * 3 + 1]);
    minZ = Math.min(minZ, P[i * 3 + 2]); maxZ = Math.max(maxZ, P[i * 3 + 2]);
  }
  // the pale muzzle marks the front
  let lz = 0, lc = 0;
  for (let i = 0; i < n; i++) {
    const lum = (m.col[i * 3] + m.col[i * 3 + 1] + m.col[i * 3 + 2]) / 3;
    if (lum > 0.55) {
      lz += P[i * 3 + 2];
      lc++;
    }
  }
  const front = lc ? (lz / lc > (minZ + maxZ) / 2 ? 1 : -1) : 1;
  const scale = 2.4 / (maxZ - minZ);
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  for (let i = 0; i < n; i++) {
    P[i * 3] = (P[i * 3] - cx) * scale * front;
    P[i * 3 + 1] = (P[i * 3 + 1] - minY) * scale;
    P[i * 3 + 2] = (P[i * 3 + 2] - cz) * scale * front;
  }
  if (front < 0) for (let i = 0; i < m.idx.length; i += 3) [m.idx[i + 1], m.idx[i + 2]] = [m.idx[i + 2], m.idx[i + 1]];
  const H = (maxY - minY) * scale;
  const L = 2.4;
  const W = (maxX - minX) * scale;

  // 3 · a little skeleton: hips, head, four legs — weights from where each vertex sits
  const legTop = H * 0.5;
  const legX = W * 0.2;
  const legZ = L * 0.26;
  const pivots = {
    fl: new THREE.Vector3(-legX, legTop, legZ),
    fr: new THREE.Vector3(legX, legTop, legZ),
    bl: new THREE.Vector3(-legX, legTop, -legZ),
    br: new THREE.Vector3(legX, legTop, -legZ),
  };
  const neck = new THREE.Vector3(0, H * 0.78, L * 0.24);
  const hips = new THREE.Bone();
  const head = new THREE.Bone();
  head.position.copy(neck);
  const legs = { fl: new THREE.Bone(), fr: new THREE.Bone(), bl: new THREE.Bone(), br: new THREE.Bone() };
  hips.add(head);
  (Object.keys(legs) as (keyof typeof legs)[]).forEach((k) => {
    legs[k].position.copy(pivots[k]);
    hips.add(legs[k]);
  });
  const bones = [hips, head, legs.fl, legs.fr, legs.bl, legs.br];
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const x = P[i * 3];
    const y = P[i * 3 + 1];
    const z = P[i * 3 + 2];
    let wHead = smooth(neck.z - 0.05 * L, neck.z + 0.14 * L, z) * smooth(H * 0.45, H * 0.65, y);
    let wLeg = 0;
    let leg = 2;
    if (Math.abs(x) > W * 0.1 && y < legTop) {
      wLeg = smooth(legTop, legTop * 0.55, y);
      leg = x < 0 ? (z > 0 ? 2 : 4) : z > 0 ? 3 : 5;
    }
    wHead *= 1 - wLeg;
    skinIndex[i * 4] = 0;
    skinWeight[i * 4] = 1 - wHead - wLeg;
    skinIndex[i * 4 + 1] = 1;
    skinWeight[i * 4 + 1] = wHead;
    skinIndex[i * 4 + 2] = leg;
    skinWeight[i * 4 + 2] = wLeg;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(m.col, 3));
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeight, 4));
  geo.setIndex(m.idx);
  geo.computeVertexNormals();

  const group = new THREE.Group();
  const baseMat = furMaterial(0, 0, 1);
  const base = new THREE.SkinnedMesh(geo, baseMat);
  base.add(hips);
  base.frustumCulled = false;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
  hips.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  base.bind(skeleton);

  // 4 · fur: shells, each a little further out, with strands cut out of them
  const SHELLS = 18;
  const FUR = 0.05;
  for (let s = 1; s <= SHELLS; s++) {
    const shell = new THREE.SkinnedMesh(geo, furMaterial(s / SHELLS, FUR, 70));
    shell.frustumCulled = false;
    group.add(shell);
    shell.bind(skeleton, base.bindMatrix);
  }

  let phase = 0;
  const look = new THREE.Vector2();
  return {
    group,
    update(c: CastContext) {
      const w = c.walk;
      phase += (c.step / 1.7) * Math.PI * 2;
      const sw = Math.sin(phase) * 0.55 * w;
      legs.fl.rotation.x = sw;
      legs.br.rotation.x = sw;
      legs.fr.rotation.x = -sw;
      legs.bl.rotation.x = -sw;
      // weight shifts side to side, shoulders roll, breathing when standing
      hips.position.y = Math.abs(Math.sin(phase)) * 0.035 * w + Math.sin(c.time * 1.5) * 0.006 * (1 - w);
      hips.rotation.z = Math.sin(phase) * 0.025 * w;
      hips.rotation.x = Math.sin(phase * 2) * 0.012 * w;
      look.lerp(c.pointer, 1 - Math.pow(0.003, c.dt));
      head.rotation.y = clamp(look.x * 0.45, -0.55, 0.55);
      head.rotation.x = -look.y * 0.2 + Math.sin(phase * 2) * 0.03 * w + (c.talking ? Math.sin(c.time * 9) * 0.05 : 0);
      head.rotation.z = Math.sin(c.time * 0.9) * 0.02;
    },
  };
}

/** Colour lookup from the model's palette texture (its colours live in the texture, not on the vertices). */
function paletteSampler(map: THREE.Texture | null): ((u: number, v: number) => [number, number, number]) | undefined {
  const img = map?.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!img || !img.width) return undefined;
  const cv = document.createElement("canvas");
  cv.width = img.width;
  cv.height = img.height;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, cv.width, cv.height).data; // read once, not per vertex
  const col = new THREE.Color();
  return (u, v) => {
    const x = clamp(Math.floor((u - Math.floor(u)) * cv.width), 0, cv.width - 1);
    const y = clamp(Math.floor((v - Math.floor(v)) * cv.height), 0, cv.height - 1);
    const o = (y * cv.width + x) * 4;
    const d = [px[o], px[o + 1], px[o + 2]];
    col.setRGB(d[0] / 255, d[1] / 255, d[2] / 255, THREE.SRGBColorSpace);
    return [col.r, col.g, col.b];
  };
}

export function buildBear(): Character {
  const root = new THREE.Group();
  let rig: Rig | null = null;
  new GLTFLoader().load(
    "/cinema/models/blackbear.glb",
    (gltf) => {
      let geo: THREE.BufferGeometry | null = null;
      let map: THREE.Texture | null = null;
      gltf.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && !geo) {
          geo = mesh.geometry;
          map = (mesh.material as THREE.MeshStandardMaterial).map;
        }
      });
      if (!geo) return void root.add(buildBearPlush().group);
      rig = furryBear(geo, paletteSampler(map));
      root.add(rig.group);
    },
    undefined,
    () => root.add(buildBearPlush().group),
  );
  return {
    group: root,
    update(c: CastContext) {
      rig?.update(c);
    },
  };
}

/* ───────────────────────────── MONARCH — painted wings that actually flap ───────────────────────────── */
function monarchWingTexture(): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  // left wing pair seen from above, body at the left edge: forewing on top, hindwing below
  const outline = new Path2D();
  outline.moveTo(0, 215);
  outline.bezierCurveTo(90, 120, 270, 40, 490, 30);
  outline.bezierCurveTo(500, 120, 470, 200, 400, 255);
  outline.bezierCurveTo(380, 300, 360, 330, 340, 380);
  outline.bezierCurveTo(300, 470, 190, 480, 120, 420);
  outline.bezierCurveTo(60, 380, 20, 330, 0, 290);
  outline.closePath();
  ctx.save();
  ctx.clip(outline);
  const g = ctx.createRadialGradient(40, 250, 10, 40, 250, 520);
  g.addColorStop(0, "#d4600f");
  g.addColorStop(0.55, "#ee8a1e");
  g.addColorStop(1, "#f7a935");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // veins radiate from the shoulder
  ctx.strokeStyle = "#17100b";
  ctx.lineCap = "round";
  for (let i = 0; i < 13; i++) {
    const t = i / 12;
    const tx = 120 + t * 380;
    const ty = i < 7 ? 45 + t * 260 : 250 + (t - 0.5) * 460;
    ctx.lineWidth = 3.4 - t * 1.2;
    ctx.beginPath();
    ctx.moveTo(8, 255);
    ctx.quadraticCurveTo((8 + tx) / 2, (255 + ty) / 2 - 12, tx, ty);
    ctx.stroke();
  }
  // the broad black border with a row of white spots, as on a monarch
  ctx.lineJoin = "round";
  ctx.lineWidth = 46;
  ctx.stroke(outline);
  ctx.restore();
  ctx.fillStyle = "#fbf6ea";
  for (let i = 0; i < 24; i++) {
    const t = i / 23;
    const a = t * Math.PI * 1.18 + 0.15;
    const px = 430 - Math.cos(a) * 250 + t * 18;
    const py = 120 + Math.sin(a) * 250 * 0.95 - 20;
    ctx.beginPath();
    ctx.arc(px, py, 3.4 + (1 - Math.abs(t - 0.5) * 2) * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function buildButterfly(): Character {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const ink = new THREE.MeshStandardMaterial({ color: "#1a120c", roughness: 0.7 });
  const abdomen = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.17, 6, 12), ink);
  abdomen.rotation.x = Math.PI / 2;
  abdomen.position.z = -0.1;
  const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 12), ink);
  thorax.scale.set(1, 0.95, 1.5);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 10), ink);
  head.position.z = 0.055;
  body.add(abdomen, thorax, head);
  for (const s of [-1, 1]) {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0022, 0.12, 5), ink);
    ant.position.set(s * 0.02, 0.03, 0.1);
    ant.rotation.set(1.15, 0, -s * 0.35);
    body.add(ant);
  }

  const tex = monarchWingTexture();
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, emissive: new THREE.Color("#7a3008"), emissiveIntensity: 0.12 });
  const span = 0.36;
  const wingGeo = new THREE.PlaneGeometry(span, span);
  wingGeo.rotateX(-Math.PI / 2);
  wingGeo.translate(span / 2, 0, 0);
  const wings: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(s * 0.012, 0.012, 0.0);
    const w = new THREE.Mesh(wingGeo, mat);
    w.scale.x = s;
    w.castShadow = true;
    hinge.add(w);
    body.add(hinge);
    wings.push(hinge as unknown as THREE.Mesh);
  }

  return {
    group: root,
    update(c: CastContext) {
      // quick, slightly irregular wingbeats with gliding pauses
      const beat = Math.sin(c.time * 15 + Math.sin(c.time * 1.7) * 2);
      const glide = 0.5 + 0.5 * Math.sin(c.time * 0.8);
      const flap = glide > 0.25 ? beat : beat * 0.2 + 0.8;
      const ang = 0.28 + flap * 0.85;
      wings[0].rotation.z = -ang;
      wings[1].rotation.z = ang;
      body.rotation.x = 0.35 + Math.sin(c.time * 2.1) * 0.1;
      body.rotation.z = Math.sin(c.time * 1.3) * 0.12;
      body.position.y = beat * 0.012;
      body.scale.setScalar(1.6);
    },
  };
}

export { buildButterflyPlush };
