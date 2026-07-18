"use client";

// The Saafera loading mark — the brand "S-route" draws itself in the green→blue
// gradient while a location pin glides along it. Minimalist, distinctive and
// dependency-free (pure SVG + CSS). Used by every route's loading screen.
//
// The path below is shared by the stroke-draw animation and the pin's motion
// path (see the `saafera-*` keyframes in globals.css), so the pin always rides
// exactly on the drawn line.
export const SAAFERA_PATH =
  "M78 24 C 40 30, 40 66, 66 74 C 92 82, 92 116, 54 122";

export function SaaferaLoader({
  label,
  size = 128,
  className = "",
}: {
  label?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-5 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 132 146" className="h-full w-full overflow-visible">
          <defs>
            <linearGradient id="saafera-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#37c281" />
              <stop offset="55%" stopColor="#0e9488" />
              <stop offset="100%" stopColor="#2f6df0" />
            </linearGradient>
          </defs>
          {/* Faint full-route track */}
          <path
            d={SAAFERA_PATH}
            fill="none"
            stroke="var(--border)"
            strokeWidth="7"
            strokeLinecap="round"
          />
          {/* Animated gradient draw */}
          <path
            d={SAAFERA_PATH}
            fill="none"
            stroke="url(#saafera-grad)"
            strokeWidth="7"
            strokeLinecap="round"
            className="saafera-draw"
          />
        </svg>
        {/* Gliding location pin */}
        <span className="saafera-pin" aria-hidden>
          <svg viewBox="0 0 24 24" width="22" height="22" className="drop-shadow-sm">
            <path
              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
              fill="#1f6b45"
            />
            <circle cx="12" cy="9" r="2.6" fill="#fff" />
          </svg>
        </span>
      </div>
      {label && (
        <p className="text-sm font-medium tracking-wide text-[color:var(--muted)]">
          {label}
        </p>
      )}
    </div>
  );
}
