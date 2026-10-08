// Procedural "painted illustration" toolkit. Everything is deterministic (seeded),
// so server and client render identical SVG and there is no hydration mismatch.

export type Pt = [number, number];

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 1-D value noise, 0..1.
function noise1(seed: number) {
  const r = rng(seed);
  const lut = Array.from({ length: 256 }, () => r());
  return (x: number) => {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    return lut[i & 255] * (1 - u) + lut[(i + 1) & 255] * u;
  };
}

export interface RidgeOpts {
  seed: number;
  /** Baseline y (in a 0..H space) the ridge sits on. */
  base: number;
  /** Tallest peak height above the baseline. */
  amp: number;
  /** Number of main peaks across the width. */
  peaks: number;
  /** 0..1 jaggedness along the slopes. */
  rough?: number;
  width?: number;
  step?: number;
}

export interface Ridge {
  pts: Pt[];
  peaks: number[]; // indices of local summits
}

export function makeRidge({ seed, base, amp, peaks, rough = 0.5, width: rawWidth = 1600, step = 8 }: RidgeOpts): Ridge {
  // a NaN / zero / negative width (e.g. from a 0×0 measurement) would yield an empty ridge
  const width = Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : 1600;
  const r = rng(seed);
  const n1 = noise1(seed + 11);
  const n2 = noise1(seed + 77);
  const summit = Array.from({ length: peaks }, (_, i) => ({
    x: ((i + 0.15 + r() * 0.7) / peaks) * width,
    h: amp * (0.45 + r() * 0.55),
    w: (width / peaks) * (0.55 + r() * 0.7),
    skew: 0.75 + r() * 0.5,
  }));
  const pts: Pt[] = [];
  for (let x = -step; x <= width + step; x += step) {
    let h = amp * 0.12 * n1(x / 160);
    for (const s of summit) {
      const d = (x - s.x) / s.w;
      const prof = Math.max(0, 1 - Math.abs(d) * (d < 0 ? s.skew : 1 / s.skew));
      h = Math.max(h, s.h * Math.pow(prof, 1.12));
    }
    h += (n1(x / 22) - 0.5) * amp * 0.1 * rough + (n2(x / 9) - 0.5) * amp * 0.045 * rough;
    pts.push([x, base - h]);
  }
  const idx: number[] = [];
  for (let i = 2; i < pts.length - 2; i++) {
    if (pts[i][1] < pts[i - 1][1] && pts[i][1] <= pts[i + 1][1] && pts[i][1] < pts[i - 2][1] && pts[i][1] <= pts[i + 2][1]) {
      if (!idx.length || i - idx[idx.length - 1] > 14) idx.push(i);
    }
  }
  return { pts, peaks: idx };
}

const f = (n: number) => Math.round(n * 10) / 10;

export function ridgeFill(pts: Pt[], bottom: number): string {
  if (pts.length === 0) return "";
  return `M${f(pts[0][0])} ${bottom}L${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}L${f(pts[pts.length - 1][0])} ${bottom}Z`;
}

/** Shadow facet on the right-hand side of each summit — gives a lit-from-the-left painted look. */
export function shadowFacets(ridge: Ridge, rnd: () => number): string[] {
  const { pts, peaks } = ridge;
  const out: string[] = [];
  for (const pi of peaks) {
    const [px, py] = pts[pi];
    let ri = pi;
    while (ri < pts.length - 1 && pts[ri + 1][1] >= pts[ri][1] - 0.01) ri++;
    ri = Math.min(pts.length - 1, ri + 0);
    const [vx, vy] = pts[ri];
    if (vx - px < 30) continue;
    const slope = pts.slice(pi, ri + 1).map(([x, y]) => `${f(x)} ${f(y)}`);
    const j = () => (rnd() - 0.5) * 16;
    const mid1: Pt = [px + (vx - px) * 0.42 + j(), py + (vy - py) * 0.62];
    const mid2: Pt = [px + (vx - px) * 0.16 + j(), py + (vy - py) * 0.34];
    out.push(`M${slope.join("L")}L${f(mid1[0])} ${f(mid1[1])}L${f(mid2[0])} ${f(mid2[1])}Z`);
  }
  return out;
}

