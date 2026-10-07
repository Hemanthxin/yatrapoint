import { castle, makeRidge, ridgeFill, rng, shadowFacets, snowCaps, treesAlong } from "./paint";

export interface ScapeLayer {
  /** Ridge colour at the summit. */
  color: string;
  /** Colour the layer hazes toward at its base (atmospheric perspective). */
  fade: string;
  /** Facet-shadow colour on the right-hand slopes. */
  shade: string;
  /** Baseline in the 1600×900 viewBox. Higher y = closer to the viewer. */
  base: number;
  amp: number;
  peaks: number;
  rough?: number;
  snow?: boolean;
  trees?: "pine" | "oak";
  treeColor?: string;
  treeCount?: number;
  treeSize?: [number, number];
  castle?: boolean;
  /** Skip the (costly) watercolour filter on this layer. */
  plain?: boolean;
}

/**
 * A stack of painted mountain ridges. Every layer is its OWN absolutely
 * positioned <svg> inside a <div class="sb-layer" data-depth="i">, so a caller
 * can translate layers independently (parallax) on the compositor — the SVG
 * filter is rasterised once per layer, not on every frame.
 */
export function MountainScape({
  layers,
  idPrefix,
  seed = 1,
  className = "",
}: {
  layers: ScapeLayer[];
  idPrefix: string;
  seed?: number;
  className?: string;
}) {
  return (
    <div className={`sb-scape ${className}`} aria-hidden>
      {layers.map((l, i) => {
        const s = seed * 97 + i * 31;
        const ridge = makeRidge({ seed: s, base: l.base, amp: l.amp, peaks: l.peaks, rough: l.rough ?? 0.6 });
        const rnd = rng(s + 5);
        const facets = shadowFacets(ridge, rnd);
        const snow = l.snow ? snowCaps(ridge, rnd, l.base - l.amp * 0.55, l.amp * 0.2) : [];
        const trees = l.trees
          ? treesAlong(ridge, rnd, l.treeCount ?? 60, l.treeSize ?? [26, 54], l.trees)
          : "";
        const gid = `${idPrefix}-g${i}`;
        const summit = ridge.peaks.length
          ? ridge.pts[ridge.peaks.reduce((a, b) => (ridge.pts[b][1] < ridge.pts[a][1] ? b : a))]
          : null;
        // Perch the castle on a mid-height summit rather than the very tallest.
        const perch = l.castle
          ? ridge.peaks
              .map((p) => ridge.pts[p])
              .filter((p) => p[0] > 900 && p[0] < 1350)
              .sort((a, b) => a[1] - b[1])[0] ?? summit
          : null;
        return (
          <div className="sb-layer" data-depth={i} key={i}>
            <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" focusable="false">
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={l.color} />
                  <stop offset="0.62" stopColor={l.color} stopOpacity="0.96" />
                  <stop offset="1" stopColor={l.fade} />
                </linearGradient>
              </defs>
              <g filter={l.plain ? undefined : "url(#sb-wash)"}>
                <path d={ridgeFill(ridge.pts, 910)} fill={`url(#${gid})`} />
                {facets.map((d, k) => (
                  <path key={k} d={d} fill={l.shade} opacity="0.32" />
                ))}
                {snow.map((d, k) => (
                  <path key={k} d={d} fill="#fff8ec" opacity="0.82" />
                ))}
                {trees && <path d={trees} fill={l.treeColor ?? l.shade} opacity="0.92" />}
                {perch && <path d={castle(perch[0], perch[1] + 6, 0.8)} fill={l.shade} opacity="0.95" />}
              </g>
            </svg>
          </div>
        );
      })}
    </div>
  );
}

/** Palettes shared by the app backdrop, page banners and the landing story. */
export const DAY_BACKDROP: ScapeLayer[] = [
  { color: "#d9c9b3", fade: "#f0e4c6", shade: "#b9a98f", base: 560, amp: 300, peaks: 5, snow: true },
  { color: "#c3b79d", fade: "#eadcb9", shade: "#a09378", base: 650, amp: 250, peaks: 6 },
  { color: "#a9ad8c", fade: "#d9d3ac", shade: "#7e8a66", base: 760, amp: 180, peaks: 7, trees: "pine", treeColor: "#7c8a63", treeCount: 70, treeSize: [28, 56] },
];

