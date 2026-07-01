import { Globe2, Plane } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative">
        <Globe2 className="h-7 w-7 text-white" strokeWidth={1.5} />
        <Plane
          className="absolute -right-1 -top-1 h-3.5 w-3.5 text-white"
          strokeWidth={2}
        />
      </div>
      <span className="text-xl font-semibold tracking-wide">
        Saa<span className="font-script text-3xl text-brand-green">fera</span>
      </span>
    </div>
  );
}
