import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";
import { AuthCard } from "@/components/AuthCard";
import { MobileLogin } from "@/components/MobileLogin";
import { LoginSwitch } from "@/components/LoginSwitch";
import { StoryLanding, type StoryData } from "@/components/story/StoryLanding";
import { countDestinations, listStates } from "@/lib/queries/destinations";
import { FESTIVALS } from "@/lib/festivals";
import { CATEGORIES } from "@/lib/catalog/categories";

export default async function HomePage() {
  const session = await auth();
  if (isAdminSession(session?.user)) redirect("/admin/dashboard");
  if (session?.user) redirect("/dashboard");

  const googleClientId = process.env.AUTH_GOOGLE_ID;
  // Real catalogue counts for the stats strip below — never a made-up
  // marketing figure. Degrades to 0 (the strip still renders fine) rather
  // than 500ing the whole landing page if the DB has a hiccup.
  const [placesCount, statesList] = await Promise.all([
    countDestinations().catch(() => 0),
    listStates().catch(() => [] as string[]),
  ]);

  const story: StoryData = {
    places: placesCount,
    states: statesList,
    festivals: FESTIVALS.filter((f) => f.dateISO).map((f) => ({
      name: f.name,
      month: Number((f.dateISO as string).slice(5, 7)) - 1,
      dateLabel: f.dateLabel,
      emoji: f.emoji,
    })),
    categories: CATEGORIES.map((c) => ({ slug: c.slug, label: c.label, emoji: c.emoji })),
    festivalCount: FESTIVALS.length,
  };

  return (
    <LoginSwitch
      mobile={<MobileLogin googleClientId={googleClientId} />}
      desktop={
        // Desktop gets the painted storybook: a scroll-driven tale with the
        // sign-in card living in its first scene (id="login").
        <StoryLanding data={story} auth={<AuthCard googleClientId={googleClientId} />} />
      }
    />
  );
}