export const NIGHT_BACKDROP: ScapeLayer[] = [
  { color: "#3b4478", fade: "#1d2347", shade: "#2a3162", base: 560, amp: 300, peaks: 5, snow: true },
  { color: "#2d3563", fade: "#181e3e", shade: "#202754", base: 650, amp: 250, peaks: 6 },
  { color: "#222a52", fade: "#12172f", shade: "#171d3d", base: 760, amp: 180, peaks: 7, trees: "pine", treeColor: "#161c3a", treeCount: 70, treeSize: [28, 56] },
];

/** Fixed, low-contrast painted horizon sitting behind every app screen. */
export function PaintedBackdrop() {
  return (
    <div className="sb-backdrop" aria-hidden>
      <MountainScape layers={DAY_BACKDROP} idPrefix="bd-day" seed={7} className="sb-only-day" />
      <MountainScape layers={NIGHT_BACKDROP} idPrefix="bd-night" seed={7} className="sb-only-night" />
    </div>
  );
}

/** The six-ridge dawn panorama used by the landing hero and the dashboard. */
export const DAWN_LAYERS: ScapeLayer[] = [
  { color: "#e6c9d2", fade: "#f9dcc2", shade: "#cba7b8", base: 560, amp: 300, peaks: 5, snow: true },
  { color: "#d0b2c8", fade: "#f4d4c0", shade: "#ae91b4", base: 615, amp: 270, peaks: 6, snow: true, castle: true },
  { color: "#ad98be", fade: "#e9cac2", shade: "#8a79a8", base: 690, amp: 230, peaks: 6 },
  { color: "#8188aa", fade: "#d7c0c2", shade: "#636f96", base: 765, amp: 200, peaks: 7, trees: "pine", treeColor: "#5f6c92", treeCount: 50 },
  { color: "#587693", fade: "#aab5b2", shade: "#415e7c", base: 835, amp: 170, peaks: 7, trees: "pine", treeColor: "#3e5978", treeCount: 80, treeSize: [30, 60] },
  { color: "#3b5b64", fade: "#4b6b61", shade: "#2c4851", base: 905, amp: 120, peaks: 8, trees: "pine", treeColor: "#233f46", treeCount: 100, treeSize: [44, 92] },
];

export const MOONLIT_LAYERS: ScapeLayer[] = [
  { color: "#3e4a8a", fade: "#20275a", shade: "#2b3470", base: 560, amp: 300, peaks: 5, snow: true },
  { color: "#333c78", fade: "#1b2150", shade: "#262d62", base: 615, amp: 270, peaks: 6, snow: true, castle: true },
  { color: "#2a3266", fade: "#171c46", shade: "#202755", base: 690, amp: 230, peaks: 6 },
  { color: "#222956", fade: "#131840", shade: "#1a2048", base: 765, amp: 200, peaks: 7, trees: "pine", treeColor: "#161c42", treeCount: 50 },
  { color: "#1b2147", fade: "#0f1336", shade: "#141a3c", base: 835, amp: 170, peaks: 7, trees: "pine", treeColor: "#0f1436", treeCount: 80, treeSize: [30, 60] },
  { color: "#131838", fade: "#0b0f2a", shade: "#0d1230", base: 905, amp: 120, peaks: 8, trees: "pine", treeColor: "#090d26", treeCount: 100, treeSize: [44, 92] },
];

/** A full-bleed painted landscape: gradient sky, sun (or moon) and six ridges. */
export function PaintedWorld() {
  return (
    <div className="sb-world" aria-hidden>
      <span className="sb-world-orb" />
      <MountainScape layers={DAWN_LAYERS} idPrefix="wd-day" seed={4} className="sb-only-day" />
      <MountainScape layers={MOONLIT_LAYERS} idPrefix="wd-night" seed={4} className="sb-only-night" />
    </div>
  );
}
