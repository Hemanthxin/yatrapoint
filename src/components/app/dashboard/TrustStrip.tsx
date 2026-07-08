import { Users, BadgeCheck, ShieldCheck, Headset, type LucideIcon } from "lucide-react";

const ITEMS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Users, title: "Trusted by Travelers", body: "Join millions of happy explorers" },
  { icon: BadgeCheck, title: "Best Price Guarantee", body: "Get the best deals always" },
  { icon: ShieldCheck, title: "Safe & Secure", body: "Your journey is our priority" },
  { icon: Headset, title: "24/7 Support", body: "We're here to help anytime" },
];

export function TrustStrip() {
  return (
    <div className="card grid grid-cols-2 gap-5 p-6 lg:grid-cols-4">
      {ITEMS.map(({ icon: Icon, title, body }) => (
        <div key={title} className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Icon className="h-5 w-5" strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{title}</p>
            <p className="truncate text-[11px] text-slate-500">{body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
