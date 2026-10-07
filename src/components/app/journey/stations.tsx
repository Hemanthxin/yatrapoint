// Set-pieces for the five stations of the journey. Each is a 420×300 SVG whose
// ground line sits at y≈292 so it rests on the road. Everything that moves is a
// CSS-animated class (see journey.css) — they run continuously, scroll or not.
import { pine, oak, rng } from "@/components/storybook/paint";

const BASE = 292;

/** I · Basecamp — tent, crackling fire, a pinned map. */
export function Basecamp() {
  const sparks = [0, 1, 2, 3, 4];
  return (
    <svg viewBox="0 0 420 300" className="jr-st-svg" aria-hidden>
      <defs>
        <radialGradient id="bc-glow" cx="0.5" cy="0.6" r="0.5">
          <stop offset="0" stopColor="#ffd27a" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="312" cy="248" r="86" fill="url(#bc-glow)" className="jr-glow" />
      <g filter="url(#sb-rough)" stroke="#4a2a14" strokeWidth="2.4" strokeLinejoin="round">
        {/* tent */}
        <path d="M44 292L148 120L252 292Z" fill="#d9573e" />
        <path d="M148 120L124 292H172Z" fill="#8f2f20" />
        <path d="M148 120L252 292H172Z" fill="#b8402f" />
        <path d="M148 120v-26" strokeWidth="3" />
        <path d="M148 94l30 9-30 9Z" fill="#f1cf6a" className="jr-flag" style={{ transformOrigin: "148px 100px" }} />
        <path d="M88 292L148 188" stroke="#f3d9a0" strokeWidth="3" opacity="0.7" fill="none" />
        {/* map board */}
        <path d="M262 292V196M292 292V196" strokeWidth="4" />
        <rect x="250" y="150" width="56" height="50" rx="4" fill="#f3e2b3" />
        <path d="M258 168q10 -8 18 2t18 -4M258 184q12 -6 20 0" fill="none" stroke="#a37c3f" strokeWidth="2" />
        <circle cx="288" cy="164" r="4" fill="#c0402e" />
        {/* logs + fire */}
        <path d="M284 286l56 -10M342 286l-58 -10" stroke="#6b4520" strokeWidth="9" strokeLinecap="round" />
        <g className="cf-fire" style={{ transformOrigin: "312px 280px" }}>
          <path d="M312 190C292 220 286 246 300 270C304 280 322 280 326 268C336 244 328 218 312 190Z" fill="#f26b2a" />
          <path d="M312 220C300 238 298 254 306 268C310 274 318 272 320 264C324 250 322 236 312 220Z" fill="#ffb347" stroke="none" />
          <path d="M312 244C306 254 306 262 310 268C314 270 318 266 318 262C318 256 316 250 312 244Z" fill="#fff0b0" stroke="none" />
        </g>
        {/* log seat */}
        <rect x="360" y="262" width="46" height="30" rx="8" fill="#8a5a2c" />
        <ellipse cx="383" cy="262" rx="23" ry="7" fill="#b88a50" />
      </g>
      {sparks.map((i) => (
        <circle key={i} className="cf-spark" cx={300 + i * 7} cy="200" r="2.4" fill="#ffd27a" style={{ animationDelay: `${i * 0.5}s` }} />
      ))}
    </svg>
  );
}

