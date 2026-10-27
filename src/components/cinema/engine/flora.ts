import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { texUniform, TEX } from "./materials";

/* Natural-looking vegetation without any 3D model files: trees are a bark-textured trunk plus a few dozen leaf-cluster cards
   whose normals point away from the crown's centre (so a whole crown shades like one soft volume), darker inside, lighter
   at the tips. Leaves, needles and petals are painted once onto a canvas. */

type Rnd = () => number;

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
}

function toTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function leafPath(ctx: CanvasRenderingContext2D, len: number, wid: number) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.25, -wid, len * 0.7, -wid * 0.8, len, 0);
  ctx.bezierCurveTo(len * 0.7, wid * 0.8, len * 0.25, wid, 0, 0);
  ctx.closePath();
}

/** A spray of broadleaf leaves on short twigs, on a transparent ground. */
export function leafTexture(rnd: Rnd): THREE.CanvasTexture {
  const S = 512;
  const [c, ctx] = canvas(S, S);
  const cx = S / 2;
  const cy = S / 2;
  const leaves = 260;
  for (let i = 0; i < leaves; i++) {
    // denser toward the middle so the silhouette is ragged, not round
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * S * 0.4;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    const ang = a + (rnd() - 0.5) * 1.6;
    const len = 30 + rnd() * 26;
    const wid = len * (0.28 + rnd() * 0.12);
    const light = 0.2 + rnd() * 0.22 + (1 - r / (S * 0.4)) * 0.04;
    const hue = 88 + rnd() * 34;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    leafPath(ctx, len, wid);
    const g = ctx.createLinearGradient(0, -wid, 0, wid);
    g.addColorStop(0, `hsl(${hue}, 52%, ${(light + 0.1) * 100}%)`);
    g.addColorStop(1, `hsl(${hue + 6}, 48%, ${(light - 0.03) * 100}%)`);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = `hsla(${hue}, 40%, ${(light - 0.08) * 100}%, 0.7)`;
    ctx.stroke();
    // midrib
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len * 0.92, 0);
    ctx.strokeStyle = `hsla(${hue - 8}, 40%, ${(light + 0.16) * 100}%, 0.55)`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }
  return toTexture(c);
}

/** A drooping conifer branch: a woody centre line with needles along both sides. */
export function pineTexture(rnd: Rnd): THREE.CanvasTexture {
  const W = 512;
  const H = 256;
  const [c, ctx] = canvas(W, H);
  const cy = H / 2;
  // woody stem
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(W * 0.96, cy);
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#4b3422";
  ctx.stroke();
  const needles = 520;
  for (let i = 0; i < needles; i++) {
    const t = Math.pow(rnd(), 0.8);
    const x = 12 + t * (W * 0.94);
    const side = rnd() < 0.5 ? -1 : 1;
    const reach = (1 - t * 0.55) * (H * 0.46) * (0.45 + rnd() * 0.55);
    const ang = side * (0.45 + rnd() * 0.75);
    const lx = x + Math.cos(ang) * reach * 0.7 + 12;
    const ly = cy + Math.sin(ang) * reach;
    const hue = 112 + rnd() * 20;
    const light = 18 + rnd() * 20 + t * 4;
    ctx.beginPath();
    ctx.moveTo(x, cy);
    ctx.lineTo(lx, ly);
    ctx.lineWidth = 2.2 + rnd() * 1.4;
    ctx.lineCap = "round";
    ctx.strokeStyle = `hsl(${hue}, 42%, ${light}%)`;
    ctx.stroke();
  }
  return toTexture(c);
}

/** A small five-petal wildflower seen from above, on transparent. */
export function flowerTexture(): THREE.CanvasTexture {
  const S = 128;
  const [c, ctx] = canvas(S, S);
  ctx.translate(S / 2, S / 2);
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.rotate((i / 6) * Math.PI * 2);
    ctx.beginPath();
    ctx.ellipse(0, -S * 0.27, S * 0.13, S * 0.24, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, S * 0.1, 0, Math.PI * 2);
  ctx.fillStyle = "#e3b23a";
  ctx.fill();
  return toTexture(c);
}

/* ───────────────────────────── geometry helpers ───────────────────────────── */

