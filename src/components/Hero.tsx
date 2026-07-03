import { MapPin, ShieldCheck, Wallet, Star } from "lucide-react";

export function Hero() {
  return (
    <div className="relative z-10 flex max-w-xl animate-fadeUp flex-col gap-8 text-white">
      <div>
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-md">
          <Star className="h-3.5 w-3.5 text-amber-300" fill="currentColor" />
          Trusted by 10,000+ travellers
        </span>
        <h1 className="text-5xl font-bold leading-tight drop-shadow-2xl md:text-6xl">
          <span className="font-script text-7xl text-white md:text-8xl">Saa</span>
          <span className="font-script text-7xl text-brand-greenLight md:text-8xl">fera</span>
        </h1>
        <p className="mt-3 text-2xl font-semibold text-white drop-shadow-lg">
          Explore More. Fulfill Soul.
        </p>
        <p className="mt-3 max-w-md text-sm text-white/80">
          From ancient temples to majestic waterfalls, find the perfect trip
          within your budget.
        </p>
      </div>

      <div className="grid max-w-md grid-cols-3 gap-6">
        <Feature
          icon={<MapPin className="h-5 w-5" />}
          title="Explore More"
          subtitle={["Hidden gems &", "top destinations"]}
        />
        <Feature
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Safe & Secure"
          subtitle={["Your safety is", "our priority"]}
        />
        <Feature
          icon={<Wallet className="h-5 w-5" />}
          title="Budget Friendly"
          subtitle={["Best plans that", "fit your budget"]}
        />
      </div>

      <p className="font-script text-2xl text-brand-green">
        Your Journey, Our Passion
      </p>
    </div>
  );
}

function Feature({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string[];
}) {
  return (
    <div className="flex flex-col items-start gap-2 text-sm">
      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/20 bg-white/10 text-brand-green shadow-lg shadow-emerald-500/10 backdrop-blur-md transition hover:scale-105 hover:border-emerald-400/40">
        {icon}
      </div>
      <p className="font-semibold text-white">{title}</p>
      <p className="text-xs leading-tight text-white/70">
        {subtitle[0]}
        <br />
        {subtitle[1]}
      </p>
    </div>
  );
}
