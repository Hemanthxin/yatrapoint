// Procedural SVG artwork for the landing story. Everything is deterministic
// (seeded) so server and client markup agree. Filters (#sb-wash, #sb-rough,
// #sb-soft) come from <PaintDefs/> in the root layout.
import { blob, makeRidge, oak, pine, ridgeFill, rng } from "@/components/storybook/paint";

/* ─────────────────────────── HERO DECOR ─────────────────────────── */

function cloudPath(w: number, seed: number) {
  const r = rng(seed);
  let d = "";
  const n = 6 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const cx = (i / (n - 1)) * w;
    const bump = Math.sin((i / (n - 1)) * Math.PI);
    const rad = 26 + bump * 34 + r() * 12;
    const cy = 60 - bump * 22 + r() * 6;
    d += `M${cx - rad} ${cy}a${rad} ${rad} 0 1 0 ${rad * 2} 0a${rad} ${rad} 0 1 0 ${-rad * 2} 0Z`;
  }
  return d + `M0 74a${w / 2} 20 0 1 0 ${w} 0a${w / 2} 20 0 1 0 ${-w} 0Z`;
}

export function Cloud({ w = 360, seed = 1, tint = "#fff3e0", shade = "#f1c9b8" }: { w?: number; seed?: number; tint?: string; shade?: string }) {
  return (
    <svg viewBox={`-70 -50 ${w + 140} 220`} width={w + 140} aria-hidden style={{ overflow: "visible", margin: "-50px 0 0 -70px" }}>
      <g filter="url(#sb-wobble)">
        <path d={cloudPath(w, seed)} fill={shade} transform="translate(5 9)" opacity="0.7" />
        <path d={cloudPath(w, seed)} fill={tint} opacity="0.95" />
      </g>
    </svg>
  );
}

