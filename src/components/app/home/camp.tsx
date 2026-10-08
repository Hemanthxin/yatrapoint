// Artwork for the dashboard's "basecamp" welcome scene. Deterministic (seeded),
// so server and client markup agree. Filters come from <PaintDefs/> in the layout.
import Link from "next/link";
import { makeRidge, oak, pine, ridgeFill, rng } from "@/components/storybook/paint";

/** The meadow the camp sits on: two soft hills, edge trees, grass, a dirt path and wildflowers. */
export function CampGround() {
  const r = rng(11);
  const far = makeRidge({ seed: 3, base: 170, amp: 80, peaks: 6, rough: 0.5, width: 1600, step: 10 });
  const mid = makeRidge({ seed: 8, base: 222, amp: 44, peaks: 9, rough: 0.5, width: 1600, step: 10 });
  let pines = "";
  let oaks = "";
  for (let i = 0; i < 10; i++) {
    const x = i < 5 ? 24 + i * 84 + r() * 30 : 1576 - (i - 5) * 88 - r() * 30;
    const y = mid.pts[Math.min(mid.pts.length - 1, Math.max(0, Math.floor(x / 10) + 1))][1];
    const s = 80 + r() * 70;
    if (i % 2) oaks += oak(x, y + 10, s, r);
    else pines += pine(x, y + 10, s);
  }
  let grass = "M0 340V270";
  for (let x = 0; x <= 1600; x += 34) grass += `L${x} ${(268 + 5 * Math.sin(x / 70) + (x % 3) * 2).toFixed(0)}L${x + 15} ${(254 - ((x / 34) % 3) * 4).toFixed(0)}`;
  grass += "L1600 340Z";
  const cols = ["#ff7a7a", "#ffcf4a", "#fff3d4", "#c58cf0", "#ff9cc4"];
  const flowers = Array.from({ length: 70 }, (_, i) => {
    const x = r() * 1600;
    const y = 280 + r() * 56;
    return (
      <g key={i} transform={`translate(${x.toFixed(0)} ${y.toFixed(0)})`}>
        <path d={`M0 0v${-10 - r() * 10}`} stroke="#2f8f4a" strokeWidth="2.4" />
        <circle cy={-18} r={3.8 + r() * 2.4} fill={cols[i % cols.length]} />
        <circle cy={-18} r="1.6" fill="#fff6c8" />
      </g>
    );
  });
  return (
    <svg viewBox="0 0 1600 340" preserveAspectRatio="xMidYMax slice" aria-hidden className="wh-ground">
      <defs>
        <linearGradient id="cg-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9ae69a" />
          <stop offset="1" stopColor="#c8f0a8" />
        </linearGradient>
        <linearGradient id="cg-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5fcf74" />
          <stop offset="1" stopColor="#8fe08a" />
        </linearGradient>
        <linearGradient id="cg-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6fd868" />
          <stop offset="1" stopColor="#3fa856" />
        </linearGradient>
      </defs>
      <g filter="url(#sb-wash)">
        <path d={ridgeFill(far.pts, 350)} fill="url(#cg-far)" />
        <path d={ridgeFill(mid.pts, 350)} fill="url(#cg-mid)" />
        <path d={pines} fill="#2f9a5e" />
        <path d={oaks} fill="#45b857" />
        <path d={grass} fill="url(#cg-grass)" />
      </g>
      <g filter="url(#sb-rough)">
        <path d="M980 340C960 312 900 300 820 296C740 292 690 286 640 276" fill="none" stroke="#c9a15a" strokeWidth="40" strokeLinecap="round" opacity="0.5" />
        <path d="M980 340C960 312 900 300 820 296C740 292 690 286 640 276" fill="none" stroke="#e8cf94" strokeWidth="32" strokeLinecap="round" />
        <path d="M966 332C946 312 896 302 820 298" fill="none" stroke="#fff3d0" strokeWidth="3" strokeDasharray="14 18" strokeLinecap="round" opacity="0.8" />
      </g>
      <g filter="url(#sb-rough)">{flowers}</g>
    </svg>
  );
}

/** A rope of lanterns strung across the camp — one glows for each place the traveller has explored. */
export function LanternString({ lit, total = 12 }: { lit: number; total?: number }) {
  const pt = (t: number): [number, number] => [
    (1 - t) ** 2 * -20 + 2 * (1 - t) * t * 500 + t * t * 1020,
    (1 - t) ** 2 * 30 + 2 * (1 - t) * t * 150 + t * t * 30,
  ];
  return (
    <svg viewBox="0 0 1000 230" preserveAspectRatio="xMidYMin slice" aria-hidden className="wh-string">
      <g className="wh-rope">
        <path d="M-20 30Q500 150 1020 30" fill="none" stroke="#5a3a1c" strokeWidth="4" />
        {Array.from({ length: total }, (_, i) => {
          const [x, y] = pt((i + 0.5) / total);
          const on = i < lit;
          return (
            <g key={i} className={`wh-l ${on ? "on" : ""}`} style={{ animationDelay: `${(i % 6) * 0.35}s`, ["--d" as string]: `${i * 0.12}s` }}>
              <path d={`M${x.toFixed(1)} ${y.toFixed(1)}v16`} stroke="#3a2a18" strokeWidth="2" />
              <circle className="halo" cx={x.toFixed(1)} cy={(y + 34).toFixed(1)} r="30" fill="#ffd877" />
              <rect className="body" x={(x - 8).toFixed(1)} y={(y + 16).toFixed(1)} width="16" height="24" rx="4.5" stroke="#3a2a18" strokeWidth="2" />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export interface SignLink {
  href: string;
  label: string;
  emoji: string;
  hint: { who: 0 | 1 | 2; text: string };
}

/** A wooden signpost: four boards that point to the app's main places. */
export function SignPost({ links, onHint }: { links: SignLink[]; onHint: (h: SignLink["hint"] | null) => void }) {
  return (
    <nav className="wh-sign" aria-label="Where to?">
      <span className="wh-post" aria-hidden />
      {links.map((l, i) => (
        <Link
          key={l.href}
          href={l.href}
          className={`wh-board ${i % 2 ? "is-r" : "is-l"}`}
          style={{ ["--r" as string]: `${[-3, 2.5, -2, 3][i % 4]}deg`, animationDelay: `${i * 0.6}s` }}
          onMouseEnter={() => onHint(l.hint)}
          onMouseLeave={() => onHint(null)}
          onFocus={() => onHint(l.hint)}
          onBlur={() => onHint(null)}
        >
          <span aria-hidden>{l.emoji}</span>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