/** II · Lantern Forest — one lantern lights for each place you've explored. */
export function LanternForest({ lit }: { lit: number }) {
  const spots: [number, number][] = [
    [66, 150], [102, 190], [48, 214], [196, 120], [236, 170], [168, 196], [338, 140], [372, 190], [310, 208], [210, 232], [96, 240], [356, 236],
  ];
  const trees = [
    { x: 78, s: 250 }, { x: 208, s: 280 }, { x: 340, s: 240 },
  ];
  const rnd = rng(5);
  return (
    <svg viewBox="0 0 420 300" className="jr-st-svg" aria-hidden>
      <g filter="url(#sb-rough)" stroke="#12301f" strokeWidth="2" strokeLinejoin="round">
        {trees.map((t) => (
          <path key={t.x} d={pine(t.x, BASE, t.s)} fill="#2f6a4a" />
        ))}
        <path d={oak(150, BASE + 2, 120, rnd) + oak(280, BASE + 2, 110, rnd)} fill="#3f8456" opacity="0.9" />
      </g>
      {spots.map(([x, y], i) => {
        const on = i < lit;
        return (
          <g key={i} className={`ln ${on ? "ln-on" : ""}`} style={{ ["--d" as string]: `${i * 0.16}s` }}>
            <path d={`M${x} ${y - 30}V${y - 8}`} stroke="#3a2a18" strokeWidth="1.6" />
            <circle className="ln-halo" cx={x} cy={y + 4} r="24" fill="#ffd877" />
            <rect className="ln-body" x={x - 7} y={y - 8} width="14" height="20" rx="4" stroke="#3a2a18" strokeWidth="1.8" />
          </g>
        );
      })}
      {/* glowing mushrooms */}
      <g filter="url(#sb-rough)">
        {[150, 262, 40, 392].map((x, i) => (
          <g key={x} transform={`translate(${x} ${BASE})`} className="jr-glow" style={{ animationDelay: `${i * 0.4}s` }}>
            <path d="M-9 0a9 9 0 0 1 18 0Z" fill="#9be7d1" stroke="#1f6a58" strokeWidth="1.6" transform="translate(0 -8)" />
            <rect x="-2.5" y="-8" width="5" height="9" fill="#e6f8ee" />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** III · Coin Bridge — flowing river, wooden arch, a stack that grows with what you've saved. */
export function CoinBridge({ ratio }: { ratio: number }) {
  const coins = Math.max(0, Math.min(9, Math.round(ratio * 9)));
  return (
    <svg viewBox="0 0 420 300" className="jr-st-svg" aria-hidden>
      <defs>
        <linearGradient id="cb-river" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fd0e0" />
          <stop offset="1" stopColor="#3f9ab8" />
        </linearGradient>
      </defs>
      <g filter="url(#sb-rough)">
        <path d="M0 262C80 252 160 270 240 258S360 252 420 262V300H0Z" fill="url(#cb-river)" />
      </g>
      {[0, 1, 2].map((i) => (
        <path key={i} className="rv-wave" d={`M${-20 + i * 30} ${272 + i * 8}q20 -9 40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0t40 0`} fill="none" stroke="#e9fbff" strokeWidth="3" strokeLinecap="round" opacity="0.7" style={{ animationDelay: `${i * 0.7}s` }} />
      ))}
      <g filter="url(#sb-rough)" stroke="#4a2a14" strokeWidth="2.4" strokeLinejoin="round">
        {/* deck arch */}
        <path d="M30 262C80 190 190 168 250 182C310 196 352 226 392 262V274C350 244 310 216 250 204C190 192 90 214 40 274Z" fill="#b57c3c" />
        {Array.from({ length: 11 }, (_, i) => {
          const x = 52 + i * 31;
          return <path key={i} d={`M${x} ${246 - Math.sin((i / 10) * Math.PI) * 58}v26`} stroke="#6b4520" strokeWidth="2.2" fill="none" />;
        })}
        {/* rails */}
        <path d="M44 232C94 160 194 142 252 156C310 170 350 198 388 232" fill="none" strokeWidth="5" stroke="#8a5a2c" />
        {[70, 130, 190, 250, 310, 360].map((x, i) => (
          <path key={x} d={`M${x} ${[210, 176, 160, 160, 178, 208][i]}v34`} strokeWidth="4" stroke="#8a5a2c" fill="none" />
        ))}
      </g>
      {/* coin stack on the far bank */}
      <g filter="url(#sb-rough)" stroke="#8a6a1c" strokeWidth="1.6">
        {Array.from({ length: coins }, (_, i) => (
          <g key={i} className="coin" style={{ ["--d" as string]: `${i * 0.12}s` }}>
            <ellipse cx={382 - (i % 3) * 3} cy={BASE - 6 - i * 9} rx="22" ry="7.5" fill="#e9c35a" />
            <path d={`M${360 - (i % 3) * 3} ${BASE - 6 - i * 9}v5a22 7.5 0 0 0 44 0v-5`} fill="#c9972f" />
          </g>
        ))}
      </g>
      {coins > 0 && <path className="coin-glint" d="M382 190l4 10 10 4-10 4-4 10-4-10-10-4 10-4Z" fill="#fff8d0" style={{ transformOrigin: "382px 204px" }} />}
    </svg>
  );
}

/** IV · Festival Village — glowing houses, swaying bunting, the next festival's emblem. */
export function FestivalVillage({ emoji }: { emoji: string }) {
  const flags = Array.from({ length: 14 }, (_, i) => i);
  const cols = ["#e0533d", "#f1cf6a", "#5aa6c9", "#8cc063", "#d97ab0"];
  return (
    <svg viewBox="0 0 420 300" className="jr-st-svg" aria-hidden>
      <g filter="url(#sb-rough)" stroke="#2a1a3a" strokeWidth="2.2" strokeLinejoin="round">
        {/* houses */}
        <rect x="30" y="194" width="104" height="98" fill="#e8c9a0" />
        <path d="M18 198L82 140 146 198Z" fill="#b8402f" />
        <rect x="52" y="224" width="26" height="30" fill="#ffd877" className="jr-win" />
        <rect x="96" y="224" width="26" height="30" fill="#ffd877" className="jr-win" style={{ animationDelay: "0.8s" }} />
        <rect x="286" y="180" width="110" height="112" fill="#e3b88c" />
        <path d="M274 184L341 122 408 184Z" fill="#8a4a2c" />
        <rect x="304" y="212" width="28" height="32" fill="#ffd877" className="jr-win" style={{ animationDelay: "0.4s" }} />
        <path d="M352 292v-34a14 14 0 0 1 28 0v34Z" fill="#6b4520" />
        {/* centre pole + emblem */}
        <path d="M210 292V120" strokeWidth="6" stroke="#5a3a1c" />
        <circle cx="210" cy="104" r="34" fill="#fff1c8" className="jr-glow" />
      </g>
      <text x="210" y="118" textAnchor="middle" fontSize="38" className="jr-emblem">
        {emoji}
      </text>
      {/* bunting */}
      <g className="bunting" style={{ transformOrigin: "82px 150px" }}>
        <path d="M82 148C130 188 170 188 210 150C250 188 290 188 341 134" fill="none" stroke="#5a3a1c" strokeWidth="2.2" />
        {flags.map((i) => {
          const t = i / (flags.length - 1);
          const x = 82 + t * 259;
          const y = 148 + Math.sin(t * Math.PI * 2) * 10 + (t < 0.5 ? Math.sin(t * Math.PI * 2) * 30 : Math.sin(t * Math.PI * 2) * 30);
          return <path key={i} d={`M${x - 7} ${y + 4}L${x + 7} ${y + 4}L${x} ${y + 24}Z`} fill={cols[i % cols.length]} stroke="#2a1a3a" strokeWidth="1.4" />;
        })}
      </g>
      {/* hanging lanterns */}
      {[150, 270].map((x, i) => (
        <g key={x} className="jr-glow" style={{ animationDelay: `${i * 0.6}s` }}>
          <path d={`M${x} 190v20`} stroke="#3a2a18" strokeWidth="1.6" />
          <rect x={x - 8} y="210" width="16" height="22" rx="5" fill="#ff9a4a" stroke="#6a2a10" strokeWidth="1.8" />
        </g>
      ))}
    </svg>
  );
}

/** V · The Summit — a snow peak, a waving flag, a path of lights up to it. */
export function Summit() {
  return (
    <svg viewBox="0 0 420 300" className="jr-st-svg" aria-hidden>
      <g filter="url(#sb-rough)" stroke="#2a2548" strokeWidth="2.4" strokeLinejoin="round">
        <path d="M20 292L200 52L330 292Z" fill="#7a86b8" />
        <path d="M200 52L330 292H252L226 196Z" fill="#5c6a9c" stroke="none" />
        <path d="M200 52L170 110L192 100L206 128L224 104L238 118Z" fill="#fff8ec" />
        <path d="M250 292L360 140L420 292Z" fill="#8e9ac8" />
        <path d="M360 140l-22 34 16 -6 10 18 14 -22 10 10Z" fill="#fff8ec" />
        {/* flag */}
        <path d="M200 52V10" strokeWidth="3.4" />
        <path d="M200 12l44 12-44 14Z" fill="#e0533d" className="jr-flag" style={{ transformOrigin: "200px 24px" }} />
      </g>
      {/* path of lights */}
      {[[96, 270], [128, 248], [150, 224], [176, 204], [196, 176], [212, 150], [204, 124], [200, 98]].map(([x, y], i) => (
        <circle key={i} className="sm-light" cx={x} cy={y} r="4.6" fill="#ffe08a" style={{ animationDelay: `${i * 0.25}s` }} />
      ))}
      {[[60, 40], [110, 70], [320, 50], [372, 90]].map(([x, y], i) => (
        <path key={i} className="coin-glint" d={`M${x} ${y - 7}l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z`} fill="#fff8d0" style={{ transformOrigin: `${x}px ${y}px`, animationDelay: `${i * 0.5}s` }} />
      ))}
    </svg>
  );
}