export function Bird({ s = 1 }: { s?: number }) {
  return (
    <svg viewBox="0 0 40 16" width={34 * s} aria-hidden className="st-bird">
      <path d="M2 10C9 1 14 3 20 11 26 3 31 1 38 10" fill="none" stroke="#4a3550" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─────────────────────────── THE GATE (zoom scene) ─────────────────────────── */

function forestRow(seed: number, baseY: number, size: [number, number], gap: number, fill: string, opacity = 1) {
  const r = rng(seed);
  let d = "";
  for (let x = -40; x < 1660; x += gap * (0.6 + r() * 0.8)) {
    const s = size[0] + r() * (size[1] - size[0]);
    d += pine(x, baseY + (r() - 0.5) * 22, s);
  }
  return <path d={d} fill={fill} opacity={opacity} />;
}

export function GateBackdrop() {
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="gt-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f2b2c" />
          <stop offset="0.5" stopColor="#245547" />
          <stop offset="1" stopColor="#5d8a62" />
        </linearGradient>
        <linearGradient id="gt-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2b8" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff2b8" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="gt-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff3b0" stopOpacity="0.85" />
          <stop offset="0.5" stopColor="#ffd77a" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffd77a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#gt-sky)" />
      <g filter="url(#sb-soft)" opacity="0.8">
        <path d="M520 0L700 0 960 760 620 760Z" fill="url(#gt-beam)" opacity="0.5" />
        <path d="M860 0L980 0 1180 740 900 740Z" fill="url(#gt-beam)" opacity="0.4" />
        <path d="M250 0L350 0 440 700 300 700Z" fill="url(#gt-beam)" opacity="0.3" />
      </g>
      <circle cx="800" cy="560" r="420" fill="url(#gt-halo)" />
      <g filter="url(#sb-wash)">
        {forestRow(11, 600, [90, 150], 46, "#3d7060", 0.55)}
        {forestRow(12, 660, [110, 180], 52, "#2d5a4c", 0.8)}
        {forestRow(13, 730, [140, 220], 64, "#20463b", 0.95)}
        <path d="M-20 740C300 700 560 760 800 745S1300 700 1640 748V910H-20Z" fill="#1a3a2f" />
      </g>
    </svg>
  );
}

export function GateArch() {
  const cx = 800;
  const spring = 470;
  const rOut = 168;
  const rIn = 104;
  // voussoir (arch stone) joints
  const joints: string[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI + (i / 12) * Math.PI;
    joints.push(`M${cx + Math.cos(a) * rIn} ${spring + Math.sin(a) * rIn}L${cx + Math.cos(a) * rOut} ${spring + Math.sin(a) * rOut}`);
  }
  const courses: string[] = [];
  for (let y = spring + 30; y < 770; y += 44) {
    courses.push(`M${cx - rOut} ${y}h${rOut - rIn}M${cx + rIn} ${y}h${rOut - rIn}`);
  }
  const r = rng(77);
  const leaves: JSX.Element[] = [];
  for (let i = 0; i < 46; i++) {
    const side = r() > 0.5 ? 1 : -1;
    const t = r();
    const lx = cx + side * (rOut - 6 + r() * 12) * (t < 0.5 ? 1 : Math.cos(t * 1.4));
    const ly = t < 0.5 ? 770 - t * 2 * 290 : spring - Math.sin((t - 0.5) * 2.6) * rOut * 0.9;
    leaves.push(
      <ellipse key={i} cx={lx} cy={ly} rx={9 + r() * 7} ry={4.5 + r() * 3} transform={`rotate(${r() * 180} ${lx} ${ly})`} fill={r() > 0.5 ? "#4f8a4c" : "#6aa35a"} />,
    );
  }
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id="gt-portal" cx="0.5" cy="0.62" r="0.62">
          <stop offset="0" stopColor="#fffdf0" />
          <stop offset="0.35" stopColor="#ffe9a0" />
          <stop offset="0.75" stopColor="#8fe0cf" />
          <stop offset="1" stopColor="#3a9a96" />
        </radialGradient>
        <linearGradient id="gt-stone" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b3ab97" />
          <stop offset="1" stopColor="#6b6554" />
        </linearGradient>
        <clipPath id="gt-open">
          <path d={`M${cx - rIn} 780V${spring}A${rIn} ${rIn} 0 0 1 ${cx + rIn} ${spring}V780Z`} />
        </clipPath>
      </defs>
      {/* stone */}
      <path d={`M${cx - rOut} 790V${spring}A${rOut} ${rOut} 0 0 1 ${cx + rOut} ${spring}V790Z`} fill="url(#gt-stone)" stroke="#3f3a2e" strokeWidth="3" />
      <path d={joints.join("") + courses.join("")} stroke="#3f3a2e" strokeWidth="2.2" opacity="0.55" fill="none" />
      {/* steps */}
      <path d={`M${cx - 240} 830H${cx + 240}V800H${cx - 240}Z M${cx - 205} 800H${cx + 205}V780H${cx - 205}Z`} fill="#8b8470" stroke="#3f3a2e" strokeWidth="2.5" />
      {/* portal */}
      <g clipPath="url(#gt-open)">
        <rect x={cx - rIn} y={spring - rIn} width={rIn * 2} height={rIn + 310} fill="url(#gt-portal)" />
        <g className="st-swirl">
          {[0, 1, 2, 3, 4].map((i) => (
            <path
              key={i}
              d={`M${cx} 600C${cx + 30 + i * 18} ${560 - i * 14} ${cx + 120} ${600 + i * 10} ${cx + 70} ${690 + i * 12}`}
              fill="none"
              stroke="#fff"
              strokeOpacity={0.5 - i * 0.07}
              strokeWidth={5 - i * 0.6}
              strokeLinecap="round"
              transform={`rotate(${i * 72} ${cx} 600)`}
            />
          ))}
        </g>
      </g>
      {/* keystone rune */}
      <g transform={`translate(${cx} ${spring - rOut + 22})`}>
        <circle r="17" fill="#2f2b22" stroke="#e9c35a" strokeWidth="2.5" />
        <path d="M0 -9L4 -2 11 -1 5 4 7 11 0 7 -7 11 -5 4 -11 -1 -4 -2Z" fill="#ffe08a" className="st-rune" />
      </g>
      {/* moss + vines */}
      <g filter="url(#sb-rough)">
        <path d={`M${cx - rOut} 560Q${cx - rOut - 22} 640 ${cx - rOut + 4} 760`} stroke="#4f8a4c" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d={`M${cx + rOut} 540Q${cx + rOut + 26} 650 ${cx + rOut - 2} 770`} stroke="#4f8a4c" strokeWidth="7" fill="none" strokeLinecap="round" />
        {leaves}
      </g>
    </svg>
  );
}