/** Snow caps on the tallest summits. */
export function snowCaps(ridge: Ridge, rnd: () => number, minRise: number, capH: number): string[] {
  const { pts, peaks } = ridge;
  const out: string[] = [];
  for (const pi of peaks) {
    const [, py] = pts[pi];
    if (py > minRise) continue;
    let l = pi;
    while (l > 0 && pts[l][1] < py + capH) l--;
    let r = pi;
    while (r < pts.length - 1 && pts[r][1] < py + capH) r++;
    if (r - l < 4) continue;
    const top = pts.slice(l, r + 1).map(([x, y]) => `${f(x)} ${f(y)}`);
    const zig: string[] = [];
    const span = pts[r][0] - pts[l][0];
    const cnt = Math.max(3, Math.floor(span / 26));
    for (let k = 0; k <= cnt; k++) {
      const t = 1 - k / cnt;
      const x = pts[l][0] + span * t;
      const y = py + capH * (k % 2 ? 0.55 : 1.05) + (rnd() - 0.5) * 8;
      zig.push(`${f(x)} ${f(y)}`);
    }
    out.push(`M${top.join("L")}L${zig.join("L")}Z`);
  }
  return out;
}

/** A stylised pine: three stacked triangles + trunk, as a single path. */
export function pine(x: number, y: number, s: number): string {
  const w = s * 0.5;
  const t = (cx: number, top: number, bot: number, hw: number) =>
    `M${f(cx)} ${f(top)}L${f(cx + hw)} ${f(bot)}L${f(cx - hw)} ${f(bot)}Z`;
  return (
    t(x, y - s, y - s * 0.52, w * 0.55) +
    t(x, y - s * 0.78, y - s * 0.24, w * 0.78) +
    t(x, y - s * 0.52, y, w) +
    `M${f(x - s * 0.04)} ${f(y)}h${f(s * 0.08)}v${f(s * 0.1)}h${f(-s * 0.08)}Z`
  );
}

/** A round-crowned deciduous tree. */
export function oak(x: number, y: number, s: number, rnd: () => number): string {
  const c = (cx: number, cy: number, r: number) =>
    `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0Z`;
  return (
    c(x, y - s * 0.7, s * 0.34) +
    c(x - s * 0.24, y - s * 0.5, s * 0.26) +
    c(x + s * 0.26 + (rnd() - 0.5) * 4, y - s * 0.52, s * 0.27) +
    `M${f(x - s * 0.05)} ${f(y)}h${f(s * 0.1)}v${f(-s * 0.4)}h${f(-s * 0.1)}Z`
  );
}

export function treesAlong(ridge: Ridge, rnd: () => number, count: number, size: [number, number], kind: "pine" | "oak" = "pine"): string {
  const { pts } = ridge;
  let d = "";
  for (let i = 0; i < count; i++) {
    const p = pts[Math.floor(rnd() * pts.length)];
    const s = size[0] + rnd() * (size[1] - size[0]);
    d += kind === "pine" ? pine(p[0], p[1] + s * 0.12, s) : oak(p[0], p[1] + s * 0.1, s, rnd);
  }
  return d;
}

/** A tiny fairy-tale castle silhouette, origin at ground-centre. */
export function castle(x: number, y: number, s = 1): string {
  const r = (rx: number, ry: number, w: number, h: number) =>
    `M${f(x + rx * s)} ${f(y + ry * s)}h${f(w * s)}v${f(h * s)}h${f(-w * s)}Z`;
  const cone = (cx: number, base: number, hw: number, h: number) =>
    `M${f(x + (cx - hw) * s)} ${f(y + base * s)}L${f(x + cx * s)} ${f(y + (base - h) * s)}L${f(x + (cx + hw) * s)} ${f(y + base * s)}Z`;
  return (
    r(-26, -34, 52, 34) +
    r(-40, -62, 14, 62) +
    r(26, -70, 14, 70) +
    r(-7, -86, 14, 52) +
    cone(-33, -62, 11, 26) +
    cone(33, -70, 11, 30) +
    cone(0, -86, 11, 32) +
    r(-26, -40, 8, 6) + r(-14, -40, 8, 6) + r(6, -40, 8, 6) + r(18, -40, 8, 6)
  );
}

/** Wobbly circle path (sun / moon discs with a painted edge). */
export function blob(cx: number, cy: number, r: number, seed: number, wob = 0.06): string {
  const rnd = rng(seed);
  const n = 28;
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + (rnd() - 0.5) * 2 * wob);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}Z`;
}
