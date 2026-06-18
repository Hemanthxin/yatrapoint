import { MapPin, ShieldCheck, Wallet } from "lucide-react";

export function Hero() {
  return (
    <div className="relative z-10 flex max-w-xl flex-col gap-8 text-white">
      <div>
        <h1 className="text-5xl font-bold leading-tight md:text-6xl">
          <span className="font-script text-7xl text-white md:text-8xl">
            Puri
          </span>{" "}
          <span className="font-script text-7xl text-brand-green md:text-8xl">
            Jaga
          </span>
        </h1>
        <p className="mt-3 text-2xl font-semibold text-white">
          Discover places. Plan smart. Travel more.
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
      <div className="grid h-10 w-10 place-items-center rounded-full border border-white/30 bg-white/5 text-brand-green">
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