/** A card in the XY plane, centred, `size` wide and `size * aspect` tall, with a given vertex colour and normal. */
function card(size: number, aspect: number, pos: THREE.Vector3, rot: THREE.Euler, normal: THREE.Vector3, shade: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(size, size * aspect);
  const m = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(rot), new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m);
  const n = g.attributes.normal;
  const count = n.count;
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    n.setXYZ(i, normal.x, normal.y, normal.z);
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = shade;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function trunkGeo(h: number, r0: number, r1: number, rnd: Rnd, sides = 9, uvRepeat = 3): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r1, r0, h, sides, 6, true);
  g.translate(0, h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const k = 1 + (Math.sin(y * 3.1 + p.getX(i) * 9) * 0.04 + (rnd() - 0.5) * 0.02);
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
  }
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * uvRepeat);
  g.computeVertexNormals();
  return g;
}

export interface TreeParts {
  trunk: THREE.BufferGeometry;
  crown: THREE.BufferGeometry;
}

/** A broadleaf tree about 9 m tall with a ~7 m crown. */
export function buildBroadleaf(rnd: Rnd): TreeParts {
  const parts: THREE.BufferGeometry[] = [trunkGeo(4.6, 0.34, 0.12, rnd, 10, 2.4)];
  // a few limbs reaching into the crown
  const limbTargets: THREE.Vector3[] = [];
  const crownC = new THREE.Vector3(0, 6.4, 0);
  const crownR = new THREE.Vector3(3.4, 2.7, 3.4);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rnd();
    const tgt = new THREE.Vector3(Math.cos(a) * 2.1, 5.7 + rnd() * 1.4, Math.sin(a) * 2.1);
    limbTargets.push(tgt);
    const from = new THREE.Vector3(0, 3.4 + rnd() * 1.0, 0);
    const dir = tgt.clone().sub(from);
    const len = dir.length();
    const limb = trunkGeo(len, 0.1, 0.03, rnd, 6, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    limb.applyMatrix4(new THREE.Matrix4().compose(from, q, new THREE.Vector3(1, 1, 1)));
    parts.push(limb);
  }
  const trunk = mergeGeometries(parts)!;

  const cards: THREE.BufferGeometry[] = [];
  const N = 84;
  for (let i = 0; i < N; i++) {
    // points inside an ellipsoid, a little more toward the shell
    const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
    if (v.lengthSq() > 1) {
      i--;
      continue;
    }
    v.multiplyScalar(0.55 + 0.45 * Math.cbrt(rnd()) / Math.max(v.length(), 0.001) * v.length());
    const pos = new THREE.Vector3(v.x * crownR.x, v.y * crownR.y, v.z * crownR.z).add(crownC);
    const out = pos.clone().sub(crownC).divide(crownR).normalize();
    // normals lean up a little: crowns catch light from the sky
    out.y += 0.25;
    out.normalize();
    const r = pos.clone().sub(crownC).divide(crownR).length();
    const shade = 0.42 + 0.62 * Math.min(1, r) + (rnd() - 0.5) * 0.12 + (out.y > 0.4 ? 0.06 : 0);
    const rot = new THREE.Euler(rnd() * 3.14, rnd() * 3.14, rnd() * 3.14);
    cards.push(card(2.1 + rnd() * 0.9, 1, pos, rot, out, shade));
  }
  return { trunk, crown: mergeGeometries(cards)! };
}

/** A conifer about 11 m tall. */
export function buildConifer(rnd: Rnd): TreeParts {
  const trunk = trunkGeo(11.5, 0.3, 0.04, rnd, 9, 5);
  const cards: THREE.BufferGeometry[] = [];
  const levels = 20;
  for (let l = 0; l < levels; l++) {
    const t = l / (levels - 1);
    const y = 1.6 + t * 9.4;
    const reach = (1 - Math.pow(t, 0.92)) * 3.0 + 0.4;
    const n = Math.max(4, Math.round(7 - t * 3));
    const off = rnd() * 6.28;
    for (let k = 0; k < n; k++) {
      const a = off + (k / n) * Math.PI * 2 + (rnd() - 0.5) * 0.4;
      const droop = -0.28 - (1 - t) * 0.22 + (rnd() - 0.5) * 0.12;
      const len = reach * (0.95 + rnd() * 0.3);
      // a branch card: lies along the radial direction, sloping down toward its tip
      const g = new THREE.PlaneGeometry(len, len * 0.55);
      g.translate(len / 2, 0, 0);
      g.rotateX(-Math.PI / 2 + 0.05); // lay flat (XZ plane)
      g.rotateZ(droop);
      g.rotateY(-a);
      g.translate(0, y, 0);
      // normals fan out and up
      const nrm = new THREE.Vector3(Math.cos(a) * 0.55, 0.85, Math.sin(a) * 0.55).normalize();
      const nAttr = g.attributes.normal;
      const col = new Float32Array(nAttr.count * 3);
      const shade = 0.5 + 0.5 * (0.35 + 0.65 * t) + (rnd() - 0.5) * 0.12;
      for (let i = 0; i < nAttr.count; i++) {
        nAttr.setXYZ(i, nrm.x, nrm.y, nrm.z);
        col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = shade;
      }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      cards.push(g);
    }
  }
  return { trunk, crown: mergeGeometries(cards)! };
}