export function GateMid() {
  const r = rng(5);
  const trunk = (x: number, w: number, flip: number) => (
    <g key={x}>
      <path d={`M${x} 920C${x + flip * 10} 600 ${x - flip * 22} 300 ${x + flip * 6} -20H${x + flip * w}C${x + flip * (w + 18)} 300 ${x + flip * (w - 12)} 600 ${x + flip * (w + 30)} 920Z`} fill="#16241c" />
      {Array.from({ length: 16 }, (_, i) => {
        const bx = x + flip * (8 + r() * (w - 14));
        return <path key={i} d={`M${bx} ${r() * 880}v${60 + r() * 120}`} stroke="#0c150f" strokeWidth={3 + r() * 3} opacity="0.7" />;
      })}
    </g>
  );
  const crown = (cxm: number, cym: number, rad: number, seed: number, col: string) => (
    <path d={blob(cxm, cym, rad, seed, 0.16)} fill={col} />
  );
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g filter="url(#sb-wash)">
        {trunk(-30, 250, 1)}
        {trunk(1630, 250, -1)}
        {crown(60, 40, 260, 1, "#1d3a2a")}
        {crown(240, -20, 220, 2, "#26503a")}
        {crown(1540, 40, 270, 3, "#1d3a2a")}
        {crown(1350, -10, 230, 4, "#26503a")}
        {crown(800, -120, 360, 5, "#173024")}
        {/* hanging vines */}
        {[420, 560, 1040, 1180].map((x, i) => (
          <path key={x} d={`M${x} 0C${x + 20} 90 ${x - 18} 170 ${x + 6} ${200 + i * 20}`} stroke="#3c7040" strokeWidth="6" fill="none" strokeLinecap="round" />
        ))}
      </g>
    </svg>
  );
}

export function GateFore() {
  const r = rng(31);
  const fern = (x: number, y: number, rot: number, s: number, col: string, k: number) => (
    <g key={k} transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      {Array.from({ length: 11 }, (_, i) => {
        const a = -78 + i * 15.6;
        return (
          <path
            key={i}
            d="M0 0C30 -60 70 -120 90 -250C40 -170 10 -90 0 0Z"
            fill={i % 2 ? col : "#1b3b27"}
            transform={`rotate(${a}) scale(${0.7 + r() * 0.5})`}
          />
        );
      })}
    </g>
  );
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g filter="url(#sb-wash)">
        {fern(60, 930, 8, 1.5, "#2f6a3a", 1)}
        {fern(260, 950, -6, 1.2, "#3c7a42", 2)}
        {fern(1540, 930, -8, 1.5, "#2f6a3a", 3)}
        {fern(1340, 950, 7, 1.2, "#3c7a42", 4)}
        {fern(-30, 600, 62, 1.1, "#244d31", 5)}
        {fern(1630, 600, -62, 1.1, "#244d31", 6)}
      </g>
    </svg>
  );
}

/* ─────────────────────────── THE TRAVELLER (bear cub) ─────────────────────────── */

