// The companions. (Teddy the bear lives in components/story/scenes.tsx and is
// reused as-is.) Every part that moves has a class the journey drives or CSS
// animates — fx-* for Juno, ow-* for Pip.

/** Juno the fox — draws the maps. Faces right. */
export function Fox() {
  return (
    <svg viewBox="0 0 200 224" className="jr-char-svg" aria-hidden>
      <ellipse cx="96" cy="218" rx="56" ry="6.5" fill="#000" opacity="0.18" />
      <g filter="url(#sb-rough)" stroke="#5a2a10" strokeWidth="2.2" strokeLinejoin="round">
        {/* legs sit behind the body and swing from the hip */}
        <g className="fx-leg-b" style={{ transformOrigin: "78px 164px" }}>
          <path d="M64 164h28v30a14 12 0 0 1 -28 0Z" fill="#d9692a" />
          <path d="M64 190h28v6a14 12 0 0 1 -28 0Z" fill="#3a2418" stroke="none" />
          <ellipse cx="80" cy="207" rx="18" ry="8.5" fill="#3a2418" />
        </g>
        <g className="fx-leg-f" style={{ transformOrigin: "118px 164px" }}>
          <path d="M104 164h28v30a14 12 0 0 1 -28 0Z" fill="#ee8238" />
          <path d="M104 190h28v6a14 12 0 0 1 -28 0Z" fill="#3a2418" stroke="none" />
          <ellipse cx="120" cy="207" rx="18" ry="8.5" fill="#3a2418" />
        </g>
        {/* big fluffy tail */}
        <g className="fx-tail" style={{ transformOrigin: "60px 158px" }}>
          <path d="M62 162C8 176 -10 118 14 70C30 98 54 110 80 138Z" fill="#ee8238" />
          <path d="M14 70C4 88 2 108 8 126C22 116 32 100 34 90Z" fill="#fff4e0" />
        </g>
        {/* body */}
        <ellipse cx="98" cy="154" rx="38" ry="40" fill="#ee8238" />
        <ellipse cx="106" cy="164" rx="22" ry="27" fill="#fff1dc" stroke="none" />
        {/* rolled map under one arm */}
        <g transform="translate(-4 20) rotate(-14 70 156)">
          <rect x="50" y="148" width="40" height="15" rx="7.5" fill="#f3e2b3" />
          <circle cx="51" cy="155.5" r="7" fill="#e7cf92" />
          <circle cx="89" cy="155.5" r="7" fill="#e7cf92" />
          <path d="M64 148v15M76 148v15" stroke="#c0402e" strokeWidth="3" />
        </g>
        {/* ears — drawn first so the big head overlaps their base */}
        <path d="M58 64L48 6L100 42Z" fill="#ee8238" />
        <path d="M63 54L57 22L86 42Z" fill="#3a2418" stroke="none" />
        <path d="M146 64L156 6L104 42Z" fill="#ee8238" />
        <path d="M141 54L147 22L118 42Z" fill="#3a2418" stroke="none" />
        {/* wide, cheeky head with cheek fluff */}
        <path d="M46 88C42 52 70 36 102 36C134 36 162 52 158 88L170 100L152 102C146 120 126 128 102 128C78 128 58 120 52 102L34 100Z" fill="#ee8238" />
        {/* cream face mask */}
        <path d="M52 102C60 112 78 112 102 104C126 112 144 112 152 102C146 120 126 128 102 128C78 128 58 120 52 102Z" fill="#fff1dc" stroke="none" />
        <ellipse cx="102" cy="106" rx="30" ry="18" fill="#fff1dc" stroke="none" />
        <ellipse cx="102" cy="94" rx="7.5" ry="5.6" fill="#2a170d" stroke="none" />
        <ellipse cx="100" cy="92.4" rx="2.4" ry="1.4" fill="#fff" opacity="0.7" stroke="none" />
        <path d="M102 99v5M90 108q6 7 12 -1q6 8 12 1" fill="none" strokeWidth="2.2" strokeLinecap="round" />
        {/* big shiny eyes */}
        <g className="fx-eye">
          <ellipse cx="78" cy="76" rx="9.5" ry="11" fill="#2a170d" stroke="none" />
          <ellipse cx="126" cy="76" rx="9.5" ry="11" fill="#2a170d" stroke="none" />
          <circle cx="81" cy="72" r="3.4" fill="#fff" stroke="none" />
          <circle cx="129" cy="72" r="3.4" fill="#fff" stroke="none" />
          <circle cx="75" cy="80.5" r="1.5" fill="#fff" opacity="0.8" stroke="none" />
          <circle cx="123" cy="80.5" r="1.5" fill="#fff" opacity="0.8" stroke="none" />
        </g>
        <path d="M66 60q11 -7 22 -1M116 59q11 -6 22 1" fill="none" strokeWidth="2.4" strokeLinecap="round" />
        <ellipse cx="62" cy="98" rx="9" ry="5.6" fill="#f08a7a" opacity="0.55" stroke="none" />
        <ellipse cx="142" cy="98" rx="9" ry="5.6" fill="#f08a7a" opacity="0.55" stroke="none" />
        {/* scarf */}
        <path d="M68 124C86 140 118 140 134 122L138 136C118 154 86 154 64 138Z" fill="#3f8f5a" />
        <g className="fx-scarf" style={{ transformOrigin: "66px 130px" }}>
          <path d="M66 128C50 136 42 150 38 168L53 168C57 154 63 144 72 138Z" fill="#3f8f5a" />
          <path d="M43 150l12 -4M41 158l12 -4" stroke="#bfe8c8" strokeWidth="2" fill="none" />
        </g>
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
          {/* .ow-look can be nudged from outside so the owl's gaze follows the pointer */}
          <g className="ow-look">
            <circle cx="56" cy="65" r="9" fill="#2a170d" stroke="none" />
            <circle cx="84" cy="65" r="9" fill="#2a170d" stroke="none" />
            <circle cx="59" cy="62" r="2.6" fill="#fff" stroke="none" />
            <circle cx="87" cy="62" r="2.6" fill="#fff" stroke="none" />
          </g>
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
