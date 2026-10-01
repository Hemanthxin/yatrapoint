import type { ReactNode } from "react";
import { MapPin } from "lucide-react";
import { ProfileForm } from "./ProfileForm";
import { ProfileTabs } from "./ProfileTabs";
import { Reveal } from "@/components/app/Reveal";

interface MobileProfileProps {
  form: {
    initial: {
      name: string;
      email: string;
      username: string;
      bio: string;
      image: string | null;
    };
    phone: string;
    userId: string;
    stats: { posts: number; trips: number; saved: number };
  };
  counts: { posts: number; trips: number; saved: number };
  posts: ReactNode;
  trips: ReactNode;
  saved: ReactNode;
}

// Bespoke, app-first mobile layout for the "Your Travel Places" profile screen.
// Rendered only below `lg`; the desktop tree stays untouched in page.tsx. It
// REUSES the existing child components (ProfileForm for the bold header + edit
// affordance, ProfileTabs for the tabbed content) — no logic is duplicated.
// The accent stays Saafera green because every emerald/green utility here paints
// green on mobile.
export function MobileProfile({
  form,
  counts,
  posts,
  trips,
  saved,
}: MobileProfileProps) {
  return (
    <Reveal className="space-y-6">
      {/* Screen heading */}
      <div className="flex items-center gap-2 px-1">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <MapPin className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-extrabold tracking-tight text-slate-900">
            Your Travel Places
          </h1>
          <p className="text-xs font-medium text-slate-500">
            Profile, trips &amp; saved spots
          </p>
        </div>
      </div>

      {/* Bold profile header + Edit profile affordance (reused ProfileForm) */}
      <ProfileForm
        initial={form.initial}
        phone={form.phone}
        userId={form.userId}
        stats={form.stats}
      />

      {/* Posts / Trips / Saved tabbed content (reused ProfileTabs) */}
      <ProfileTabs counts={counts} posts={posts} trips={trips} saved={saved} />
    </Reveal>
  );
}