export function Bear() {
  return (
    <svg viewBox="0 0 170 230" className="st-bear-svg" aria-hidden>
      <defs>
        <radialGradient id="br-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff2b0" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffd060" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="82" cy="222" rx="52" ry="7" fill="#000" opacity="0.18" />
      <g filter="url(#sb-rough)" stroke="#4a2a14" strokeWidth="2" strokeLinejoin="round">
        {/* back leg + foot */}
        <g className="br-leg-b" style={{ transformOrigin: "62px 165px" }}>
          <ellipse cx="62" cy="186" rx="15" ry="26" fill="#9c6535" />
          <ellipse cx="62" cy="212" rx="19" ry="9" fill="#7a4a24" />
        </g>
        {/* tail */}
        <circle cx="38" cy="146" r="9" fill="#b87a45" />
        {/* body */}
        <ellipse cx="82" cy="140" rx="43" ry="46" fill="#b87a45" />
        <ellipse cx="88" cy="150" rx="26" ry="31" fill="#e9c595" stroke="none" />
        {/* satchel */}
        <path d="M52 112C66 140 88 150 112 166" fill="none" stroke="#6b3a1d" strokeWidth="6" strokeLinecap="round" />
        <rect x="40" y="150" width="34" height="30" rx="7" fill="#7b4624" />
        <rect x="46" y="156" width="22" height="9" rx="3" fill="#946034" stroke="none" />
        <circle cx="57" cy="170" r="3.5" fill="#f1cf6a" stroke="#6b4a10" strokeWidth="1.2" />
        {/* front leg */}
        <g className="br-leg-f" style={{ transformOrigin: "104px 165px" }}>
          <ellipse cx="104" cy="186" rx="15" ry="26" fill="#b87a45" />
          <ellipse cx="104" cy="212" rx="19" ry="9" fill="#8a5429" />
        </g>
        {/* scarf */}
        <path d="M52 100C68 114 98 114 114 98L118 112C98 128 68 128 48 114Z" fill="#c74a3a" />
        <g className="br-scarf" style={{ transformOrigin: "50px 108px" }}>
          <path d="M50 106C36 112 28 124 22 140L36 142C42 130 50 122 58 118Z" fill="#c74a3a" />
          <path d="M30 124l12 -4M27 132l12 -4" stroke="#f3d9a0" strokeWidth="2" fill="none" />
        </g>
        {/* head */}
        <circle cx="62" cy="52" r="14" fill="#b87a45" />
        <circle cx="62" cy="52" r="7.5" fill="#e9c595" stroke="none" />
        <circle cx="112" cy="52" r="14" fill="#b87a45" />
        <circle cx="112" cy="52" r="7.5" fill="#e9c595" stroke="none" />
        <circle cx="88" cy="80" r="38" fill="#c08150" />
        <ellipse cx="102" cy="94" rx="19" ry="14.5" fill="#ecca9b" />
        <ellipse cx="111" cy="88" rx="6.8" ry="5" fill="#3a2418" stroke="none" />
        <path d="M108 99q4 4 9 0" fill="none" strokeWidth="2" strokeLinecap="round" />
        <circle cx="94" cy="72" r="4.2" fill="#2a170d" stroke="none" />
        <circle cx="95.4" cy="70.6" r="1.4" fill="#fff" stroke="none" />
        <ellipse cx="80" cy="92" rx="8" ry="5" fill="#e98a7a" opacity="0.5" stroke="none" />
        {/* arm + lantern */}
        <g className="br-arm" style={{ transformOrigin: "108px 124px" }}>
          <ellipse cx="124" cy="138" rx="12" ry="21" fill="#b87a45" transform="rotate(-25 124 138)" />
          <path d="M136 152v14" stroke="#4a2a14" strokeWidth="2" />
          <circle cx="136" cy="176" r="30" fill="url(#br-glow)" stroke="none" className="br-lanternglow" />
          <rect x="128" y="166" width="16" height="22" rx="3" fill="#f6d77a" stroke="#4a2a14" strokeWidth="2" />
          <path d="M127 166h18l-3 -6h-12Z" fill="#4a2a14" />
          <path d="M130 188h12" stroke="#4a2a14" strokeWidth="2.6" />
        </g>
      </g>
    </svg>
  );
}

/* ─────────────────────────── THE ROAD WORLD ─────────────────────────── */

/** Road surface height in viewBox units (900 tall) at horizontal position x (units). */
export const roadY = (x: number) => 742 + 26 * Math.sin(x / 460) + 14 * Math.sin(x / 173 + 1.3);

interface WideLayer {
  color: string;
  fade: string;
  shade: string;
  base: number;
  amp: number;
  peaksPer1600: number;
  trees?: "pine" | "oak";
  treeColor?: string;
  treeDensity?: number;
}

