// The companions. (Teddy the bear lives in components/story/scenes.tsx and is
// reused as-is.) Every part that moves has a class the journey drives or CSS
// animates — fx-* for Juno, ow-* for Pip the butterfly.

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

/**
 * Pip the butterfly — keeps the coins. Hovers; wings beat continuously.
 * The wing/eye hooks keep their original `ow-*` class names because the CSS
 * (journey.css, assistant.css) and the assistant's pointer-follow code key on
 * them: .ow-wing-l/.ow-wing-r flap, .ow-eyes blinks, .ow-look follows the cursor.
 */
function ButterflyWing() {
  // Drawn for the left side; the right wing is this same shape mirrored.
  return (
    <>
      {/* upper wing */}
      <path d="M74 72C58 24 14 14 10 46C8 74 40 92 74 90Z" fill="#6a2d9a" stroke="#4b1d70" />
      <path d="M71 76C57 40 26 30 23 50C23 68 46 82 71 84Z" fill="#f9831f" stroke="none" />
      <path d="M70 80C54 62 34 62 31 70C33 80 52 86 70 87Z" fill="#ef4f94" stroke="none" />
      <path d="M69 70C61 46 48 42 47 54C49 63 59 74 69 78Z" fill="#fcc419" stroke="none" />
      {[[14, 40], [12, 52], [16, 64], [26, 76], [40, 84]].map(([x, y]) => (
        <circle key={`u${x}${y}`} cx={x} cy={y} r="2.3" fill="#fff" stroke="none" />
      ))}
      {/* lower wing */}
      <path d="M74 92C50 90 22 100 24 124C28 144 62 140 76 112Z" fill="#6a2d9a" stroke="#4b1d70" />
      <path d="M71 98C51 96 35 104 35 114C41 124 61 120 73 108Z" fill="#2f8fe0" stroke="none" />
      <path d="M71 106C55 106 45 114 47 122C55 128 67 122 73 114Z" fill="#7ccf2b" stroke="none" />
      <path d="M73 113C63 117 57 126 63 130C71 128 75 120 75 113Z" fill="#b04ad0" stroke="none" />
      {[[28, 106], [30, 118], [38, 130], [52, 135]].map(([x, y]) => (
        <circle key={`l${x}${y}`} cx={x} cy={y} r="2.1" fill="#fff" stroke="none" />
      ))}
    </>
  );
}

export function Butterfly() {
  return (
    <svg viewBox="0 0 160 150" className="jr-char-svg" aria-hidden>
      <g filter="url(#sb-rough)" stroke="#8a4b00" strokeWidth="1.2" strokeLinejoin="round">
        {/* wings (behind) — flap by squeezing toward the body */}
        <g className="ow-wing ow-wing-l" style={{ transformOrigin: "80px 84px" }}>
          <ButterflyWing />
        </g>
        <g className="ow-wing ow-wing-r" style={{ transformOrigin: "80px 84px" }}>
          <g transform="translate(160 0) scale(-1 1)">
            <ButterflyWing />
          </g>
        </g>
        {/* striped abdomen */}
        <ellipse cx="80" cy="110" rx="12" ry="27" fill="#fcc419" />
        {[96, 108, 120, 131].map((y, i) => (
          <path key={y} d={`M${69 + i * 0.6} ${y}q${11 - i * 0.6} 6 ${22 - i * 1.2} 0`} fill="none" stroke="#f9831f" strokeWidth="4.5" strokeLinecap="round" />
        ))}
        {/* arms thrown up, tiny hands */}
        <path d="M70 90Q58 88 52 76" fill="none" stroke="#f6a800" strokeWidth="5" strokeLinecap="round" />
        <path d="M90 90Q102 88 108 76" fill="none" stroke="#f6a800" strokeWidth="5" strokeLinecap="round" />
        <circle cx="51" cy="74" r="4.6" fill="#fcc419" />
        <circle cx="109" cy="74" r="4.6" fill="#fcc419" />
        {/* coin pouch on the tummy */}
        <g>
          <circle cx="80" cy="112" r="8.5" fill="#f1cf6a" stroke="#8a6a1c" />
          <text x="80" y="116" textAnchor="middle" fontSize="11" fontWeight="700" fill="#7a5a10" stroke="none">
            ₹
          </text>
        </g>
        {/* antennae */}
        <path d="M70 38Q66 20 74 11" fill="none" stroke="#5a3a1a" strokeWidth="3" strokeLinecap="round" />
        <path d="M90 38Q96 20 90 12" fill="none" stroke="#5a3a1a" strokeWidth="3" strokeLinecap="round" />
        <circle cx="74" cy="10" r="4" fill="#5a3a1a" stroke="none" />
        <circle cx="90" cy="11" r="4" fill="#5a3a1a" stroke="none" />
        {/* round head */}
        <circle cx="80" cy="60" r="27" fill="#fcc419" />
        <ellipse cx="72" cy="46" rx="9" ry="4.5" fill="#fff" opacity="0.28" stroke="none" />
        <g className="ow-eyes" style={{ transformOrigin: "80px 58px" }}>
          {/* .ow-look can be nudged from outside so the butterfly's gaze follows the pointer */}
          <g className="ow-look">
            <ellipse cx="68" cy="58" rx="8" ry="9.5" fill="#fff" stroke="#8a4b00" strokeWidth="0.8" />
            <ellipse cx="92" cy="58" rx="8" ry="9.5" fill="#fff" stroke="#8a4b00" strokeWidth="0.8" />
            <circle cx="69" cy="59" r="5.6" fill="#2a62c9" stroke="none" />
            <circle cx="91" cy="59" r="5.6" fill="#2a62c9" stroke="none" />
            <circle cx="69" cy="59" r="3" fill="#14213d" stroke="none" />
            <circle cx="91" cy="59" r="3" fill="#14213d" stroke="none" />
            <circle cx="71" cy="56" r="1.9" fill="#fff" stroke="none" />
            <circle cx="93" cy="56" r="1.9" fill="#fff" stroke="none" />
          </g>
        </g>
        <path d="M60 46q6 -4 12 -1M88 45q6 -3 12 1" fill="none" strokeWidth="1.6" strokeLinecap="round" />
        <ellipse cx="80" cy="67" rx="3.4" ry="2.6" fill="#ef7d9a" stroke="none" />
        <path d="M70 71Q80 84 90 71Z" fill="#c2334d" strokeWidth="1" />
        <path d="M75 77Q80 81 85 77Q80 74 75 77Z" fill="#ff8aa8" stroke="none" />
        <ellipse cx="59" cy="70" rx="5" ry="3" fill="#f08a7a" opacity="0.5" stroke="none" />
        <ellipse cx="101" cy="70" rx="5" ry="3" fill="#f08a7a" opacity="0.5" stroke="none" />
      </g>
    </svg>
  );
}
