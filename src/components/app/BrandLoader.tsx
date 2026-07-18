"use client";

// A distinctive, on-brand loading emblem — a location pin sitting inside a
// sweeping emerald orbit, with a soft pulsing halo. Used wherever the app is
// actively working (generating a plan, streaming results). SVG + CSS only, so
// it's crisp at any size, theme-aware and dependency-free.
import { MapPin } from "lucide-react";

export function BrandLoader({
  label,
  size = 56,
  className = "",
}: {
  label?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Soft breathing halo */}
        <span className="absolute inset-0 rounded-full bg-emerald-400/20 blur-md animate-breathe" />
        {/* Sweeping orbit */}
        <svg
          viewBox="0 0 56 56"
          className="relative h-full w-full animate-spin [animation-duration:1.5s] motion-reduce:animate-none"
        >
          <defs>
            <linearGradient id="brandloader-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#0d9488" />
            </linearGradient>
          </defs>
          <circle cx="28" cy="28" r="23" fill="none" stroke="currentColor" className="text-emerald-100" strokeWidth="4" />
          <circle
            cx="28"
            cy="28"
            r="23"
            fill="none"
            stroke="url(#brandloader-grad)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="46 200"
          />
        </svg>
        {/* Centre pin */}
        <span className="absolute inset-0 grid place-items-center">
          <MapPin
            className="text-emerald-600 animate-bounce [animation-duration:1.1s] motion-reduce:animate-none"
            style={{ width: size * 0.34, height: size * 0.34 }}
            strokeWidth={2.4}
          />
        </span>
      </div>
      {label && (
        <p className="text-sm font-semibold text-slate-500 animate-pulse motion-reduce:animate-none">
          {label}
        </p>
      )}
    </div>
  );
}