export function WideRidges({ widthUnits, layers, seed, idp }: { widthUnits: number; layers: WideLayer[]; seed: number; idp: string }) {
  return (
    <svg viewBox={`0 0 ${widthUnits} 900`} preserveAspectRatio="none" aria-hidden style={{ width: "100%", height: "100%" }}>
      <defs>
        {layers.map((l, i) => (
          <linearGradient key={i} id={`${idp}-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={l.color} />
            <stop offset="1" stopColor={l.fade} />
          </linearGradient>
        ))}
      </defs>
      <g filter="url(#sb-wash)">
        {layers.map((l, i) => {
          const ridge = makeRidge({ seed: seed + i * 13, base: l.base, amp: l.amp, peaks: Math.max(3, Math.round((l.peaksPer1600 * widthUnits) / 1600)), rough: 0.55, width: widthUnits, step: 14 });
          const rnd = rng(seed + i);
          let trees = "";
          if (l.trees) {
            const n = Math.round(((l.treeDensity ?? 40) * widthUnits) / 1600);
            for (let k = 0; k < n; k++) {
              const p = ridge.pts[Math.floor(rnd() * ridge.pts.length)];
              const s = 34 + rnd() * 40;
              trees += l.trees === "pine" ? pine(p[0], p[1] + 6, s) : oak(p[0], p[1] + 6, s, rnd);
            }
          }
          return (
            <g key={i}>
              <path d={ridgeFill(ridge.pts, 910)} fill={`url(#${idp}-${i})`} />
              {trees && <path d={trees} fill={l.treeColor ?? l.shade} opacity="0.9" />}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export function RoadStrip({ widthUnits, seed = 9 }: { widthUnits: number; seed?: number }) {
  const r = rng(seed);
  const top: string[] = [];
  const bottom: string[] = [];
  for (let x = 0; x <= widthUnits; x += 12) {
    top.push(`${x} ${roadY(x).toFixed(1)}`);
    bottom.push(`${x} ${(roadY(x) + 40).toFixed(1)}`);
  }
  const ground = `M0 910L${top.join("L")}L${widthUnits} 910Z`;
  const road = `M${top.join("L")}L${[...bottom].reverse().join("L")}Z`;
  const dash: string[] = [];
  for (let x = 10; x < widthUnits; x += 70) dash.push(`M${x} ${(roadY(x) + 20).toFixed(1)}L${x + 34} ${(roadY(x + 34) + 20).toFixed(1)}`);

  // trees standing just behind the road
  let oaks = "";
  let pines = "";
  for (let x = 120; x < widthUnits; x += 150 + r() * 260) {
    const s = 150 + r() * 140;
    const by = roadY(x) - 4;
    if (r() > 0.45) oaks += oak(x, by, s, r);
    else pines += pine(x, by, s * 0.95);
  }
  // wildflowers
  const flowers: JSX.Element[] = [];
  const cols = ["#e46a6a", "#f2b34a", "#f4e9c4", "#b784d6", "#ef8fb0"];
  for (let i = 0; i < widthUnits / 38; i++) {
    const x = r() * widthUnits;
    const y = roadY(x) + 52 + r() * 70;
    const c = cols[Math.floor(r() * cols.length)];
    flowers.push(
      <g key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
        <path d={`M0 0v${-14 - r() * 12}`} stroke="#3f6b35" strokeWidth="2.4" />
        <circle cy={-22} r={5 + r() * 3} fill={c} />
        <circle cy={-22} r="2.2" fill="#fff0b0" />
      </g>,
    );
  }
  // lamp posts
  const lamps: JSX.Element[] = [];
  for (let x = 420; x < widthUnits; x += 640) {
    const y = roadY(x);
    lamps.push(
      <g key={x} transform={`translate(${x} ${y})`}>
        <path d="M0 0V-92" stroke="#3b2a1c" strokeWidth="5" />
        <circle cy={-100} r="34" fill="url(#rs-lamp)" />
        <rect x="-8" y="-112" width="16" height="20" rx="3" fill="#ffe18a" stroke="#3b2a1c" strokeWidth="2.5" />
      </g>,
    );
  }
  return (
    <svg viewBox={`0 0 ${widthUnits} 900`} preserveAspectRatio="none" aria-hidden style={{ width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="rs-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fae5a" />
          <stop offset="1" stopColor="#3f7a45" />
        </linearGradient>
        <radialGradient id="rs-lamp" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffe9a0" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ffe9a0" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g filter="url(#sb-wash)">
        <path d={pines} fill="#3f6a4a" />
        <path d={oaks} fill="#5b9248" />
        <path d={oaks} fill="#7fb35a" transform="translate(-6 -10) scale(1)" opacity="0.5" />
        <path d={ground} fill="url(#rs-ground)" />
        <path d={road} fill="#dcb878" stroke="#a37c3f" strokeWidth="3" />
        <path d={dash.join("")} stroke="#fff3d0" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
      </g>
      {lamps}
      <g filter="url(#sb-rough)">{flowers}</g>
    </svg>
  );
}

/* ─────────────────────────── REALM ILLUSTRATIONS (spiral cards) ─────────────────────────── */

export type RealmKind = "pilgrimage" | "adventure" | "beach" | "hill_station" | "heritage" | "wildlife";

const SKY: Record<RealmKind, [string, string]> = {
  pilgrimage: ["#4a3a78", "#f3a56a"],
  adventure: ["#6f8fc4", "#f6d8a0"],
  beach: ["#f09a6a", "#fbe0a8"],
  hill_station: ["#9ec8c0", "#f2f0c8"],
  heritage: ["#7a4f78", "#f4b987"],
  wildlife: ["#e98a4e", "#f7d98a"],
};

export function RealmArt({ kind }: { kind: RealmKind }) {
  const [a, b] = SKY[kind];
  const id = `ra-${kind}`;
  const r = rng(kind.length * 7 + 3);
  const hills = (base: number, amp: number, col: string, seed: number) => {
    const ridge = makeRidge({ seed, base, amp, peaks: 4, rough: 0.5, width: 300, step: 6 });
    return <path d={ridgeFill(ridge.pts, 240)} fill={col} />;
  };
  let scene: JSX.Element;
  switch (kind) {
    case "pilgrimage": // gopuram temple under a lamp-lit sky
      scene = (
        <>
          <circle cx="220" cy="52" r="20" fill="#fff0c4" opacity="0.95" />
          {hills(180, 70, "#5b4a86", 2)}
          <path d="M96 200V132h108v68ZM104 132L150 70l46 62ZM116 116L150 58l34 58ZM130 96L150 40l20 56ZM144 40h12v-14h-12Z" fill="#2b2147" />
          <g fill="#ffd877">
            <rect x="140" y="160" width="20" height="40" rx="10" />
            <rect x="110" y="150" width="9" height="14" rx="4" />
            <rect x="181" y="150" width="9" height="14" rx="4" />
          </g>
          {[40, 70, 235, 262].map((x) => (
            <g key={x}>
              <circle cx={x} cy="200" r="11" fill="#ffd877" opacity="0.35" />
              <ellipse cx={x} cy="205" rx="6" ry="3.6" fill="#ffb347" />
            </g>
          ))}
        </>
      );
      break;
    case "adventure": // peaks, tent, flag
      scene = (
        <>
          <circle cx="70" cy="70" r="26" fill="#fff6d0" opacity="0.9" />
          {hills(190, 140, "#8c9fc4", 4)}
          {hills(215, 110, "#4e6a98", 5)}
          <path d="M214 214l28 -46 28 46Z" fill="#d9573e" />
          <path d="M242 214v-30l9 30Z" fill="#a83b28" />
          <path d="M120 80V40" stroke="#4a3550" strokeWidth="3" />
          <path d="M120 40l26 8-26 8Z" fill="#e0533d" />
        </>
      );
      break;
    case "beach": // sea, palm, boat
      scene = (
        <>
          <circle cx="150" cy="120" r="44" fill="#fff0b8" opacity="0.95" />
          <rect y="124" width="300" height="120" fill="#2f8f9d" />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M${20 + i * 70} ${140 + i * 14}q20 -9 40 0t40 0`} stroke="#bff0e6" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
          ))}
          <path d="M-10 214C60 188 110 206 150 222V250H-10Z" fill="#f1d28c" />
          <path d="M60 214C58 170 66 130 84 96" stroke="#5a3d22" strokeWidth="6" fill="none" strokeLinecap="round" />
          {[-60, -20, 25, 65, 105].map((rot, i) => (
            <path key={i} d="M84 96C100 86 118 92 130 108C112 102 98 100 84 96Z" fill="#2d7a4a" transform={`rotate(${rot} 84 96)`} />
          ))}
          <path d="M200 150l50 0 -10 14h-30Z" fill="#7a3f2a" />
          <path d="M224 150V108l24 42Z" fill="#fff4dc" />
        </>
      );
      break;
    case "hill_station": // tea terraces + cottage + mist
      scene = (
        <>
          {hills(150, 70, "#a9cfae", 8)}
          {hills(185, 60, "#7fb27c", 9)}
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M-10 ${200 + i * 11}C80 ${188 + i * 11} 200 ${208 + i * 11} 310 ${194 + i * 11}`} stroke="#4f8a4f" strokeWidth="6" fill="none" opacity="0.7" />
          ))}
          <rect x="196" y="156" width="46" height="34" fill="#f1e2bd" stroke="#6b4a2a" strokeWidth="2.5" />
          <path d="M190 158l29 -26 29 26Z" fill="#b55a3e" />
          <rect x="212" y="166" width="12" height="24" fill="#8a5a34" />
          <rect x="228" y="168" width="9" height="9" fill="#ffd877" />
          <ellipse cx="90" cy="130" rx="90" ry="12" fill="#fff" opacity="0.45" />
        </>
      );
      break;
    case "heritage": // fort with domes
      scene = (
        <>
          <circle cx="232" cy="56" r="22" fill="#fff0c4" opacity="0.9" />
          <path d="M20 214V140h260v74Z" fill="#6a3a4e" />
          {[30, 90, 150, 210, 262].map((x, i) => (
            <path key={x} d={`M${x} 140v${-30 - (i % 2) * 14}h22v${30 + (i % 2) * 14}`} fill="#6a3a4e" />
          ))}
          <path d="M120 140V92a30 30 0 0 1 60 0v48Z" fill="#8a4a60" />
          <path d="M150 62v-16M142 66h16" stroke="#6a3a4e" strokeWidth="4" />
          <path d="M138 140v-30a12 12 0 0 1 24 0v30Z" fill="#ffd877" />
          {[44, 100, 196, 248].map((x) => (
            <path key={x} d={`M${x} 190v-24a7 7 0 0 1 14 0v24Z`} fill="#ffd877" opacity="0.85" />
          ))}
        </>
      );
      break;
    default: // wildlife — acacia + elephant
      scene = (
        <>
          <circle cx="76" cy="150" r="46" fill="#ffe9a0" opacity="0.85" />
          <rect y="196" width="300" height="50" fill="#8a6a32" />
          <path d="M222 196V120" stroke="#3a2a18" strokeWidth="6" />
          <path d="M188 118C204 100 244 100 262 118C244 112 206 112 188 118Z" fill="#3f5f2e" />
          <g fill="#3a2d3a">
            <ellipse cx="110" cy="170" rx="46" ry="28" />
            <circle cx="62" cy="156" r="20" />
            <path d="M44 160C30 176 36 196 44 204L52 200C48 190 50 176 58 170Z" />
            <ellipse cx="78" cy="152" rx="12" ry="18" transform="rotate(14 78 152)" />
            <rect x="80" y="186" width="12" height="26" rx="4" />
            <rect x="104" y="188" width="12" height="24" rx="4" />
            <rect x="132" y="186" width="12" height="26" rx="4" />
            <rect x="148" y="184" width="12" height="28" rx="4" />
          </g>
          <path d="M54 172q-10 6 -14 14" stroke="#f6edd0" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          {Array.from({ length: 8 }, (_, i) => (
            <circle key={i} cx={20 + r() * 260} cy={30 + r() * 60} r="1.4" fill="#fff" opacity="0.7" />
          ))}
        </>
      );
  }
  return (
    <svg viewBox="0 0 300 240" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="300" height="240" fill={`url(#${id})`} />
      <g filter="url(#sb-wash)">{scene}</g>
    </svg>
  );
}

/* ─────────────────────────── THE FESTIVAL WHEEL ─────────────────────────── */

export const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function FestivalWheel({ emojiByMonth }: { emojiByMonth: string[] }) {
  const ticks: JSX.Element[] = [];
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * 360;
    const long = i % 10 === 0;
    ticks.push(<line key={i} x1="0" y1={-(long ? 438 : 446)} x2="0" y2="-458" transform={`rotate(${a})`} stroke="#e8b95a" strokeWidth={long ? 3 : 1.4} opacity={long ? 0.95 : 0.55} />);
  }
  const rays = Array.from({ length: 24 }, (_, i) => (
    <path key={i} d="M-9 -300L0 -352L9 -300Z" fill={i % 2 ? "#e8b95a" : "#f08a5d"} transform={`rotate(${i * 15})`} opacity="0.9" />
  ));
  const petals = Array.from({ length: 12 }, (_, i) => (
    <ellipse key={i} cx="0" cy="-168" rx="34" ry="86" transform={`rotate(${i * 30})`} fill="none" stroke="#f3d489" strokeWidth="2.2" opacity="0.8" />
  ));
  return (
    <svg viewBox="-500 -500 1000 1000" aria-hidden className="st-wheel-svg">
      <defs>
        <radialGradient id="wh-core" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff6cf" />
          <stop offset="0.6" stopColor="#f5c761" />
          <stop offset="1" stopColor="#d78a35" />
        </radialGradient>
        <radialGradient id="wh-disc" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.55" stopColor="#1b2050" />
          <stop offset="1" stopColor="#262c66" />
        </radialGradient>
      </defs>
      <g filter="url(#sb-rough)">
        <circle r="492" fill="url(#wh-disc)" stroke="#e8b95a" strokeWidth="6" />
        <circle r="470" fill="none" stroke="#e8b95a" strokeWidth="1.6" opacity="0.8" />
        <circle r="332" fill="none" stroke="#e8b95a" strokeWidth="2.4" />
        <circle r="428" fill="none" stroke="#e8b95a" strokeWidth="2.4" />
        {ticks}
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1="0" y1="-334" x2="0" y2="-428" transform={`rotate(${i * 30 + 15})`} stroke="#e8b95a" strokeWidth="2" opacity="0.85" />
        ))}
        {MONTHS.map((m, i) => (
          <g key={m} transform={`rotate(${i * 30})`}>
            <text y="-392" textAnchor="middle" fill="#f6e3a6" fontFamily="var(--font-serif), Georgia, serif" fontSize="30" fontWeight="600" letterSpacing="4">
              {m}
            </text>
            <text y="-352" textAnchor="middle" fontSize="38" fill="#f3c969">
              {emojiByMonth[i] || "✦"}
            </text>
          </g>
        ))}
        <g>{rays}</g>
      </g>
      <g className="st-wheel-inner">
        <g filter="url(#sb-rough)">
          <circle r="296" fill="none" stroke="#e8b95a" strokeWidth="2" strokeDasharray="4 10" />
          {petals}
          <circle r="96" fill="url(#wh-core)" stroke="#8a5a1a" strokeWidth="3" />
          {Array.from({ length: 16 }, (_, i) => (
            <path key={i} d="M-6 -100L0 -132L6 -100Z" fill="#f5c761" transform={`rotate(${i * 22.5})`} />
          ))}
          <path d="M-32 -6q12 -16 28 0M6 -6q12 -16 28 0" stroke="#5a3a10" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M-22 26q22 20 44 0" stroke="#5a3a10" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}

/* ─────────────────────────── FINALE: THE LITTLE HOUSE ─────────────────────────── */

export function Cottage() {
  return (
    <svg viewBox="0 0 220 180" aria-hidden className="st-cottage">
      <defs>
        <radialGradient id="ct-win" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffe9a0" />
          <stop offset="1" stopColor="#ffcf60" />
        </radialGradient>
        <radialGradient id="ct-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd77a" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ffd77a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="116" r="90" fill="url(#ct-glow)" className="st-glowpulse" />
      <g filter="url(#sb-rough)" stroke="#120f26" strokeWidth="2.5" strokeLinejoin="round">
        <rect x="46" y="84" width="108" height="76" fill="#2a2150" />
        <path d="M32 90L100 32 168 90Z" fill="#40306a" />
        <rect x="128" y="40" width="16" height="30" fill="#2a2150" />
        <rect x="64" y="104" width="28" height="28" fill="url(#ct-win)" />
        <path d="M78 104v28M64 118h28" stroke="#6a4a1a" strokeWidth="2.4" />
        <path d="M110 160v-36a14 14 0 0 1 28 0v36Z" fill="#ffcf60" />
        <path d="M134 40q6 -14 -2 -26q-6 12 -4 26" fill="none" stroke="#cfc6e8" strokeWidth="3" opacity="0.6" className="st-smoke" />
      </g>
    </svg>
  );
}
