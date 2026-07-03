// Saafera brand lockup — an S-shaped travel emblem (winding road → plane, with
// a mountain, sun and location pin) beside the "Saafera" wordmark and the
// "Explore More. Fulfill Soul." tagline. Modelled on the brand artwork.

export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 116" className={className} role="img" aria-label="Saafera">
      <defs>
        <linearGradient id="saafera-s" x1="30" y1="6" x2="70" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3FBF4F" />
          <stop offset="0.45" stopColor="#20A44A" />
          <stop offset="0.7" stopColor="#1E6FA8" />
          <stop offset="1" stopColor="#1B3E7A" />
        </linearGradient>
      </defs>

      {/* S-shaped winding road / ribbon */}
      <path
        d="M74 20 C74 9 62 6 48 6 C28 6 16 17 16 33 C16 47 28 53 45 57 C63 61 72 66 72 79 C72 94 58 100 42 100 C27 100 18 95 18 84"
        fill="none"
        stroke="url(#saafera-s)"
        strokeWidth="15"
        strokeLinecap="round"
      />
      {/* Road dashes on the lower blue half */}
      <path
        d="M44 60 C60 63 68 68 68 79 C68 90 58 96 44 96"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray="3 6"
        opacity="0.9"
      />

      {/* Sun */}
      <circle cx="70" cy="30" r="6" fill="#F59E0B" />
      {/* Mountains tucked in the top curve */}
      <path d="M40 44 L50 30 L58 40 L64 33 L72 44 Z" fill="#166534" />
      <path d="M55 44 L64 33 L72 44 Z" fill="#1E6FA8" />

      {/* Plane lifting off the top-right */}
      <path
        d="M80 12 L94 8 L86 18 L92 22 L84 23 L80 28 L78 21 L72 20 Z"
        fill="#1B3E7A"
      />

      {/* Location pin at the base of the road */}
      <path
        d="M43 74 C36 74 31 79 31 86 C31 93 43 104 43 104 C43 104 55 93 55 86 C55 79 50 74 43 74 Z"
        fill="#1B3E7A"
      />
      <circle cx="43" cy="86" r="5" fill="#ffffff" />
    </svg>
  );
}

export function Logo({
  className = "",
  tagline = false,
  onDark = false,
}: {
  className?: string;
  tagline?: boolean;
  onDark?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-9 w-9 shrink-0" />
      <div className="leading-none">
        <span className="text-xl font-extrabold tracking-tight">
          <span className={onDark ? "text-brand-greenLight" : "text-brand-green"}>S</span>
          <span className={onDark ? "text-white" : "text-brand-navy"}>aafera</span>
        </span>
        {tagline && (
          <span className={`mt-0.5 block text-[10px] font-semibold tracking-wide ${onDark ? "text-white/70" : "text-slate-500"}`}>
            Explore More. Fulfill Soul.
          </span>
        )}
      </div>
    </div>
  );
}