/** A tuft of fine grass blades — each tapers to a point and leans. */
export function buildGrassTuft(rnd: Rnd): THREE.BufferGeometry {
  const blades: THREE.BufferGeometry[] = [];
  const count = 9;
  for (let b = 0; b < count; b++) {
    const h = 0.26 + rnd() * 0.26;
    const w = 0.012 + rnd() * 0.008;
    const segs = 4;
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const lean = (rnd() - 0.5) * 0.5;
    const bend = 0.12 + rnd() * 0.25;
    const a = rnd() * Math.PI * 2;
    const ox = (rnd() - 0.5) * 0.08;
    const oz = (rnd() - 0.5) * 0.08;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const y = t * h;
      const x = lean * t * h + bend * t * t * h;
      const ww = w * (1 - t * 0.92);
      for (const side of [-1, 1]) {
        const lx = x;
        const lz = side * ww;
        pos.push(ox + lx * ca - lz * sa, y, oz + lx * sa + lz * ca);
        const c = new THREE.Color("#2c4a18").lerp(new THREE.Color("#a8b862"), Math.pow(t, 0.9));
        col.push(c.r, c.g, c.b);
      }
      if (s < segs) {
        const i0 = s * 2;
        idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // blades shade like the ground they stand on: normals point up, which keeps tufts from flickering dark
    const n = g.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    blades.push(g);
  }
  return mergeGeometries(blades)!;
}

/** A thin stem with a flat flower head tilted toward the sky. */
export function buildWildflower(rnd: Rnd): { stem: THREE.BufferGeometry; head: THREE.BufferGeometry } {
  const h = 0.24 + rnd() * 0.12;
  const stem = new THREE.CylinderGeometry(0.004, 0.006, h, 4);
  stem.translate(0, h / 2, 0);
  const col = new Float32Array(stem.attributes.position.count * 3);
  for (let i = 0; i < col.length; i += 3) {
    col[i] = 0.2;
    col[i + 1] = 0.36;
    col[i + 2] = 0.12;
  }
  stem.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const head = new THREE.PlaneGeometry(0.075, 0.075);
  head.rotateX(-Math.PI / 2 + 0.35);
  head.translate(0, h, 0);
  return { stem, head };
}

/* ───────────────────────────── materials ───────────────────────────── */

export interface FloraTextures {
  leaf: THREE.CanvasTexture;
  pine: THREE.CanvasTexture;
  flower: THREE.CanvasTexture;
}

export function makeFloraTextures(rnd: Rnd): FloraTextures {
  return { leaf: leafTexture(rnd), pine: pineTexture(rnd), flower: flowerTexture() };
}

/** Bark photograph on a standard material, via a sampler that swaps in when loaded. */
export function barkMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  const U = { tBark: texUniform(TEX.bark) };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = "uniform sampler2D tBark;\n" + sh.fragmentShader.replace("#include <map_fragment>", "diffuseColor.rgb = texture2D(tBark, vMapUv).rgb * 1.25;");
  };
  // vMapUv is only declared when a map is present; a 1×1 white map turns that on without changing anything
  const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  white.needsUpdate = true;
  mat.map = white;
  return mat;
}

export function foliageMaterial(map: THREE.Texture): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ map, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.82, metalness: 0 });
  mat.alphaToCoverage = true;
  return mat;
}
