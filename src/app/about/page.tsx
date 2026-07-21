import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Info } from "lucide-react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app/AppShell";
import { InfoPage, InfoSection, InfoList } from "@/components/app/InfoPage";

export const metadata: Metadata = {
  title: "About Saafera",
  description:
    "Learn how Saafera helps travellers plan budget-friendly India trips with curated destinations, route planning, festivals, and stays.",
  alternates: {
    canonical: "/about",
  },
};

export default async function AboutPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const u = session.user;

  return (
    <AppShell userLabel={u.name || u.email || u.phone || "Traveller"} userImage={u.image}>
      <InfoPage
        icon={Info}
        title="About Saafera"
        subtitle="Smart, budget-friendly trip planning for India."
      >
        <InfoSection title="What is Saafera?">
          <p>
            Saafera is a travel planning app that helps you discover places, build a
            complete day-out or multi-day trip that fits your budget, and navigate to every
            stop — all in one place. It is designed around real Indian travel: local entry
            fees, fuel and transport costs, driving distances, and the places people
            actually visit, from famous monuments to nearby hidden gems.
          </p>
          <p>
            Our goal is simple: take the guesswork and spreadsheet math out of planning a
            trip, so you can spend more time travelling and less time organising.
          </p>
        </InfoSection>

        <InfoSection title="What you can do">
          <InfoList
            items={[
              <><strong>Trip Planner</strong> — tell us your budget, hours, group size and travel mode, and Saafera builds an optimised multi-stop itinerary that fits, with a full cost breakdown (travel, entry fees, food, and more).</>,
              <><strong>Explore nearby places</strong> — see curated attractions, restaurants, temples, parks and more, sorted by distance from your live location.</>,
              <><strong>Tourist Places</strong> — browse top places across India, with recommended days, best months to visit and estimated budgets.</>,
              <><strong>One-day trips</strong> — ready-made day trips from your base city with driving time, entry fees and a live-tracking route.</>,
              <><strong>Festivals &amp; events</strong> — discover what's happening so you can time your trip around it.</>,
              <><strong>Community</strong> — share hidden places you've found, with photos and locations, and react to others' finds.</>,
              <><strong>Stays</strong> — browse hotels and stays with prices, ratings and map links.</>,
              <><strong>Trip cart</strong> — collect places and festivals you like, then turn them into a single planned route.</>,
            ]}
          />
        </InfoSection>

        <InfoSection title="How it works">
          <InfoList
            items={[
              <><strong>1. Set your trip.</strong> Choose your budget, available hours or days, number of travellers, the kinds of places you want, and how far you're willing to go.</>,
              <><strong>2. We find the best places.</strong> Saafera pulls from a large curated catalogue and live map data, keeps only places within your chosen reach, and removes duplicates.</>,
              <><strong>3. We build the route.</strong> A smart planner picks the highest-value places that fit your time and budget, then orders them into an efficient loop — no backtracking.</>,
              <><strong>4. You travel.</strong> Open the whole route or any single stop in Google Maps, follow live tracking, and adjust or swap stops any time.</>,
            ]}
          />
        </InfoSection>

        <InfoSection title="Where our information comes from">
          <p>
            Saafera combines a hand-curated catalogue of places with free, open data so it
            works anywhere without expensive licences:
          </p>
          <InfoList
            items={[
              <><strong>OpenStreetMap</strong> — map data, live nearby places and driving routes.</>,
              <><strong>Wikipedia</strong> — real, name-matched photos for well-known places.</>,
              <><strong>Open-Meteo</strong> — live weather and air-quality on your dashboard.</>,
              <>Curated data for entry fees, timings and budgets, calibrated to typical Indian costs.</>,
            ]}
          />
          <p>
            Prices, timings and fees are indicative and can change — always reconfirm
            important details (like entry fees, opening hours and fares) before you travel.
          </p>
        </InfoSection>

        <InfoSection title="Get in touch">
          <p>
            Have feedback, found a wrong detail, or want to suggest a place? We'd love to
            hear from you at{" "}
            <a href="mailto:support@saafera.app" className="font-semibold text-emerald-700 hover:underline">
              support@saafera.app
            </a>
            .
          </p>
        </InfoSection>
      </InfoPage>
    </AppShell>
  );
}
