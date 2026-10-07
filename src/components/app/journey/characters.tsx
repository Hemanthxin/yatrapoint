// The companions. (Teddy the bear lives in components/story/scenes.tsx and is
// reused as-is.) Every part that moves has a class the journey drives or CSS
// animates — fx-* for Juno, ow-* for Pip.

/** Juno the fox — draws the maps. Faces right. */
export function Fox() {
  return (
    <svg viewBox="0 0 200 224" className="jr-char-svg" aria-hidden>
      <ellipse cx="92" cy="218" rx="54" ry="6.5" fill="#000" opacity="0.18" />
      <g filter="url(#sb-rough)" stroke="#5a2a10" strokeWidth="2" strokeLinejoin="round">
        {/* back leg */}
        <g className="fx-leg-b" style={{ transformOrigin: "70px 166px" }}>
          <ellipse cx="70" cy="188" rx="11" ry="25" fill="#cf6a2a" />
          <ellipse cx="68" cy="212" rx="16" ry="8" fill="#3a2418" />
        </g>
        {/* tail */}
        <g className="fx-tail" style={{ transformOrigin: "52px 150px" }}>
          <path d="M54 152C12 160 -6 112 14 74C28 100 52 112 74 134Z" fill="#e57b32" />
          <path d="M14 74C6 90 4 108 10 124C22 114 30 100 30 92Z" fill="#fff4e0" />
        </g>
        {/* body */}
        <ellipse cx="94" cy="138" rx="40" ry="42" fill="#e57b32" />
        <ellipse cx="104" cy="148" rx="21" ry="28" fill="#fff1dc" stroke="none" />
        {/* rolled map */}
        <g transform="rotate(-12 70 134)">
          <rect x="46" y="124" width="40" height="15" rx="7.5" fill="#f3e2b3" />
          <circle cx="47" cy="131.5" r="7" fill="#e7cf92" />
          <circle cx="85" cy="131.5" r="7" fill="#e7cf92" />
          <path d="M60 124v15M72 124v15" stroke="#c0402e" strokeWidth="3" />
        </g>
        {/* front leg */}
        <g className="fx-leg-f" style={{ transformOrigin: "110px 166px" }}>
          <ellipse cx="110" cy="188" rx="11" ry="25" fill="#e57b32" />
          <ellipse cx="112" cy="212" rx="16" ry="8" fill="#3a2418" />
        </g>
        {/* scarf */}
        <path d="M62 104C80 118 112 118 128 102L132 116C112 132 78 132 58 118Z" fill="#3f8f5a" />
        <g className="fx-scarf" style={{ transformOrigin: "60px 112px" }}>
          <path d="M60 110C46 118 38 132 34 150L48 150C52 138 58 128 66 122Z" fill="#3f8f5a" />
        </g>
        {/* ears */}
        <path d="M70 56L64 14L96 44Z" fill="#e57b32" />
        <path d="M70 50L68 28L84 44Z" fill="#3a2418" stroke="none" />
        <path d="M112 46L130 12L134 54Z" fill="#e57b32" />
        <path d="M118 44L128 26L130 48Z" fill="#3a2418" stroke="none" />
        {/* head */}
        <ellipse cx="100" cy="76" rx="37" ry="31" fill="#e57b32" />
        <path d="M70 90C78 106 100 108 114 96L146 90L112 76Z" fill="#fff1dc" stroke="none" />
        <path d="M108 78L148 88L112 102Z" fill="#fff1dc" />
        <circle cx="148" cy="87.5" r="5.6" fill="#2a170d" stroke="none" />
        <g className="fx-eye" style={{ transformOrigin: "112px 70px" }}>
          <ellipse cx="112" cy="70" rx="4.4" ry="5.4" fill="#2a170d" stroke="none" />
          <circle cx="113.4" cy="68" r="1.5" fill="#fff" stroke="none" />
        </g>
        <path d="M126 98q6 4 12 -1" fill="none" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="92" cy="86" rx="7" ry="4.4" fill="#f08a7a" opacity="0.5" stroke="none" />
      </g>
    </svg>
  );
}

/** Pip the owl — keeps the coins. Hovers; wings beat continuously. */
export function Owl() {
  return (
    <svg viewBox="0 0 140 150" className="jr-char-svg" aria-hidden>
      <g filter="url(#sb-rough)" stroke="#4a3220" strokeWidth="2" strokeLinejoin="round">
        {/* wings (behind) */}
        <g className="ow-wing ow-wing-l" style={{ transformOrigin: "40px 84px" }}>
          <path d="M42 66C10 70 -2 100 10 126C26 122 44 108 50 92Z" fill="#6f5233" />
          <path d="M18 112l8 -10M28 106l8 -10" stroke="#9a7a52" strokeWidth="2.4" fill="none" />
        </g>
        <g className="ow-wing ow-wing-r" style={{ transformOrigin: "100px 84px" }}>
          <path d="M98 66C130 70 142 100 130 126C114 122 96 108 90 92Z" fill="#6f5233" />
          <path d="M122 112l-8 -10M112 106l-8 -10" stroke="#9a7a52" strokeWidth="2.4" fill="none" />
        </g>
        {/* body */}
        <ellipse cx="70" cy="86" rx="37" ry="43" fill="#9a7650" />
        <ellipse cx="70" cy="100" rx="24" ry="30" fill="#ead3a8" stroke="none" />
        {[0, 1, 2].map((r) =>
          [0, 1, 2].map((c) => (
            <path key={`${r}${c}`} d={`M${54 + c * 16 - (r % 2) * 8} ${88 + r * 12}q8 8 16 0`} fill="none" stroke="#b8985f" strokeWidth="2" />
          )),
        )}
        {/* ear tufts */}
        <path d="M40 54L36 28L58 46Z" fill="#7a5a3a" />
        <path d="M100 54L104 28L82 46Z" fill="#7a5a3a" />
        {/* face */}
        <circle cx="54" cy="64" r="19" fill="#fff3d6" />
        <circle cx="86" cy="64" r="19" fill="#fff3d6" />
        <g className="ow-eyes" style={{ transformOrigin: "70px 64px" }}>
          <circle cx="56" cy="65" r="9" fill="#2a170d" stroke="none" />
          <circle cx="84" cy="65" r="9" fill="#2a170d" stroke="none" />
          <circle cx="59" cy="62" r="2.6" fill="#fff" stroke="none" />
          <circle cx="87" cy="62" r="2.6" fill="#fff" stroke="none" />
        </g>
        <path d="M70 72L63 82L70 90L77 82Z" fill="#f09a3a" />
        {/* coin pouch */}
        <g>
          <path d="M70 118c-8 0 -14 4 -14 11h28c0 -7 -6 -11 -14 -11Z" fill="#8a5a2c" />
          <circle cx="70" cy="126" r="9.5" fill="#f1cf6a" stroke="#8a6a1c" />
          <text x="70" y="130.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="#7a5a10" stroke="none">
            ₹
          </text>
        </g>
        {/* feet */}
        <path d="M54 128l-4 12m4 -12l0 12m4 -12l4 12M86 128l-4 12m4 -12l0 12m4 -12l4 12" stroke="#f09a3a" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}
