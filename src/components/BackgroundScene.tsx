import Image from "next/image";

// Hero background. Uses a portrait-oriented crop on small screens and a
// wide landscape crop on md+ so the composition stays readable in both
// orientations. Drop the two source files into /public:
//   public/hero-landscape.jpg  (wide; used on md+)
//   public/hero-portrait.jpg   (tall;  used on small screens)
export function BackgroundScene() {
  return (
    <div className="absolute inset-0 -z-0 overflow-hidden">
      {/* Slow cinematic pan/zoom wrapper */}
      <div className="absolute inset-0 animate-kenburns will-change-transform">
        {/* Mobile / narrow viewports */}
        <Image
          src="/66245.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center md:hidden"
        />
        {/* Tablet and desktop */}
        <Image
          src="/66242.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="hidden object-cover object-center md:block"
        />
      </div>

      {/* Cinematic darkening so the headline + login card stay readable */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/75" />
      {/* Emerald brand wash from the bottom for warmth */}
      <div className="absolute inset-0 bg-gradient-to-tr from-emerald-950/60 via-transparent to-transparent" />

      {/* Floating glow orbs for depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-emerald-400/25 blur-3xl animate-blob"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-teal-400/20 blur-3xl animate-blob [animation-delay:-8s]"
      />

      {/* Vignette to focus the center */}
      <div className="absolute inset-0 [box-shadow:inset_0_0_180px_60px_rgba(0,0,0,0.55)]" />
    </div>
  );
}
