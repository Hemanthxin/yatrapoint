import * as THREE from "three";

/* ───────────────────────── deterministic value noise ───────────────────────── */
function hash2(ix: number, iy: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const smooth = (t: number) => t * t * (3 - 2 * t);
export function noise2(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export function fbm(x: number, y: number, oct = 4): number {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    v += amp * noise2(x * f, y * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return v;
}
export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ───────────────────────── the road everything hangs off ───────────────────────── */
// x, z control points. The story walks -z: hillside steps → valley → gate → meadow → camp.
const ROAD_XZ: [number, number][] = [
  [0, 8],
  [3, -14],
  [9, -42],
  [2, -74],
  [-7, -106],
  [-3, -138],
  [6, -166],
  [26, -192],
  [54, -216],
  [86, -238],
  [118, -262],
  [138, -292],
  [132, -326],
  [118, -352],
];
export const roadCurve = new THREE.CatmullRomCurve3(
  ROAD_XZ.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  false,
  "catmullrom",
  0.5,
);
export const ROAD_LEN = roadCurve.getLength();

/** Road elevation (m) at distance s along the road. Opens with a climb so the first steps rise out of the grass. */
export function roadY(s: number): number {
  return 7.4 * smoothstep(0, 32, s) + 3.8 * Math.sin(s / 58 + 0.4) * smoothstep(20, 70, s) + 2.2 * Math.sin(s / 24 + 1.2) * smoothstep(20, 70, s);
}

// Dense lookup table so terrain generation and tree placement can ask "how far from the road am I?" cheaply.
const SAMPLES = 700;
export interface RoadSample {
  x: number;
  z: number;
  s: number;
  y: number;
}
export const roadSamples: RoadSample[] = [];
for (let i = 0; i <= SAMPLES; i++) {
  const u = i / SAMPLES;
  const p = roadCurve.getPointAt(u);
  const s = u * ROAD_LEN;
  roadSamples.push({ x: p.x, z: p.z, s, y: roadY(s) });
}

// Spatial hash: 12 m cells → only a handful of samples to test per query.
const CELL = 12;
const grid = new Map<string, number[]>();
roadSamples.forEach((p, i) => {
  const k = `${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`;
  (grid.get(k) ?? grid.set(k, []).get(k)!).push(i);
});

export function nearestRoad(x: number, z: number): { d: number; y: number; s: number } {
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  let best = Infinity;
  let bi = -1;
  for (let r = 0; r <= 6 && bi < 0; r++) {
    for (let gx = cx - r; gx <= cx + r; gx++) {
      for (let gz = cz - r; gz <= cz + r; gz++) {
        if (r > 0 && Math.abs(gx - cx) !== r && Math.abs(gz - cz) !== r) continue;
        const arr = grid.get(`${gx},${gz}`);
        if (!arr) continue;
        for (const i of arr) {
          const p = roadSamples[i];
          const dd = (p.x - x) ** 2 + (p.z - z) ** 2;
          if (dd < best) {
            best = dd;
            bi = i;
          }
        }
      }
    }
  }
  if (bi < 0) return { d: 999, y: 0, s: 0 };
  const p = roadSamples[bi];
  return { d: Math.sqrt(best), y: p.y, s: p.s };
}

/** Position + heading on the road at distance s. */
export function roadAt(s: number): { pos: THREE.Vector3; dir: THREE.Vector3; y: number } {
  const u = Math.min(1, Math.max(0, s / ROAD_LEN));
  const pos = roadCurve.getPointAt(u);
  const dir = roadCurve.getTangentAt(u);
  const y = roadY(Math.min(Math.max(s, 0), ROAD_LEN));
  pos.y = y;
  dir.y = 0;
  dir.normalize();
  return { pos, dir, y };
}

/* ───────────────────────── landscape ───────────────────────── */
export const WATER_Y = -3.2;
const LAKE = { x: -92, z: -26, rx: 46, rz: 62 };
const MOUNT_C = { x: 70, z: -250 };

function rawHeight(x: number, z: number): number {
  const hills = (fbm(x * 0.0065, z * 0.0065, 4) - 0.35) * 46 + (fbm(x * 0.022 + 9, z * 0.022 + 3, 3) - 0.5) * 7;
  const lakeMask = Math.exp(-(((x - LAKE.x) / LAKE.rx) ** 2 + ((z - LAKE.z) / LAKE.rz) ** 2));
  const r = Math.hypot(x - MOUNT_C.x, (z - MOUNT_C.z) * 0.85);
  const mountains = smoothstep(300, 540, r) * (60 + 130 * fbm(x * 0.009 + 4, z * 0.009 + 7, 4));
  const open = smoothstep(-10, 70, z); // 0 on the story side, 1 behind the start
  const valley = -26 * smoothstep(0, 150, z);
  return (hills * (1 - 0.45 * open) - lakeMask * 34 + mountains * (1 - open * 0.92)) + valley;
}

/** Final ground height: the landscape, flattened into a corridor around the road. */
export function groundHeight(x: number, z: number): number {
  const raw = rawHeight(x, z);
  const { d, y } = nearestRoad(x, z);
  const w = 1 - smoothstep(9, 46, d);
  return lerp(raw, y - 0.12, w * w * (3 - 2 * w));
}

export interface TerrainBuild {
  mesh: THREE.Mesh;
  size: number;
}

export function buildTerrain(): TerrainBuild {
  const size = 980;
  const seg = 300;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  geo.translate(MOUNT_C.x, 0, MOUNT_C.z + 20);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const h = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const y = groundHeight(pos.getX(i), pos.getZ(i));
    pos.setY(i, y);
    h[i] = y;
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  const c = new THREE.Color();
  const grassLo = new THREE.Color("#3c9a47");
  const grassHi = new THREE.Color("#8fd05c");
  const dry = new THREE.Color("#b6c85e");
  const rock = new THREE.Color("#8d8279");
  const snow = new THREE.Color("#f3f0ea");
  const dirt = new THREE.Color("#c99f62");
  const sand = new THREE.Color("#d9c78d");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = h[i];
    const n = fbm(x * 0.05, z * 0.05, 3);
    const slope = 1 - nrm.getY(i);
    c.copy(grassLo).lerp(grassHi, smoothstep(0.25, 0.75, n));
    c.lerp(dry, smoothstep(0.55, 0.9, fbm(x * 0.02 + 20, z * 0.02, 2)) * 0.5);
    // beaches around the lake, rock on steep ground, snow up high
    c.lerp(sand, (1 - smoothstep(WATER_Y + 0.2, WATER_Y + 2.2, y)) * 0.9);
    c.lerp(rock, smoothstep(0.1, 0.32, slope) * 0.9 + smoothstep(55, 95, y) * 0.6);
    c.lerp(snow, smoothstep(105, 135, y + (n - 0.5) * 20));
    const { d } = nearestRoad(x, z);
    c.lerp(dirt, (1 - smoothstep(1.9, 3.4, d)) * 0.95);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return { mesh, size };
}
