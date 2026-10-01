import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";
import { BackgroundScene } from "@/components/BackgroundScene";
import { Hero } from "@/components/Hero";
import { Nav } from "@/components/Nav";
import { AuthCard } from "@/components/AuthCard";
import { TrustStrip } from "@/components/TrustStrip";
import { StatsCounterStrip } from "@/components/StatsCounterStrip";
import { MobileLogin } from "@/components/MobileLogin";
import { LoginSwitch } from "@/components/LoginSwitch";
import { ParallaxStage } from "@/components/ParallaxStage";
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

  return (
    <LoginSwitch
      mobile={<MobileLogin googleClientId={googleClientId} />}
      desktop={
        <ParallaxStage className="relative min-h-screen overflow-hidden">
          <main className="contents">
            <BackgroundScene />
            <Nav />
            <section className="relative z-10 mx-auto flex max-w-7xl flex-col items-start gap-10 px-6 pb-12 pt-32 md:px-12 lg:flex-row lg:items-center lg:justify-between lg:pt-36">
              <Hero />
              <div id="login" className="w-full lg:w-auto">
                <AuthCard googleClientId={googleClientId} />
              </div>
            </section>
            <section className="relative z-10 mx-auto max-w-7xl px-6 pb-10 md:px-12">
              <StatsCounterStrip
                places={placesCount}
                states={statesList.length}
                festivals={FESTIVALS.length}
                categories={CATEGORIES.length}
              />
              <TrustStrip />
            </section>
          </main>
        </ParallaxStage>
      }
    />
  );
}
