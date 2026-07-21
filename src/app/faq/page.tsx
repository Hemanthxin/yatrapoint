import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { InfoPage, InfoSection } from "@/components/app/InfoPage";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Get answers about using Saafera for India travel planning, itinerary building, budgeting, and trip discovery.",
  alternates: {
    canonical: "/faq",
  },
};

const QA: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is Saafera free to use?",
    a: "Yes. Planning trips, exploring places, and all core features are free. Any fees for entry tickets, hotels or transport are paid directly to those providers, not to Saafera.",
  },
  {
    q: "How does the Trip Planner work?",
    a: "You enter your total budget, available time, number of travellers, travel mode and the kinds of places you want. Saafera finds nearby and curated places within your reach, then builds an efficient multi-stop route whose total cost (travel + entry + food) stays within your budget. You get a full breakdown and can swap any stop.",
  },
  {
    q: "Why do some places show my exact distance and others don't?",
    a: "Distances on the dashboard's “Near by place” section are measured from your live location. If you haven't allowed location access, we center on Bengaluru by default. Allow location for the most accurate nearby results.",
  },
  {
    q: "How accurate are the prices, timings and entry fees?",
    a: "They're indicative estimates, calibrated to typical Indian costs and updated from open data. They can change with season, day and availability, so please reconfirm important details before you travel.",
  },
  {
    q: "Where do the photos and maps come from?",
    a: "Photos are matched from Wikipedia where available; map data, nearby places and routes come from OpenStreetMap; live weather and air quality come from Open-Meteo. All are free, open sources.",
  },
  {
    q: "Do I need to create an account?",
    a: "Yes — an account (via Google, email or phone) lets us save your trips, favourites and preferences, and show your dashboard. See the Privacy Policy for how your data is handled.",
  },
  {
    q: "Can I open a place directly in Google Maps?",
    a: "Yes. Every place has an “Open in Google Maps” link that searches for the exact named place at its coordinates, so it opens the right spot with the correct name — not a random nearby pin.",
  },
  {
    q: "What is the Community section?",
    a: "It's where travellers share hidden places they've discovered — a photo, a location and a short description — and react to others' finds. It's a great way to discover spots that aren't in any guidebook.",
  },
  {
    q: "How do one-day trips differ from destinations?",
    a: "One-day trips are day-out spots reachable from your base city, with driving time and a live route. Destinations are the broader statewide catalogue of places to visit, with recommended days and best months.",
  },
  {
    q: "I found something wrong. How do I report it?",
    a: "Email us at support@saafera.app with the place name and what's incorrect — we appreciate the help keeping data accurate.",
  },
];

export default async function FaqPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <InfoPage
        icon={HelpCircle}
        title="Frequently Asked Questions"
        subtitle="Quick answers to the things people ask most."
      >
        <div className="space-y-3">
          {QA.map((item, i) => (
            <details
              key={i}
              className="group rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition open:bg-white open:shadow-sm"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-slate-900">
                {item.q}
                <span
                  aria-hidden
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700 transition group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.a}</p>
            </details>
          ))}
        </div>
      </InfoPage>
    </AppShell>
  );
}
